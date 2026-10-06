// Shared plans: what I send to friends, and reading a friend's file (a shared plan, or a plain agenda export).
import { toValidationErrors } from '../profile/schema';
import { AGENDA_KIND, AgendaExportSchema, SHARED_PLAN_KIND, SharedPlanExportSchema, type AgendaExport } from '../stateSchema';
import type { Profile, Result, SharedPlan } from '../types';

export function buildSharedPlanExport({
  agenda,
  sourceId,
  displayName,
  profile,
}: {
  agenda: AgendaExport;
  sourceId: string;
  displayName: string;
  profile: Profile | null;
}): Record<string, unknown> {
  const { exportedAt, items, starred, scores = [] } = agenda;
  return { kind: SHARED_PLAN_KIND, version: 1, sourceId, displayName, exportedAt, profile, items, starred, scores };
}

// A plain agenda file has no name or profile in it, so it needs `nameOverride` and yields profile = null.
export function parseSharedPlan(
  raw: unknown,
  nameOverride: string,
): Result<{ sourceId: string | null; displayName: string; profile: Profile | null; plan: SharedPlan }> {
  if ((raw as { kind?: unknown } | null)?.kind === AGENDA_KIND) {
    const parsed = AgendaExportSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, errors: toValidationErrors(parsed.error) };
    if (!nameOverride) return { ok: false, errors: [{ path: 'name', message: 'An agenda file has no name in it: enter whose plan this is' }] };
    const { exportedAt, items, starred, scores = [] } = parsed.data;
    return { ok: true, value: { sourceId: null, displayName: nameOverride, profile: null, plan: { exportedAt, items, starred, scores } } };
  }
  const parsed = SharedPlanExportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: toValidationErrors(parsed.error) };
  const { sourceId, displayName, profile, exportedAt, items, starred, scores } = parsed.data;
  return { ok: true, value: { sourceId, displayName, profile: profile as Profile | null, plan: { exportedAt, items, starred, scores } } };
}
