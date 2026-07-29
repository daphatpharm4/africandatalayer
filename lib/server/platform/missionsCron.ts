// lib/server/platform/missionsCron.ts
// Daily mission auto-generation. For every active organization: upserts
// today's (UTC) daily mission (quota 5, reward 10 XP), assigns it to every
// current collector, and refreshes each collector's progress from today's
// platform_records. Wired into api/cron/daily-missions.ts (CRON_SECRET-gated).
// See docs/superpowers/specs/2026-07-24-ios-console-missions-gamification-design.md
import { query } from "../db.js";
import { listMembers } from "./orgStore.js";
import { assignMissionToUsers, refreshAssignmentProgress, upsertDailyMissionDefinition } from "./missionStore.js";
import type { QueryFn, StoreDeps } from "./orgStore.js";

const DAILY_MISSION_QUOTA = 5;
const DAILY_MISSION_REWARD_XP = 10;
const DAILY_MISSION_TITLE_EN = "Daily submissions";
const DAILY_MISSION_TITLE_FR = "Soumissions quotidiennes";

export interface DailyMissionOrgResult {
  organizationId: string;
  missionId: string;
  created: boolean;
  collectorsAssigned: number;
}

export interface DailyMissionGenerationSummary {
  evaluatedAtUtc: string;
  organizations: DailyMissionOrgResult[];
  hasFailures: boolean;
  errors: Array<{ organizationId: string; message: string }>;
}

export interface MissionsCronDeps {
  queryFn?: QueryFn;
  listActiveOrganizationIdsFn?: (deps: StoreDeps) => Promise<string[]>;
  listMembersFn?: typeof listMembers;
  upsertDailyMissionDefinitionFn?: typeof upsertDailyMissionDefinition;
  assignMissionToUsersFn?: typeof assignMissionToUsers;
  refreshAssignmentProgressFn?: typeof refreshAssignmentProgress;
}

async function listActiveOrganizationIds(deps: StoreDeps): Promise<string[]> {
  const run = deps.queryFn ?? (query as unknown as QueryFn);
  const result = await run(
    `SELECT id FROM public.platform_organizations WHERE access_status = 'active' ORDER BY created_at ASC`,
    [],
  );
  return result.rows.map((row: { id: string }) => row.id);
}

export async function runDailyMissionGenerationCron(
  deps: MissionsCronDeps = {},
  now: Date = new Date(),
): Promise<DailyMissionGenerationSummary> {
  const storeDeps: StoreDeps = { queryFn: deps.queryFn };
  const listActiveOrganizationIdsFn = deps.listActiveOrganizationIdsFn ?? listActiveOrganizationIds;
  const listMembersFn = deps.listMembersFn ?? listMembers;
  const upsertDailyMissionDefinitionFn = deps.upsertDailyMissionDefinitionFn ?? upsertDailyMissionDefinition;
  const assignMissionToUsersFn = deps.assignMissionToUsersFn ?? assignMissionToUsers;
  const refreshAssignmentProgressFn = deps.refreshAssignmentProgressFn ?? refreshAssignmentProgress;

  const organizationIds = await listActiveOrganizationIdsFn(storeDeps);
  const organizations: DailyMissionOrgResult[] = [];
  const errors: Array<{ organizationId: string; message: string }> = [];

  for (const organizationId of organizationIds) {
    try {
      const { mission, created } = await upsertDailyMissionDefinitionFn(
        {
          organizationId,
          quota: DAILY_MISSION_QUOTA,
          rewardXp: DAILY_MISSION_REWARD_XP,
          titleEn: DAILY_MISSION_TITLE_EN,
          titleFr: DAILY_MISSION_TITLE_FR,
        },
        storeDeps,
      );

      const members = await listMembersFn(organizationId, storeDeps);
      const collectorIds = members.filter((member) => member.role === "collector").map((member) => member.userId);

      await assignMissionToUsersFn({ missionId: mission.id, userIds: collectorIds }, storeDeps);

      for (const userId of collectorIds) {
        await refreshAssignmentProgressFn({ mission, userId, now }, storeDeps);
      }

      organizations.push({ organizationId, missionId: mission.id, created, collectorsAssigned: collectorIds.length });
    } catch (error) {
      errors.push({ organizationId, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    evaluatedAtUtc: now.toISOString(),
    organizations,
    hasFailures: errors.length > 0,
    errors,
  };
}
