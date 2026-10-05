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
