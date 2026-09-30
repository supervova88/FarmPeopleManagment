import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TABLES = [
  "sop_fact_performers",
  "day_plan_lines",
  "week_plan_slots",
  "work_plan_items",
  "week_plan_assignments",
  "day_plan_templates",
  "week_plan_templates",
  "persons",
  "divisions",
  "sops",
  "sop_facts",
  "sop_tariffs",
  "pay_schemes",
  "animal_transfers",
  "weight_gains",
  "work_shifts",
  "insemination_results",
  "period_kpis",
  "timesheet_periods",
  "timesheet_entries",
  "timesheet_lines",
  "period_coefficients",
  "bonus_penalties",
  "app_meta",
];

/**
 * @param {string} dbPath
 */
export function openDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  migrateSchema(db);
  return db;
}

/**
 * Лёгкая миграция для уже созданного data/m-complex.db.
 * @param {import("better-sqlite3").Database} db
 */
function migrateSchema(db) {
  const tariffCols = db.prepare("PRAGMA table_info(sop_tariffs)").all().map((c) => c.name);
  if (!tariffCols.includes("rate_unit")) {
    db.exec("ALTER TABLE sop_tariffs ADD COLUMN rate_unit TEXT NOT NULL DEFAULT 'operation'");
  }

  const lineCols = db.prepare("PRAGMA table_info(timesheet_lines)").all().map((c) => c.name);
  if (!lineCols.includes("applied_unit")) {
    db.exec("ALTER TABLE timesheet_lines ADD COLUMN applied_unit TEXT");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sop_fact_performers (
      fact_id   TEXT NOT NULL,
      person_id TEXT NOT NULL,
      PRIMARY KEY (fact_id, person_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS work_plan_items (
      id                    TEXT PRIMARY KEY,
      sop_id                TEXT NOT NULL,
      person_id             TEXT NOT NULL,
      division_id           TEXT NOT NULL,
      planned_date          TEXT NOT NULL,
      object_label          TEXT NOT NULL,
      planned_quantity      REAL NOT NULL DEFAULT 1,
      status                TEXT NOT NULL,
      source                TEXT NOT NULL,
      fact_id               TEXT,
      created_by_person_id  TEXT NOT NULL,
      assignment_id         TEXT
    )
  `);

  const planCols = db.prepare("PRAGMA table_info(work_plan_items)").all().map((c) => c.name);
  if (!planCols.includes("assignment_id")) {
    db.exec("ALTER TABLE work_plan_items ADD COLUMN assignment_id TEXT");
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_plan_person_date ON work_plan_items(person_id, planned_date)`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_plan_division_date ON work_plan_items(division_id, planned_date)`,
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_plan_assignment ON work_plan_items(assignment_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS day_plan_templates (
      id                      TEXT PRIMARY KEY,
      name                    TEXT NOT NULL,
      division_id             TEXT NOT NULL,
      created_by_person_id    TEXT NOT NULL,
      status                  TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS day_plan_lines (
      id                  TEXT PRIMARY KEY,
      template_id         TEXT NOT NULL,
      sop_id              TEXT NOT NULL,
      object_label        TEXT NOT NULL,
      planned_quantity    REAL NOT NULL DEFAULT 1,
      sort_order          INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_day_plan_lines_template ON day_plan_lines(template_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS week_plan_templates (
      id                      TEXT PRIMARY KEY,
      name                    TEXT NOT NULL,
      division_id             TEXT NOT NULL,
      created_by_person_id    TEXT NOT NULL,
      status                  TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS week_plan_slots (
      template_id       TEXT NOT NULL,
      weekday           INTEGER NOT NULL,
      day_template_id   TEXT,
      PRIMARY KEY (template_id, weekday)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS week_plan_assignments (
      id                        TEXT PRIMARY KEY,
      week_template_id          TEXT NOT NULL,
      person_id                 TEXT NOT NULL,
      division_id               TEXT NOT NULL,
      week_start                TEXT NOT NULL,
      status                    TEXT NOT NULL,
      assigned_by_person_id     TEXT NOT NULL,
      acknowledged_at           TEXT,
      reject_comment            TEXT
    )
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_wpa_person_week ON week_plan_assignments(person_id, week_start)`,
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_wpa_division ON week_plan_assignments(division_id)`);

  const factCols = db.prepare("PRAGMA table_info(sop_facts)").all().map((c) => c.name);
  if (factCols.includes("performer_person_id")) {
    const orphanCount = db
      .prepare(
        `SELECT COUNT(*) AS n FROM sop_facts f
         WHERE f.performer_person_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sop_fact_performers p WHERE p.fact_id = f.id)`,
      )
      .get();
    if (orphanCount.n > 0) {
      db.exec(`
        INSERT OR IGNORE INTO sop_fact_performers (fact_id, person_id)
        SELECT id, performer_person_id FROM sop_facts
        WHERE performer_person_id IS NOT NULL AND performer_person_id != ''
      `);
    }
  }
}

/**
 * @param {import("better-sqlite3").Database} db
 */
export function isDatabaseEmpty(db) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM persons").get();
  return row.n === 0;
}

/**
 * @param {import("better-sqlite3").Database} db
 */
export function loadAppState(db) {
  const persons = db
    .prepare("SELECT * FROM persons ORDER BY full_name")
    .all()
    .map((r) => ({
      id: r.id,
      fullName: r.full_name,
      personnelNumber: r.personnel_number,
      divisionId: r.division_id,
      jobTitle: r.job_title,
      status: r.status,
      hiredAt: r.hired_at,
      accessRoleId: r.access_role_id,
    }));

  const divisions = db
    .prepare("SELECT * FROM divisions ORDER BY code")
    .all()
    .map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      parentId: r.parent_id,
      farmName: r.farm_name,
      headPersonId: r.head_person_id,
      status: r.status,
    }));

  const sops = db
    .prepare("SELECT * FROM sops ORDER BY code")
    .all()
    .map((r) => {
      /** @type {Record<string, unknown>} */
      const sop = {
        id: r.id,
        code: r.code,
        name: r.name,
        level: r.level,
        parentId: r.parent_id,
        version: r.version,
        status: r.status,
        ownerPersonId: r.owner_person_id,
        effectiveFrom: r.effective_from,
        methodSummary: r.method_summary,
      };
      if (r.operation_object != null) sop.operationObject = r.operation_object;
      if (r.norm_unit != null) sop.normUnit = r.norm_unit;
      if (r.is_tariffable != null) sop.isTariffable = Boolean(r.is_tariffable);
      return sop;
    });

  const performersByFact = new Map();
  for (const row of db.prepare("SELECT fact_id, person_id FROM sop_fact_performers").all()) {
    const list = performersByFact.get(row.fact_id) ?? [];
    list.push(row.person_id);
    performersByFact.set(row.fact_id, list);
  }

  const factCols = db.prepare("PRAGMA table_info(sop_facts)").all().map((c) => c.name);
  const hasLegacyPerformer = factCols.includes("performer_person_id");

  const facts = db
    .prepare("SELECT * FROM sop_facts ORDER BY fact_date, id")
    .all()
    .map((r) => {
      let performerPersonIds = performersByFact.get(r.id) ?? [];
      if (performerPersonIds.length === 0 && hasLegacyPerformer && r.performer_person_id) {
        performerPersonIds = [r.performer_person_id];
      }
      return {
        id: r.id,
        sopId: r.sop_id,
        sopVersion: r.sop_version,
        performerPersonIds,
        objectLabel: r.object_label,
        factDate: r.fact_date,
        factStatus: r.fact_status,
        quantity: Number(r.quantity),
      };
    });

  const tariffs = db
    .prepare("SELECT * FROM sop_tariffs ORDER BY created_at")
    .all()
    .map((r) => ({
      id: r.id,
      sopId: r.sop_id,
      divisionId: r.division_id,
      jobTitle: r.job_title,
      rate: r.rate,
      rateUnit: r.rate_unit ?? "operation",
      validFrom: r.valid_from,
      validTo: r.valid_to,
      status: r.status,
      approvedByPersonId: r.approved_by_person_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

  const periods = db
    .prepare("SELECT * FROM timesheet_periods ORDER BY date_from")
    .all()
    .map((r) => ({
      id: r.id,
      divisionId: r.division_id,
      periodLabel: r.period_label,
      dateFrom: r.date_from,
      dateTo: r.date_to,
      status: r.status,
      checkedByPersonId: r.checked_by_person_id,
      approvedByPersonId: r.approved_by_person_id,
    }));

  const entries = db
    .prepare("SELECT * FROM timesheet_entries ORDER BY id")
    .all()
    .map((r) => ({
      id: r.id,
      periodId: r.period_id,
      personId: r.person_id,
      status: r.status,
      divisionCoefficientId: r.division_coefficient_id,
      personCoefficientId: r.person_coefficient_id,
    }));

  const lines = db
    .prepare("SELECT * FROM timesheet_lines ORDER BY fact_date, id")
    .all()
    .map((r) => {
      /** @type {Record<string, unknown>} */
      const line = {
        id: r.id,
        entryId: r.entry_id,
        factId: r.fact_id,
        sopId: r.sop_id,
        sopName: r.sop_name,
        sopVersion: r.sop_version,
        factDate: r.fact_date,
        quantity: Number(r.quantity),
        appliedRate: r.applied_rate,
        appliedUnit: r.applied_unit ?? null,
        amount: r.amount,
        status: r.status,
      };
      if (r.adjustment_comment != null) line.adjustmentComment = r.adjustment_comment;
      return line;
    });

  const coefficients = db
    .prepare("SELECT * FROM period_coefficients ORDER BY id")
    .all()
    .map((r) => ({
      id: r.id,
      scope: r.scope,
      targetId: r.target_id,
      periodId: r.period_id,
      value: r.value,
      reason: r.reason,
      setByPersonId: r.set_by_person_id,
      status: r.status,
    }));

  const accruals = db
    .prepare("SELECT * FROM bonus_penalties ORDER BY decided_at")
    .all()
    .map((r) => ({
      id: r.id,
      personId: r.person_id,
      entryId: r.entry_id,
      type: r.type,
      amount: r.amount,
      reason: r.reason,
      linkedDeviationId: r.linked_deviation_id,
      appliedByPersonId: r.applied_by_person_id,
      decidedAt: r.decided_at,
      status: r.status,
    }));

  const roleRow = db.prepare("SELECT value FROM app_meta WHERE key = ?").get("currentRoleId");

  const planItems = db
    .prepare("SELECT * FROM work_plan_items ORDER BY planned_date, id")
    .all()
    .map((r) => ({
      id: r.id,
      sopId: r.sop_id,
      personId: r.person_id,
      divisionId: r.division_id,
      plannedDate: r.planned_date,
      objectLabel: r.object_label,
      plannedQuantity: r.planned_quantity,
      status: r.status,
      source: r.source,
      factId: r.fact_id,
      createdByPersonId: r.created_by_person_id,
      assignmentId: r.assignment_id ?? null,
    }));

  const dayPlanLineRows = db
    .prepare("SELECT * FROM day_plan_lines ORDER BY sort_order, id")
    .all();
  const linesByTemplate = new Map();
  for (const r of dayPlanLineRows) {
    const list = linesByTemplate.get(r.template_id) ?? [];
    list.push({
      id: r.id,
      sopId: r.sop_id,
      objectLabel: r.object_label,
      plannedQuantity: r.planned_quantity,
      sortOrder: r.sort_order,
    });
    linesByTemplate.set(r.template_id, list);
  }

  const dayPlanTemplates = db
    .prepare("SELECT * FROM day_plan_templates ORDER BY name, id")
    .all()
    .map((r) => ({
      id: r.id,
      name: r.name,
      divisionId: r.division_id,
      createdByPersonId: r.created_by_person_id,
      status: r.status,
      lines: linesByTemplate.get(r.id) ?? [],
    }));

  const weekSlotRows = db.prepare("SELECT * FROM week_plan_slots ORDER BY weekday").all();
  const slotsByTemplate = new Map();
  for (const r of weekSlotRows) {
    const list = slotsByTemplate.get(r.template_id) ?? [];
    list.push({
      weekday: r.weekday,
      dayTemplateId: r.day_template_id,
    });
    slotsByTemplate.set(r.template_id, list);
  }

  const weekPlanTemplates = db
    .prepare("SELECT * FROM week_plan_templates ORDER BY name, id")
    .all()
    .map((r) => ({
      id: r.id,
      name: r.name,
      divisionId: r.division_id,
      createdByPersonId: r.created_by_person_id,
      status: r.status,
      slots: slotsByTemplate.get(r.id) ?? [],
    }));

  const weekPlanAssignments = db
    .prepare("SELECT * FROM week_plan_assignments ORDER BY week_start DESC, id")
    .all()
    .map((r) => ({
      id: r.id,
      weekTemplateId: r.week_template_id,
      personId: r.person_id,
      divisionId: r.division_id,
      weekStart: r.week_start,
      status: r.status,
      assignedByPersonId: r.assigned_by_person_id,
      acknowledgedAt: r.acknowledged_at,
      rejectComment: r.reject_comment,
    }));

  const paySchemes = db
    .prepare("SELECT * FROM pay_schemes ORDER BY name, id")
    .all()
    .map((r) => ({
      id: r.id,
      name: r.name,
      regulationRef: r.regulation_ref,
      divisionId: r.division_id,
      siteKey: r.site_key,
      jobTitle: r.job_title,
      status: r.status,
      components: JSON.parse(r.components_json || "[]"),
      approvedByPersonId: r.approved_by_person_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

  const animalTransfers = db
    .prepare("SELECT * FROM animal_transfers ORDER BY event_date, id")
    .all()
    .map((r) => ({
      id: r.id,
      personId: r.person_id,
      divisionId: r.division_id,
      siteKey: r.site_key,
      eventDate: r.event_date,
      animalType: r.animal_type,
      weightKg: r.weight_kg,
      objectLabel: r.object_label,
    }));

  const weightGains = db
    .prepare("SELECT * FROM weight_gains ORDER BY id")
    .all()
    .map((r) => ({
      id: r.id,
      personId: r.person_id,
      divisionId: r.division_id,
      siteKey: r.site_key,
      periodId: r.period_id,
      centners: Number(r.centners),
    }));

  const workShifts = db
    .prepare("SELECT * FROM work_shifts ORDER BY shift_date, id")
    .all()
    .map((r) => ({
      id: r.id,
      personId: r.person_id,
      divisionId: r.division_id,
      siteKey: r.site_key,
      shiftDate: r.shift_date,
      checklist: JSON.parse(r.checklist_json || "{}"),
    }));

  const inseminations = db
    .prepare("SELECT * FROM insemination_results ORDER BY event_date, id")
    .all()
    .map((r) => ({
      id: r.id,
      personId: r.person_id,
      divisionId: r.division_id,
      siteKey: r.site_key,
      eventDate: r.event_date,
      mode: r.mode,
      semenType: r.semen_type,
      attemptNumber: Number(r.attempt_number),
      pregnant: Boolean(r.pregnant),
      objectLabel: r.object_label,
    }));

  const periodKpis = db
    .prepare("SELECT * FROM period_kpis ORDER BY id")
    .all()
    .map((r) => ({
      id: r.id,
      periodId: r.period_id,
      divisionId: r.division_id,
      siteKey: r.site_key,
      personId: r.person_id,
      metrics: JSON.parse(r.metrics_json || "{}"),
    }));

  return {
    currentRoleId: roleRow?.value ?? "specialist",
    persons,
    divisions,
    sops,
    facts,
    planItems,
    dayPlanTemplates,
    weekPlanTemplates,
    weekPlanAssignments,
    tariffs,
    paySchemes,
    animalTransfers,
    weightGains,
    workShifts,
    inseminations,
    periodKpis,
    periods,
    entries,
    lines,
    coefficients,
    accruals,
  };
}

/**
 * Полная перезапись состояния в одной транзакции (MVP, один писатель).
 * @param {import("better-sqlite3").Database} db
 * @param {Record<string, unknown>} state
 */
export function saveAppState(db, state) {
  const tx = db.transaction(() => {
    for (const table of TABLES) {
      db.prepare(`DELETE FROM ${table}`).run();
    }

    const insertPerson = db.prepare(`
      INSERT INTO persons (id, full_name, personnel_number, division_id, job_title, status, hired_at, access_role_id)
      VALUES (@id, @fullName, @personnelNumber, @divisionId, @jobTitle, @status, @hiredAt, @accessRoleId)
    `);
    for (const p of /** @type {any[]} */ (state.persons)) insertPerson.run(p);

    const insertDivision = db.prepare(`
      INSERT INTO divisions (id, code, name, parent_id, farm_name, head_person_id, status)
      VALUES (@id, @code, @name, @parentId, @farmName, @headPersonId, @status)
    `);
    for (const d of /** @type {any[]} */ (state.divisions)) insertDivision.run(d);

    const insertSop = db.prepare(`
      INSERT INTO sops (
        id, code, name, level, parent_id, version, status, owner_person_id,
        effective_from, method_summary, operation_object, norm_unit, is_tariffable
      ) VALUES (
        @id, @code, @name, @level, @parentId, @version, @status, @ownerPersonId,
        @effectiveFrom, @methodSummary, @operationObject, @normUnit, @isTariffable
      )
    `);
    for (const s of /** @type {any[]} */ (state.sops)) {
      insertSop.run({
        id: s.id,
        code: s.code,
        name: s.name,
        level: s.level,
        parentId: s.parentId,
        version: s.version,
        status: s.status,
        ownerPersonId: s.ownerPersonId,
        effectiveFrom: s.effectiveFrom,
        methodSummary: s.methodSummary,
        operationObject: s.operationObject ?? null,
        normUnit: s.normUnit ?? null,
        isTariffable: s.isTariffable == null ? null : s.isTariffable ? 1 : 0,
      });
    }

    const factCols = db.prepare("PRAGMA table_info(sop_facts)").all().map((c) => c.name);
    const hasLegacyPerformer = factCols.includes("performer_person_id");

    const insertFact = hasLegacyPerformer
      ? db.prepare(`
          INSERT INTO sop_facts (
            id, sop_id, sop_version, performer_person_id, object_label, fact_date, fact_status, quantity
          ) VALUES (
            @id, @sopId, @sopVersion, @legacyPerformerId, @objectLabel, @factDate, @factStatus, @quantity
          )
        `)
      : db.prepare(`
          INSERT INTO sop_facts (
            id, sop_id, sop_version, object_label, fact_date, fact_status, quantity
          ) VALUES (
            @id, @sopId, @sopVersion, @objectLabel, @factDate, @factStatus, @quantity
          )
        `);

    const insertPerformer = db.prepare(`
      INSERT INTO sop_fact_performers (fact_id, person_id) VALUES (@factId, @personId)
    `);

    for (const f of /** @type {any[]} */ (state.facts)) {
      const ids = Array.isArray(f.performerPersonIds) ? f.performerPersonIds : [];
      insertFact.run({
        id: f.id,
        sopId: f.sopId,
        sopVersion: f.sopVersion,
        legacyPerformerId: ids[0] ?? "",
        objectLabel: f.objectLabel,
        factDate: f.factDate,
        factStatus: f.factStatus,
        quantity: f.quantity,
      });
      for (const personId of ids) {
        insertPerformer.run({ factId: f.id, personId });
      }
    }

    const insertTariff = db.prepare(`
      INSERT INTO sop_tariffs (
        id, sop_id, division_id, job_title, rate, rate_unit, valid_from, valid_to,
        status, approved_by_person_id, created_at, updated_at
      ) VALUES (
        @id, @sopId, @divisionId, @jobTitle, @rate, @rateUnit, @validFrom, @validTo,
        @status, @approvedByPersonId, @createdAt, @updatedAt
      )
    `);
    for (const t of /** @type {any[]} */ (state.tariffs)) insertTariff.run(t);

    const insertPeriod = db.prepare(`
      INSERT INTO timesheet_periods (
        id, division_id, period_label, date_from, date_to, status,
        checked_by_person_id, approved_by_person_id
      ) VALUES (
        @id, @divisionId, @periodLabel, @dateFrom, @dateTo, @status,
        @checkedByPersonId, @approvedByPersonId
      )
    `);
    for (const p of /** @type {any[]} */ (state.periods)) insertPeriod.run(p);

    const insertEntry = db.prepare(`
      INSERT INTO timesheet_entries (
        id, period_id, person_id, status, division_coefficient_id, person_coefficient_id
      ) VALUES (
        @id, @periodId, @personId, @status, @divisionCoefficientId, @personCoefficientId
      )
    `);
    for (const e of /** @type {any[]} */ (state.entries)) insertEntry.run(e);

    const insertLine = db.prepare(`
      INSERT INTO timesheet_lines (
        id, entry_id, fact_id, sop_id, sop_name, sop_version, fact_date,
        quantity, applied_rate, applied_unit, amount, status, adjustment_comment
      ) VALUES (
        @id, @entryId, @factId, @sopId, @sopName, @sopVersion, @factDate,
        @quantity, @appliedRate, @appliedUnit, @amount, @status, @adjustmentComment
      )
    `);
    for (const l of /** @type {any[]} */ (state.lines)) {
      insertLine.run({
        id: l.id,
        entryId: l.entryId,
        factId: l.factId,
        sopId: l.sopId,
        sopName: l.sopName,
        sopVersion: l.sopVersion,
        factDate: l.factDate,
        quantity: l.quantity,
        appliedRate: l.appliedRate,
        appliedUnit: l.appliedUnit ?? null,
        amount: l.amount,
        status: l.status,
        adjustmentComment: l.adjustmentComment ?? null,
      });
    }

    const insertCoef = db.prepare(`
      INSERT INTO period_coefficients (
        id, scope, target_id, period_id, value, reason, set_by_person_id, status
      ) VALUES (
        @id, @scope, @targetId, @periodId, @value, @reason, @setByPersonId, @status
      )
    `);
    for (const c of /** @type {any[]} */ (state.coefficients)) insertCoef.run(c);

    const insertAccrual = db.prepare(`
      INSERT INTO bonus_penalties (
        id, person_id, entry_id, type, amount, reason, linked_deviation_id,
        applied_by_person_id, decided_at, status
      ) VALUES (
        @id, @personId, @entryId, @type, @amount, @reason, @linkedDeviationId,
        @appliedByPersonId, @decidedAt, @status
      )
    `);
    for (const a of /** @type {any[]} */ (state.accruals)) insertAccrual.run(a);

    const insertPlan = db.prepare(`
      INSERT INTO work_plan_items (
        id, sop_id, person_id, division_id, planned_date, object_label,
        planned_quantity, status, source, fact_id, created_by_person_id, assignment_id
      ) VALUES (
        @id, @sopId, @personId, @divisionId, @plannedDate, @objectLabel,
        @plannedQuantity, @status, @source, @factId, @createdByPersonId, @assignmentId
      )
    `);
    for (const p of /** @type {any[]} */ (state.planItems ?? [])) {
      insertPlan.run({
        ...p,
        assignmentId: p.assignmentId ?? null,
      });
    }

    const insertDayTemplate = db.prepare(`
      INSERT INTO day_plan_templates (
        id, name, division_id, created_by_person_id, status
      ) VALUES (
        @id, @name, @divisionId, @createdByPersonId, @status
      )
    `);
    const insertDayLine = db.prepare(`
      INSERT INTO day_plan_lines (
        id, template_id, sop_id, object_label, planned_quantity, sort_order
      ) VALUES (
        @id, @templateId, @sopId, @objectLabel, @plannedQuantity, @sortOrder
      )
    `);
    for (const t of /** @type {any[]} */ (state.dayPlanTemplates ?? [])) {
      insertDayTemplate.run({
        id: t.id,
        name: t.name,
        divisionId: t.divisionId,
        createdByPersonId: t.createdByPersonId,
        status: t.status,
      });
      for (const line of t.lines ?? []) {
        insertDayLine.run({
          id: line.id,
          templateId: t.id,
          sopId: line.sopId,
          objectLabel: line.objectLabel,
          plannedQuantity: line.plannedQuantity,
          sortOrder: line.sortOrder,
        });
      }
    }

    const insertWeekTemplate = db.prepare(`
      INSERT INTO week_plan_templates (
        id, name, division_id, created_by_person_id, status
      ) VALUES (
        @id, @name, @divisionId, @createdByPersonId, @status
      )
    `);
    const insertWeekSlot = db.prepare(`
      INSERT INTO week_plan_slots (template_id, weekday, day_template_id)
      VALUES (@templateId, @weekday, @dayTemplateId)
    `);
    for (const t of /** @type {any[]} */ (state.weekPlanTemplates ?? [])) {
      insertWeekTemplate.run({
        id: t.id,
        name: t.name,
        divisionId: t.divisionId,
        createdByPersonId: t.createdByPersonId,
        status: t.status,
      });
      for (const slot of t.slots ?? []) {
        insertWeekSlot.run({
          templateId: t.id,
          weekday: slot.weekday,
          dayTemplateId: slot.dayTemplateId,
        });
      }
    }

    const insertAssignment = db.prepare(`
      INSERT INTO week_plan_assignments (
        id, week_template_id, person_id, division_id, week_start, status,
        assigned_by_person_id, acknowledged_at, reject_comment
      ) VALUES (
        @id, @weekTemplateId, @personId, @divisionId, @weekStart, @status,
        @assignedByPersonId, @acknowledgedAt, @rejectComment
      )
    `);
    for (const a of /** @type {any[]} */ (state.weekPlanAssignments ?? [])) {
      insertAssignment.run(a);
    }

    const insertPayScheme = db.prepare(`
      INSERT INTO pay_schemes (
        id, name, regulation_ref, division_id, site_key, job_title, status,
        components_json, approved_by_person_id, created_at, updated_at
      ) VALUES (
        @id, @name, @regulationRef, @divisionId, @siteKey, @jobTitle, @status,
        @componentsJson, @approvedByPersonId, @createdAt, @updatedAt
      )
    `);
    for (const s of /** @type {any[]} */ (state.paySchemes ?? [])) {
      insertPayScheme.run({
        id: s.id,
        name: s.name,
        regulationRef: s.regulationRef,
        divisionId: s.divisionId,
        siteKey: s.siteKey,
        jobTitle: s.jobTitle,
        status: s.status,
        componentsJson: JSON.stringify(s.components ?? []),
        approvedByPersonId: s.approvedByPersonId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      });
    }

    const insertTransfer = db.prepare(`
      INSERT INTO animal_transfers (
        id, person_id, division_id, site_key, event_date, animal_type, weight_kg, object_label
      ) VALUES (
        @id, @personId, @divisionId, @siteKey, @eventDate, @animalType, @weightKg, @objectLabel
      )
    `);
    for (const t of /** @type {any[]} */ (state.animalTransfers ?? [])) {
      insertTransfer.run(t);
    }

    const insertGain = db.prepare(`
      INSERT INTO weight_gains (
        id, person_id, division_id, site_key, period_id, centners
      ) VALUES (
        @id, @personId, @divisionId, @siteKey, @periodId, @centners
      )
    `);
    for (const g of /** @type {any[]} */ (state.weightGains ?? [])) {
      insertGain.run(g);
    }

    const insertShift = db.prepare(`
      INSERT INTO work_shifts (
        id, person_id, division_id, site_key, shift_date, checklist_json
      ) VALUES (
        @id, @personId, @divisionId, @siteKey, @shiftDate, @checklistJson
      )
    `);
    for (const s of /** @type {any[]} */ (state.workShifts ?? [])) {
      insertShift.run({
        id: s.id,
        personId: s.personId,
        divisionId: s.divisionId,
        siteKey: s.siteKey,
        shiftDate: s.shiftDate,
        checklistJson: JSON.stringify(s.checklist ?? {}),
      });
    }

    const insertInsem = db.prepare(`
      INSERT INTO insemination_results (
        id, person_id, division_id, site_key, event_date, mode, semen_type,
        attempt_number, pregnant, object_label
      ) VALUES (
        @id, @personId, @divisionId, @siteKey, @eventDate, @mode, @semenType,
        @attemptNumber, @pregnant, @objectLabel
      )
    `);
    for (const i of /** @type {any[]} */ (state.inseminations ?? [])) {
      insertInsem.run({
        id: i.id,
        personId: i.personId,
        divisionId: i.divisionId,
        siteKey: i.siteKey,
        eventDate: i.eventDate,
        mode: i.mode,
        semenType: i.semenType,
        attemptNumber: i.attemptNumber,
        pregnant: i.pregnant ? 1 : 0,
        objectLabel: i.objectLabel,
      });
    }

    const insertKpi = db.prepare(`
      INSERT INTO period_kpis (
        id, period_id, division_id, site_key, person_id, metrics_json
      ) VALUES (
        @id, @periodId, @divisionId, @siteKey, @personId, @metricsJson
      )
    `);
    for (const k of /** @type {any[]} */ (state.periodKpis ?? [])) {
      insertKpi.run({
        id: k.id,
        periodId: k.periodId,
        divisionId: k.divisionId,
        siteKey: k.siteKey,
        personId: k.personId,
        metricsJson: JSON.stringify(k.metrics ?? {}),
      });
    }

    db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run(
      "currentRoleId",
      state.currentRoleId ?? "specialist",
    );
  });

  tx();
}
