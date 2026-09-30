import type { AppAction } from "./actions";
import type { AppState } from "./reducer";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchAppState(): Promise<AppState> {
  const res = await fetch(`${API_BASE}/api/v1/state`);
  return parseJson<AppState>(res);
}

export async function postAppAction(action: AppAction): Promise<AppState> {
  const res = await fetch(`${API_BASE}/api/v1/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  return parseJson<AppState>(res);
}

export async function resetAppState(): Promise<AppState> {
  const res = await fetch(`${API_BASE}/api/v1/reset`, { method: "POST" });
  return parseJson<AppState>(res);
}
