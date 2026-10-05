import { useMemo, useState, type ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VENUES, type DayId, type RankedSession, type VenueId } from '@/core/types';
import { cn } from '@/lib/utils';
import { usePlannerQuery } from '../PlannerProvider';
import { useUi } from '../UiState';
import { VENUE_COLORS, fmtMinutes, fmtRange, lvMinutes } from '../format';
import { DayPicker } from '../shared/DayPicker';
import { packRows } from './timelineLayout';

const DAY_START = 8 * 60;
const DAY_END = 20 * 60;
const PX_PER_MIN = 2;
const ROW_HEIGHT = 26;
const LANE_LABEL_WIDTH = 120;
const LIMITS = [50, 100, 200, 500];

interface Block {
  key: string;
  slotId: string;
  code: string;
  title: string;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  venue: VenueId;
  relevance: number; // 0..1
  onAgenda: boolean;
}

function toBlocks(ranked: RankedSession[], day: DayId, agendaSlots: Set<string>): Block[] {
  const maxScore = ranked.reduce((m, r) => Math.max(m, r.score), 0) || 1;
  const blocks: Block[] = [];
  for (const r of ranked) {
    for (const slot of r.session.slots) {
      if (slot.day !== day || !slot.start || !slot.end || !slot.venue) continue;
      blocks.push({
        key: r.session.key,
        slotId: slot.slotId,
        code: slot.code,
        title: r.session.title,
        start: slot.start,
        end: slot.end,
        startMin: Math.max(DAY_START, lvMinutes(slot.start)),
        endMin: Math.min(DAY_END, lvMinutes(slot.end)),
        venue: slot.venue,
        relevance: Math.max(0, r.score) / maxScore,
        onAgenda: agendaSlots.has(slot.slotId),
      });
    }
  }
  return blocks;
}

export function TimelineView(): ReactNode {
  const [day, setDay] = useState<DayId>('mon');
  const [limit, setLimit] = useState(100);
  const { data } = usePlannerQuery(async (api) => {
    const [top, mine, agenda] = await Promise.all([api.rank({ days: [day], limit }), api.rank({ days: [day], onAgendaOnly: true }), api.agenda()]);
    const merged = new Map([...top, ...mine].map((r) => [r.session.key, r]));
    return { ranked: [...merged.values()], agendaSlots: new Set(agenda.map((i) => i.slotId)) };
  }, [day, limit]);

  const lanes = useMemo(() => {
    const blocks = data ? toBlocks(data.ranked, day, data.agendaSlots) : [];
    return VENUES.map((venue) => {
      const packed = packRows(blocks.filter((b) => b.venue === venue.id));
      const rows = packed.reduce((m, b) => Math.max(m, b.row + 1), 1);
      return { venue, blocks: packed, rows };
    });
  }, [data, day]);

  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);
  const width = (DAY_END - DAY_START) * PX_PER_MIN;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <DayPicker value={day} onChange={setDay} />
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Top
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMITS.map((l) => (
                <SelectItem key={l} value={String(l)}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          ranked sessions · shading = relevance · <span className="inline-block size-2.5 rounded-sm bg-primary" /> on agenda
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div style={{ width: width + LANE_LABEL_WIDTH }} className="relative">
          <div className="sticky top-0 z-20 flex h-7 border-b bg-background">
            <div style={{ width: LANE_LABEL_WIDTH }} className="sticky left-0 z-10 shrink-0 bg-background" />
            <div className="relative" style={{ width }}>
              {hours.map((m) => (
                <span key={m} className="absolute top-1.5 -translate-x-1/2 text-[11px] text-muted-foreground" style={{ left: (m - DAY_START) * PX_PER_MIN }}>
                  {fmtMinutes(m)}
                </span>
              ))}
            </div>
          </div>
          {lanes.map(({ venue, blocks, rows }) => (
            <div key={venue.id} className="flex border-b">
              <div style={{ width: LANE_LABEL_WIDTH }} className="sticky left-0 z-10 flex shrink-0 items-start gap-2 border-r bg-background p-2 text-xs font-medium">
                <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: VENUE_COLORS[venue.id] }} />
                {venue.name}
              </div>
              <div className="relative" style={{ width, height: rows * ROW_HEIGHT + 8 }}>
                {hours.map((m) => (
                  <div key={m} className="absolute inset-y-0 border-l border-border/50" style={{ left: (m - DAY_START) * PX_PER_MIN }} />
                ))}
                {blocks.map((b) => (
                  <TimelineBlock key={b.slotId} block={b} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineBlock({ block }: { block: Block & { row: number } }): ReactNode {
  const { openSession } = useUi();
  const color = VENUE_COLORS[block.venue];
  const alpha = Math.round((0.12 + block.relevance * 0.55) * 255)
    .toString(16)
    .padStart(2, '0');
  return (
    <button
      onClick={() => openSession(block.key)}
      title={`${block.code} · ${block.title}\n${fmtRange(block.start, block.end)}`}
      className={cn(
        'absolute flex items-center overflow-hidden rounded-[4px] border px-1.5 text-left text-[11px] leading-none whitespace-nowrap hover:z-10 hover:ring-2 hover:ring-ring',
        block.onAgenda ? 'border-primary bg-primary font-medium text-primary-foreground' : 'border-transparent text-foreground',
      )}
      style={{
        left: (block.startMin - DAY_START) * PX_PER_MIN,
        width: Math.max(8, (block.endMin - block.startMin) * PX_PER_MIN - 2),
        top: 4 + block.row * ROW_HEIGHT,
        height: ROW_HEIGHT - 4,
        background: block.onAgenda ? undefined : `${color}${alpha}`,
      }}
    >
      <span className="mr-1 font-mono opacity-70">{block.code}</span>
      <span className="truncate">{block.title}</span>
    </button>
  );
}
