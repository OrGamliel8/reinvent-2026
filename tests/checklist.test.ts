import { describe, expect, it } from 'vitest';
import { add, openPlanner } from './helpers';

describe('reservation checklist', () => {
  it('orders by priority × scarcity: the single-slot 50-seat workshop comes first', async () => {
    const { planner } = await openPlanner();
    add(planner, 'ANT319-R1'); // 3 slots, 96 seats, chalk talk
    add(planner, 'SEC310'); // 2 slots, 800 seats, breakout
    add(planner, 'AIM350'); // 1 slot, 60 seats, builders' session
    add(planner, 'SEC401'); // 1 slot, 50 seats, workshop
    const checklist = planner.reservationChecklist();
    expect(checklist.map((c) => c.code)).toEqual(['SEC401', 'AIM350', 'ANT319-R1', 'SEC310']);
    expect(checklist[0]).toMatchObject({ title: 'Hands-on threat detection for agentic AI workloads', status: 'none', alternatives: [] });
    expect(checklist[0].slot).toMatchObject({ venue: 'venetian', seats: 50, room: 'Level 3 | Lido 3001' });
    expect(checklist[0].scarcity).toBeGreaterThan(checklist[3].scarcity);
  });

  it('shows each item\'s type, star and a link to its code in the official catalog', async () => {
    const { planner } = await openPlanner();
    add(planner, 'ANT319-R1');
    add(planner, 'SEC401');
    planner.star('SEC401');
    const byCode = new Map(planner.reservationChecklist().map((c) => [c.code, c]));
    expect(byCode.get('SEC401')).toMatchObject({
      type: 'Workshop',
      starred: true,
      portalUrl: 'https://registration.awsevents.com/flow/awsevents/reinvent2026/event-catalog/page/eventCatalog?search=SEC401',
    });
    expect(byCode.get('ANT319-R1')).toMatchObject({ type: 'Chalk talk', starred: false });
    expect(byCode.get('ANT319-R1')!.portalUrl).toMatch(/search=ANT319-R1$/);
  });

  it('optionally lists starred sessions that are not on the agenda, after the agenda, at a slot that fits', async () => {
    const { planner } = await openPlanner();
    add(planner, 'SEC401');
    planner.star('SEC401'); // on the agenda: listed once, as an agenda row
    planner.star('ANT319');
    expect(planner.reservationChecklist().map((c) => c.code)).toEqual(['SEC401']);

    const all = planner.reservationChecklist({ includeStarred: true });
    expect(all.map((c) => [c.code.replace(/-R\d*$/, ''), c.onAgenda, c.itemId === null])).toEqual([
      ['SEC401', true, false],
      ['ANT319', false, true],
    ]);
    const starredOnly = all[1];
    expect(starredOnly).toMatchObject({ starred: true, status: 'none', alternatives: [] });
    expect(planner.slotFit(starredOnly.slot.slotId)).toBe('free');
  });

  it('tracks statuses and suggests alternatives for failed reservations', async () => {
    const { planner } = await openPlanner();
    const sec = add(planner, 'SEC310');
    const ant = add(planner, 'ANT319-R1');
    planner.setReservationStatus(ant, 'reserved');
    planner.setReservationStatus(sec, 'failed');
    const checklist = planner.reservationChecklist();
    expect(checklist.find((c) => c.itemId === ant)).toMatchObject({ status: 'reserved', alternatives: [] });
    const failed = checklist.find((c) => c.itemId === sec)!;
    expect(failed.status).toBe('failed');
    expect(failed.alternatives[0]).toMatchObject({ kind: 'otherSlot', code: 'SEC310-R', fit: 'free' });
    expect(failed.alternatives.some((a) => a.kind === 'otherSession' && a.code === 'NET310')).toBe(true);
    expect(planner.agenda().find((i) => i.id === ant)!.reservation).toBe('reserved');
    for (const status of ['waitlisted', 'walk-up', 'none'] as const) {
      planner.setReservationStatus(ant, status);
      expect(planner.reservationChecklist().find((c) => c.itemId === ant)!.status).toBe(status);
    }
  });
});
