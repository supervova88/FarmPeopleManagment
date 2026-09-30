import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { openDatabase, isDatabaseEmpty, loadAppState, saveAppState } from "./repository.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const dbPath = process.env.SQLITE_PATH ?? path.join(dataDir, "m-complex.db");
const API_PORT = Number(process.env.API_PORT ?? 3001);
const HOST = process.env.API_HOST ?? "0.0.0.0";

const localEsbuild = path.join(os.homedir(), "AppData", "Local", "esbuild-bin", "esbuild.exe");
if (fs.existsSync(localEsbuild)) {
  process.env.ESBUILD_BINARY_PATH = localEsbuild;
}

const db = openDatabase(dbPath);

const vite = await createViteServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { middlewareMode: true },
  appType: "custom",
});

const { createInitialState, appReducer } = await vite.ssrLoadModule("/src/app/store/reducer.ts");

function ensureSeeded() {
  if (isDatabaseEmpty(db)) {
    const initial = createInitialState();
    saveAppState(db, initial);
    console.log(`[api] seeded SQLite: ${dbPath}`);
    return;
  }

  // Миграция: старые БД без календарного плана — дозаполнить planItems из сида
  const planCount = db.prepare("SELECT COUNT(*) AS n FROM work_plan_items").get();
  if (planCount.n === 0) {
    const state = loadAppState(db);
    const initial = createInitialState();
    state.planItems = initial.planItems;
    // Табельные записи сентября для сотрудников с планом
    for (const entry of initial.entries) {
      if (!state.entries.some((e) => e.id === entry.id)) {
        state.entries.push(entry);
      }
    }
    saveAppState(db, state);
    console.log(`[api] backfilled work_plan_items: ${initial.planItems.length}`);
  }

  // Миграция: шаблоны дня/недели и назначения
  const dayTplCount = db.prepare("SELECT COUNT(*) AS n FROM day_plan_templates").get();
  if (dayTplCount.n === 0) {
    const state = loadAppState(db);
    const initial = createInitialState();
    state.dayPlanTemplates = initial.dayPlanTemplates;
    state.weekPlanTemplates = initial.weekPlanTemplates;
    if ((state.weekPlanAssignments ?? []).length === 0) {
      state.weekPlanAssignments = initial.weekPlanAssignments;
      // Проставить assignmentId у демо-задач Петровой, если ещё нет
      const byId = new Map(initial.planItems.map((p) => [p.id, p]));
      state.planItems = state.planItems.map((p) => {
        const seed = byId.get(p.id);
        if (seed?.assignmentId && !p.assignmentId) {
          return { ...p, assignmentId: seed.assignmentId };
        }
        return p;
      });
    }
    saveAppState(db, state);
    console.log(
      `[api] backfilled day/week plan templates: ${initial.dayPlanTemplates.length}/${initial.weekPlanTemplates.length}`,
    );
  }

  // Миграция: схемы оплаты по положению и входы
  try {
    const schemeCount = db.prepare("SELECT COUNT(*) AS n FROM pay_schemes").get();
    if (schemeCount.n === 0) {
      const state = loadAppState(db);
      const initial = createInitialState();
      state.paySchemes = initial.paySchemes;
      state.animalTransfers = initial.animalTransfers;
      state.weightGains = initial.weightGains;
      state.workShifts = initial.workShifts;
      state.inseminations = initial.inseminations;
      state.periodKpis = initial.periodKpis;
      // Обновить должность Иванова под мойку
      state.persons = state.persons.map((p) => {
        const seed = initial.persons.find((x) => x.id === p.id);
        return seed && p.id === "per-ivanov" ? { ...p, jobTitle: seed.jobTitle } : p;
      });
      saveAppState(db, state);
      console.log(`[api] backfilled pay_schemes: ${initial.paySchemes.length}`);
    }
  } catch (err) {
    console.warn("[api] pay_schemes backfill skipped:", err?.message ?? err);
  }
}

ensureSeeded();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, db: dbPath });
});

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>М-Комплекс API</title></head>
<body style="font-family:system-ui;padding:2rem;line-height:1.5">
  <h1>Это API, не интерфейс</h1>
  <p>Откройте UI: <a href="http://localhost:5174/">http://localhost:5174/</a></p>
  <p>Проверка API: <a href="/health">/health</a> · <a href="/api/v1/state">/api/v1/state</a></p>
</body></html>`);
});

app.get("/api/v1/state", (_req, res) => {
  try {
    res.json(loadAppState(db));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

app.post("/api/v1/action", (req, res) => {
  try {
    const action = req.body;
    if (!action || typeof action.type !== "string") {
      res.status(400).json({ error: "Body must be an AppAction with type" });
      return;
    }

    const current = loadAppState(db);
    const next = appReducer(current, action);
    saveAppState(db, next);
    res.json(next);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

app.post("/api/v1/reset", (_req, res) => {
  try {
    const next = createInitialState();
    saveAppState(db, next);
    res.json(next);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

const distDir = path.join(root, "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(API_PORT, HOST, () => {
  console.log(`[api] SQLite file: ${dbPath}`);
  console.log(`[api] listening on http://${HOST}:${API_PORT}`);
  console.log(`[api] LAN: http://<this-pc-ip>:${API_PORT}`);
});
