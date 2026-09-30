PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS persons (
  id                TEXT PRIMARY KEY,
  full_name         TEXT NOT NULL,
  personnel_number  TEXT NOT NULL UNIQUE,
  division_id       TEXT NOT NULL,
  job_title         TEXT NOT NULL,
  status            TEXT NOT NULL,
  hired_at          TEXT NOT NULL,
  access_role_id    TEXT
);

CREATE TABLE IF NOT EXISTS divisions (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  parent_id       TEXT,
  farm_name       TEXT NOT NULL,
  head_person_id  TEXT NOT NULL,
  status          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sops (
  id                TEXT PRIMARY KEY,
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  level             TEXT NOT NULL,
  parent_id         TEXT,
  version           TEXT NOT NULL,
  status            TEXT NOT NULL,
  owner_person_id   TEXT NOT NULL,
  effective_from    TEXT NOT NULL,
  method_summary    TEXT NOT NULL,
  operation_object  TEXT,
  norm_unit         TEXT,
  is_tariffable     INTEGER
);

CREATE TABLE IF NOT EXISTS sop_facts (
  id                   TEXT PRIMARY KEY,
  sop_id               TEXT NOT NULL,
  sop_version          TEXT NOT NULL,
  object_label         TEXT NOT NULL,
  fact_date            TEXT NOT NULL,
  fact_status          TEXT NOT NULL,
  quantity             REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sop_fact_performers (
  fact_id   TEXT NOT NULL,
  person_id TEXT NOT NULL,
  PRIMARY KEY (fact_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_fact_performers_person ON sop_fact_performers(person_id);

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
);

CREATE INDEX IF NOT EXISTS idx_plan_person_date ON work_plan_items(person_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_plan_division_date ON work_plan_items(division_id, planned_date);

CREATE TABLE IF NOT EXISTS day_plan_templates (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  division_id             TEXT NOT NULL,
  created_by_person_id    TEXT NOT NULL,
  status                  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS day_plan_lines (
  id                  TEXT PRIMARY KEY,
  template_id         TEXT NOT NULL,
  sop_id              TEXT NOT NULL,
  object_label        TEXT NOT NULL,
  planned_quantity    REAL NOT NULL DEFAULT 1,
  sort_order          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_day_plan_lines_template ON day_plan_lines(template_id);

CREATE TABLE IF NOT EXISTS week_plan_templates (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  division_id             TEXT NOT NULL,
  created_by_person_id    TEXT NOT NULL,
  status                  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS week_plan_slots (
  template_id       TEXT NOT NULL,
  weekday           INTEGER NOT NULL,
  day_template_id   TEXT,
  PRIMARY KEY (template_id, weekday)
);

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
);

CREATE INDEX IF NOT EXISTS idx_wpa_person_week ON week_plan_assignments(person_id, week_start);
CREATE INDEX IF NOT EXISTS idx_wpa_division ON week_plan_assignments(division_id);

CREATE TABLE IF NOT EXISTS sop_tariffs (
  id                     TEXT PRIMARY KEY,
  sop_id                 TEXT NOT NULL,
  division_id            TEXT NOT NULL,
  job_title              TEXT,
  rate                   REAL NOT NULL,
  rate_unit              TEXT NOT NULL DEFAULT 'operation',
  valid_from             TEXT NOT NULL,
  valid_to               TEXT,
  status                 TEXT NOT NULL,
  approved_by_person_id  TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pay_schemes (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  regulation_ref         TEXT NOT NULL,
  division_id            TEXT NOT NULL,
  site_key               TEXT NOT NULL,
  job_title              TEXT,
  status                 TEXT NOT NULL,
  components_json        TEXT NOT NULL,
  approved_by_person_id  TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS animal_transfers (
  id               TEXT PRIMARY KEY,
  person_id        TEXT NOT NULL,
  division_id      TEXT NOT NULL,
  site_key         TEXT NOT NULL,
  event_date       TEXT NOT NULL,
  animal_type      TEXT NOT NULL,
  weight_kg        REAL,
  object_label     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weight_gains (
  id               TEXT PRIMARY KEY,
  person_id        TEXT NOT NULL,
  division_id      TEXT NOT NULL,
  site_key         TEXT NOT NULL,
  period_id        TEXT NOT NULL,
  centners         REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS work_shifts (
  id               TEXT PRIMARY KEY,
  person_id        TEXT NOT NULL,
  division_id      TEXT NOT NULL,
  site_key         TEXT NOT NULL,
  shift_date       TEXT NOT NULL,
  checklist_json   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insemination_results (
  id               TEXT PRIMARY KEY,
  person_id        TEXT NOT NULL,
  division_id      TEXT NOT NULL,
  site_key         TEXT NOT NULL,
  event_date       TEXT NOT NULL,
  mode             TEXT NOT NULL,
  semen_type       TEXT NOT NULL,
  attempt_number   INTEGER NOT NULL,
  pregnant         INTEGER NOT NULL,
  object_label     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS period_kpis (
  id               TEXT PRIMARY KEY,
  period_id        TEXT NOT NULL,
  division_id      TEXT NOT NULL,
  site_key         TEXT NOT NULL,
  person_id        TEXT,
  metrics_json     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timesheet_periods (
  id                     TEXT PRIMARY KEY,
  division_id            TEXT NOT NULL,
  period_label           TEXT NOT NULL,
  date_from              TEXT NOT NULL,
  date_to                TEXT NOT NULL,
  status                 TEXT NOT NULL,
  checked_by_person_id   TEXT,
  approved_by_person_id  TEXT
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id                        TEXT PRIMARY KEY,
  period_id                 TEXT NOT NULL,
  person_id                 TEXT NOT NULL,
  status                    TEXT NOT NULL,
  division_coefficient_id   TEXT,
  person_coefficient_id     TEXT
);

CREATE TABLE IF NOT EXISTS timesheet_lines (
  id                   TEXT PRIMARY KEY,
  entry_id             TEXT NOT NULL,
  fact_id              TEXT,
  sop_id               TEXT NOT NULL,
  sop_name             TEXT NOT NULL,
  sop_version          TEXT NOT NULL,
  fact_date            TEXT NOT NULL,
  quantity             REAL NOT NULL DEFAULT 1,
  applied_rate         REAL,
  applied_unit         TEXT,
  amount               REAL,
  status               TEXT NOT NULL,
  adjustment_comment   TEXT
);

CREATE TABLE IF NOT EXISTS period_coefficients (
  id                TEXT PRIMARY KEY,
  scope             TEXT NOT NULL,
  target_id         TEXT NOT NULL,
  period_id         TEXT NOT NULL,
  value             REAL NOT NULL,
  reason            TEXT NOT NULL,
  set_by_person_id  TEXT NOT NULL,
  status            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bonus_penalties (
  id                    TEXT PRIMARY KEY,
  person_id             TEXT NOT NULL,
  entry_id              TEXT NOT NULL,
  type                  TEXT NOT NULL,
  amount                REAL NOT NULL,
  reason                TEXT NOT NULL,
  linked_deviation_id   TEXT,
  applied_by_person_id  TEXT NOT NULL,
  decided_at            TEXT NOT NULL,
  status                TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_facts_date ON sop_facts(fact_date);
CREATE INDEX IF NOT EXISTS idx_lines_entry ON timesheet_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_entries_period ON timesheet_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_tariffs_sop ON sop_tariffs(sop_id);
