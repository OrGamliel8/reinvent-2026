// iCalendar (RFC 5545) export. Times are UTC; lines are CRLF-terminated and folded at 75 octets.
import { SESSION_LINK, venueName } from '../defaults';
import { lvToUtc } from '../time';
import type { PersonalBlock, Session, Slot } from '../types';

export interface IcsSessionEvent {
  uid: string;
  session: Session;
  slot: Slot;
}

export function buildIcs({ sessions, blocks, now }: { sessions: IcsSessionEvent[]; blocks: PersonalBlock[]; now: Date }): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//reinvent-2026-planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:re:Invent 2026'];
  const stamp = icsDate(now.toISOString());

  for (const { uid, session, slot } of sessions) {
    if (!slot.start || !slot.end) continue;
    const description = `${session.abstract}\n\nSession code: ${slot.code}\n${SESSION_LINK}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}@reinvent-2026-planner`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(slot.start)}`,
      `DTEND:${icsDate(slot.end)}`,
      `SUMMARY:${escapeText(`${slot.code} – ${session.title}`)}`,
      `LOCATION:${escapeText([venueName(slot.venue), slot.room].filter(Boolean).join(', '))}`,
      `DESCRIPTION:${escapeText(description)}`,
      `URL:${SESSION_LINK}`,
      'END:VEVENT',
    );
  }

  for (const block of blocks) {
    if (!block.day || !block.start || !block.end) continue;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${block.id}@reinvent-2026-planner`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(lvToUtc(block.day, block.start))}`,
      `DTEND:${icsDate(lvToUtc(block.day, block.end))}`,
      `SUMMARY:${escapeText(block.title)}`,
      ...(block.venue ? [`LOCATION:${escapeText(venueName(block.venue))}`] : []),
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// 2026-11-30T18:00:00.000Z -> 20261130T180000Z
function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

// Folds at 75 octets without splitting a UTF-8 character; continuation lines start with one space.
function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length ? 74 : 75;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}
