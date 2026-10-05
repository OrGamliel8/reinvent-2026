import { describe, expect, it } from 'vitest';
import { add, openPlanner } from './helpers';

const unfold = (ics: string): string => ics.replace(/\r\n /g, '');

describe('.ics export', () => {
  it('exports one UTC event per agenda item with code, title, venue, room, abstract and link', async () => {
    const { planner } = await openPlanner();
    add(planner, 'SEC401');
    add(planner, 'ANT319-R1');
    const ics = planner.exportIcs({ includePersonal: false });

    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);

    const text = unfold(ics);
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(text).toContain('DTSTART:20261130T180000Z');
    expect(text).toContain('DTEND:20261130T200000Z');
    expect(text).toContain('DTSTART:20261202T230000Z');
    expect(text).toContain('SUMMARY:SEC401 – Hands-on threat detection for agentic AI workloads');
    expect(text).toContain('SUMMARY:ANT319-R1 – Building agentic data lakes with Amazon Bedrock and Apache Iceberg');
    expect(text).toContain('LOCATION:Venetian\\, Level 3 | Lido 3001');
    expect(text).toContain('LOCATION:Wynn/Encore\r\n');
    expect(text).toContain('DESCRIPTION:In this workshop you build threat detection for AI agents: wire Amazon GuardDuty findings\\, detect');
    expect(text).toContain('\\n\\nSession code: SEC401\\nhttps://reinvent-planner.cloud/');
  });

  it('includes enabled, scheduled personal blocks only when opted in, converted from Las Vegas time to UTC', async () => {
    const { planner } = await openPlanner();
    add(planner, 'SEC401');
    planner.createBlock({ title: 'Team dinner; Wynn', kind: 'personal', day: 'tue', start: '19:00', end: '21:00', venue: 'wynn', enabled: true });
    planner.createBlock({ title: 'Disabled', kind: 'personal', day: 'wed', start: '19:00', end: '21:00', venue: null, enabled: false });

    expect(unfold(planner.exportIcs({ includePersonal: false })).match(/BEGIN:VEVENT/g)).toHaveLength(1);
    const text = unfold(planner.exportIcs({ includePersonal: true }));
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2); // keynote presets are disabled and unscheduled
    expect(text).toContain('SUMMARY:Team dinner\\; Wynn');
    expect(text).toContain('DTSTART:20261202T030000Z');
    expect(text).toContain('DTEND:20261202T050000Z');
    expect(text).not.toContain('Disabled');
  });
});
