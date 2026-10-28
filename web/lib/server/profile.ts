// Profile for signed-in users: their reports and the missions they claimed, supported or completed.
// Activity is logged next to the normal action and never blocks or fails it.
import type { ActivityKind, Profile, ProfileMission, UserProfile } from "@contracts/types";
import { listMissions, type MissionDeps } from "./missions.ts";
import { getStore, type Store } from "./store.ts";

export async function recordActivity(
  user: UserProfile | null, kind: ActivityKind, ref: string, d: { store?: Store; now?: number } = {},
): Promise<void> {
  if (!user) return;
  try {
    await (d.store ?? getStore()).addActivity({
      userId: user.id, kind, ref, at: new Date(d.now ?? Date.now()).toISOString(),
    });
  } catch (err) {
    console.error("profile: could not log activity", err);
  }
}

export async function buildProfile(user: UserProfile, d: MissionDeps = {}): Promise<Profile> {
  const store = d.store ?? getStore();
  const [activity, reports, missions] = await Promise.all([
    store.listActivity(user.id), store.listReports(), listMissions(d),
  ]);

  const reportIds = new Set(activity.filter((a) => a.kind === "report").map((a) => a.ref));
  const mine = reports.filter((r) => reportIds.has(r.id)).reverse();

  const byMission = new Map<string, { actions: Set<ActivityKind>; lastAt: string }>();
  for (const a of activity) {
    if (a.kind === "report") continue;
    const entry = byMission.get(a.ref) ?? { actions: new Set<ActivityKind>(), lastAt: a.at };
    entry.actions.add(a.kind);
    if (a.at > entry.lastAt) entry.lastAt = a.at;
    byMission.set(a.ref, entry);
  }
  const missionById = new Map(missions.map((m) => [m.id, m]));
  const profileMissions: ProfileMission[] = [...byMission]
    .filter(([id]) => missionById.has(id)) // expired or removed missions drop out
    .map(([id, e]) => ({ mission: missionById.get(id)!, actions: [...e.actions], lastAt: e.lastAt }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  const did = (kind: ActivityKind) => profileMissions.filter((m) => m.actions.includes(kind)).length;
  return {
    user,
    reports: mine,
    missions: profileMissions,
    counts: { reports: mine.length, claimed: did("claim"), supported: did("support"), done: did("done") },
  };
}
