// A8: persistence for voice reports and mission states.
// STORE=memory (default) keeps data in process memory; STORE=supabase uses the Supabase REST API.
// The Supabase store falls back to memory on any error or timeout so the demo never hangs.
// Tables: see supabase.sql. Rows hold the full contract object as jsonb, so additive contract
// fields need no migration.
import type { MissionState, Report } from "@contracts/types";

export interface Store {
  readonly kind: "memory" | "supabase";
  addReport(report: Report): Promise<Report>;
  /** Reports created after `since` (ISO), oldest first. */
  listReports(since?: string): Promise<Report[]>;
  /** Stored state, or a fresh open state if the mission was never touched. */
  getMissionState(missionId: string): Promise<MissionState>;
  listMissionStates(): Promise<MissionState[]>;
  saveMissionState(state: MissionState): Promise<MissionState>;
  /** Remove all reports (demo reset, A15). */
  clearReports(): Promise<void>;
  /** Reset every mission to open (demo reset, A15). */
  clearMissionStates(): Promise<void>;
}

const TIMEOUT_MS = 8000;

export function openState(missionId: string): MissionState {
  return { missionId, status: "open", supporters: 0 };
}

export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private reports: Report[] = [];
  private states = new Map<string, MissionState>();

  async addReport(report: Report) {
    this.reports.push(report);
    return report;
  }

  async listReports(since?: string) {
    const after = since ? Date.parse(since) : -Infinity;
    return this.reports
      .filter((r) => Date.parse(r.createdAt) > after)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getMissionState(missionId: string) {
    return this.states.get(missionId) ?? openState(missionId);
  }

  async listMissionStates() {
    return [...this.states.values()];
  }

  async saveMissionState(state: MissionState) {
    this.states.set(state.missionId, state);
    return state;
  }

  async clearReports() {
    this.reports = [];
  }

  async clearMissionStates() {
    this.states.clear();
  }
}

export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;

  private url: string;
  private key: string;
  private fallback: Store;

  constructor(url: string, key: string, fallback: Store = new MemoryStore()) {
    this.url = url;
    this.key = key;
    this.fallback = fallback;
  }

  private async rest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** Run a Supabase call; on failure log once and use the in-memory fallback instead. */
  private async safe<T>(label: string, call: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (err) {
      console.error(`store: ${label} failed, using memory fallback`, err);
      return fallback();
    }
  }

  addReport(report: Report) {
    return this.safe(
      "addReport",
      async () => {
        await this.rest("reports", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ id: report.id, created_at: report.createdAt, data: report }),
        });
        return report;
      },
      () => this.fallback.addReport(report),
    );
  }

  listReports(since?: string) {
    const filter = since ? `&created_at=gt.${encodeURIComponent(since)}` : "";
    return this.safe(
      "listReports",
      async () => {
        const rows = await this.rest<{ data: Report }[]>(`reports?select=data&order=created_at.asc${filter}`);
        return rows.map((r) => r.data);
      },
      () => this.fallback.listReports(since),
    );
  }

  getMissionState(missionId: string) {
    return this.safe(
      "getMissionState",
      async () => {
        const rows = await this.rest<{ data: MissionState }[]>(
          `mission_states?select=data&mission_id=eq.${encodeURIComponent(missionId)}`,
        );
        return rows[0]?.data ?? openState(missionId);
      },
      () => this.fallback.getMissionState(missionId),
    );
  }

  listMissionStates() {
    return this.safe(
      "listMissionStates",
      async () => {
        const rows = await this.rest<{ data: MissionState }[]>("mission_states?select=data");
        return rows.map((r) => r.data);
      },
      () => this.fallback.listMissionStates(),
    );
  }

  saveMissionState(state: MissionState) {
    return this.safe(
      "saveMissionState",
      async () => {
        await this.rest("mission_states", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ mission_id: state.missionId, data: state, updated_at: new Date().toISOString() }),
        });
        return state;
      },
      () => this.fallback.saveMissionState(state),
    );
  }

  clearReports() {
    return this.safe(
      "clearReports",
      () => this.rest<void>("reports?id=not.is.null", { method: "DELETE" }),
      () => this.fallback.clearReports(),
    );
  }

  clearMissionStates() {
    return this.safe(
      "clearMissionStates",
      () => this.rest<void>("mission_states?mission_id=not.is.null", { method: "DELETE" }),
      () => this.fallback.clearMissionStates(),
    );
  }
}

export function createStore(env: Record<string, string | undefined> = process.env): Store {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (env.STORE === "supabase") {
    if (url && key) return new SupabaseStore(url.replace(/\/$/, ""), key);
    console.warn("store: STORE=supabase but Supabase env vars are missing, using memory");
  }
  return new MemoryStore();
}

// One store per server process; kept on globalThis so dev hot reloads don't wipe memory data.
const g = globalThis as typeof globalThis & { __hwStore?: Store };

export function getStore(): Store {
  g.__hwStore ??= createStore();
  return g.__hwStore;
}
