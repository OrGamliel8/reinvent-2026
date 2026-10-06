import { describe, expect, it } from 'vitest';
import { Planner } from '../src/core/planner';
import { add, buildCatalog, openPlanner } from './helpers';

// Plans an agenda on the v1 catalog, then reopens the same store on the v2 catalog (a refresh).
async function refreshScenario() {
  const { planner, store } = await openPlanner();
  const items = {
    ant: add(planner, 'ANT319-R1'), // v2: Wed 15:00 -> 16:30
    cmp: add(planner, 'CMP301'), // v2: Caesars Forum -> MGM Grand, 15 min before SEC360 at Caesars Forum
    sec360: add(planner, 'SEC360'),
    secR: add(planner, 'SEC310-R'), // v2: slot cancelled, SEC310 itself remains
    aim: add(planner, 'AIM350'), // v2: session removed
    sec401: add(planner, 'SEC401'), // unchanged
  };
  planner.star('IAM333'); // TBA in v1, scheduled in v2
  expect(planner.detectChanges()).toEqual([]);
  const refreshed = Planner.open({ catalog: await buildCatalog('catalog-v2.json'), store });
  return { planner: refreshed, items };
}

describe('change detection', () => {
  it('produces one alert per change, of the right kind', async () => {
    const { planner, items } = await refreshScenario();
    const alerts = planner.detectChanges();
    const summary = alerts.map((a) => [a.kind, a.itemId ?? a.sessionKey]).sort();
    expect(summary).toEqual(
      [
        ['cancelled', items.secR],
        ['moved', items.ant],
        ['moved', items.cmp],
        ['newConflict', items.cmp],
        ['removed', items.aim],
        ['tbaScheduled', 'IAM333'],
      ].sort(),
    );

    const moved = alerts.filter((a) => a.kind === 'moved' && a.itemId === items.ant);
    expect(moved).toHaveLength(1);
    expect(moved[0].before).toMatchObject({ start: '2026-12-02T23:00:00.000Z', venue: 'wynn' });
    expect(moved[0].after).toMatchObject({ start: '2026-12-03T00:30:00.000Z', venue: 'wynn', exists: true });
    expect(moved[0].message).toMatch(/Wed Dec 2 15:00–16:00.*→ Wed Dec 2 16:30–17:30/);

    expect(alerts.find((a) => a.kind === 'newConflict')!.message).toMatch(/Only 15 min from MGM Grand to Caesars Forum/);
    expect(alerts.find((a) => a.kind === 'removed')).toMatchObject({ title: 'Build guardrails for production AI agents', after: { exists: false } });
    expect(alerts.find((a) => a.kind === 'tbaScheduled')).toMatchObject({ itemId: null, before: null, after: { venue: 'venetian' } });
  });

  it('uses deterministic ids so dismissals survive re-detection', async () => {
    const { planner } = await refreshScenario();
    const first = planner.detectChanges();
    expect(planner.detectChanges().map((a) => a.id)).toEqual(first.map((a) => a.id));
    const tba = first.find((a) => a.kind === 'tbaScheduled')!;
    planner.dismissAlert(tba.id);
    const after = planner.detectChanges();
    expect(after.map((a) => a.id)).not.toContain(tba.id);
    expect(after).toHaveLength(first.length - 1);
  });

  it('accepting a move re-fingerprints the item; accepting a cancellation removes it', async () => {
    const { planner, items } = await refreshScenario();
    const alerts = planner.detectChanges();
    planner.acceptChange(alerts.find((a) => a.kind === 'moved' && a.itemId === items.ant)!.id);
    expect(planner.agenda().find((i) => i.id === items.ant)!.fingerprint.start).toBe('2026-12-03T00:30:00.000Z');

    planner.acceptChange(alerts.find((a) => a.kind === 'newConflict')!.id);
    planner.acceptChange(alerts.find((a) => a.kind === 'cancelled')!.id);
    planner.acceptChange(alerts.find((a) => a.kind === 'tbaScheduled')!.id);
    const remaining = planner.detectChanges();
    expect(remaining.map((a) => a.kind)).toEqual(['removed']);
    expect(planner.agenda().map((i) => i.id)).not.toContain(items.secR);
    // The travel conflict itself is still visible until it is resolved.
    expect(planner.conflicts().filter((c) => c.kind !== 'venueSwitches')).toMatchObject([{ itemId: items.sec360, kind: 'travel', withId: items.cmp }]);
    expect(() => planner.acceptChange('nope')).toThrow();
  });

  it('offers alternatives for a cancelled slot and lets auto-build re-plan', async () => {
    const { planner, items } = await refreshScenario();
    const cancelled = planner.detectChanges().find((a) => a.kind === 'cancelled')!;
    const alternatives = planner.alternatives({ sessionKey: cancelled.sessionKey });
    expect(alternatives[0]).toMatchObject({ kind: 'otherSlot', code: 'SEC310' });

    planner.autoBuild();
    const sec310 = planner.agenda().find((i) => i.id === items.secR)!;
    expect(planner.session('SEC310')!.slots.map((s) => s.slotId)).toContain(sec310.slotId);
    expect(planner.detectChanges().map((a) => a.kind)).not.toContain('cancelled');
  });
});
