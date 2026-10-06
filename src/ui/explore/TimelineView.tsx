import type { ReactNode } from 'react';
import { CalendarX2, Star } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUi } from '../UiState';
import { VENUE_COLORS, fmtMinutes, fmtRange } from '../format';
import { DayPicker } from '../shared/DayPicker';
import { EmptyState } from '../shared/EmptyState';
import { useExploreFilters } from './ExploreFilters';
import { DAY_END, DAY_START, type Block, type Lane } from './timelineModel';
import { TOP_N_OPTIONS, useTimelineData, type TimelineData, type TimelineSettings, type TopN } from './useTimeline';

const PX_PER_MIN = 2;
const ROW_HEIGHT = 26;
const LANE_LABEL_WIDTH = 120;
const TRACK_PAD = 24; // room for the first/last hour labels, which are centred on their gridline
const x = (minute: number): number => TRACK_PAD + (minute - DAY_START) * PX_PER_MIN;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);
const TRACK_WIDTH = (DAY_END - DAY_START) * PX_PER_MIN + TRACK_PAD * 2;

const topNLabel = (n: TopN): string => (n === null ? 'All' : String(n));

export function TimelineControls({ settings }: { settings: TimelineSettings }): ReactNode {
  return (
    <>
      <DayPicker value={settings.day} onChange={settings.setDay} options={settings.dayOptions} short />
      <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
        Top
        <Select value={topNLabel(settings.topN)} onValueChange={(v) => settings.setTopN(TOP_N_OPTIONS.find((n) => topNLabel(n) === v) ?? null)}>
          <SelectTrigger size="sm" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOP_N_OPTIONS.map((n) => (
              <SelectItem key={topNLabel(n)} value={topNLabel(n)}>
                {topNLabel(n)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </>
  );
}

export function TimelineView({ settings }: { settings: TimelineSettings }): ReactNode {
  const { effective, effectiveKey } = useExploreFilters();
  const { data, loading } = useTimelineData(effective, effectiveKey, settings.day, settings.topN);
  return (
    <>
      <div className={cn('min-h-0 flex-1 overflow-auto transition-opacity', loading && 'opacity-60')}>
        {data && <TimelineGrid lanes={data.lanes} />}
        {data?.matching === 0 && (
          <EmptyState icon={CalendarX2} title="No sessions on this day">
            Loosen the filters, clear the search or pick another day.
          </EmptyState>
        )}
      </div>
      <TimelineFooter data={data} />
    </>
  );
}

function TimelineFooter({ data }: { data: TimelineData | undefined }): ReactNode {
  return (
    <footer className="flex h-10 shrink-0 items-center gap-3 border-t px-2 text-xs text-muted-foreground">
      <span className="mr-auto truncate">
        {!data && 'Ranking…'}
        {data && `${data.shown.toLocaleString()} of ${data.matching.toLocaleString()} matching sessions shown`}
        {!!data?.tbaHidden && ` · ${data.tbaHidden.toLocaleString()} TBA sessions not shown`}
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap @2xl:flex">
        shading = relevance
        <span className="ml-1.5 inline-block size-2.5 rounded-sm bg-primary" /> on agenda
        <Star className="ml-1.5 size-3 fill-warning text-warning" /> starred
      </span>
    </footer>
  );
}

function TimelineGrid({ lanes }: { lanes: Lane[] }): ReactNode {
  return (
    <div style={{ width: TRACK_WIDTH + LANE_LABEL_WIDTH }} className="relative">
      <div className="sticky top-0 z-20 flex h-7 border-b bg-background">
        <div style={{ width: LANE_LABEL_WIDTH }} className="sticky left-0 z-10 shrink-0 bg-background" />
        <div className="relative" style={{ width: TRACK_WIDTH }}>
          {HOURS.map((m) => (
            <span key={m} className="absolute top-1.5 -translate-x-1/2 text-[11px] text-muted-foreground" style={{ left: x(m) }}>
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
          <div className="relative" style={{ width: TRACK_WIDTH, height: rows * ROW_HEIGHT + 8 }}>
            {HOURS.map((m) => (
              <div key={m} className="absolute inset-y-0 border-l border-border/50" style={{ left: x(m) }} />
            ))}
            {blocks.map((b) => (
              <TimelineBlock key={b.slotId} block={b} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineBlock({ block }: { block: Block }): ReactNode {
  const { openSession } = useUi();
  const color = VENUE_COLORS[block.venue];
  const alpha = Math.round((0.12 + block.relevance * 0.55) * 255)
    .toString(16)
    .padStart(2, '0');
  return (
    <button
      onClick={() => openSession(block.key)}
      title={`${block.starred ? '★ ' : ''}${block.code} · ${block.title}\n${fmtRange(block.start, block.end)}`}
      className={cn(
        'absolute flex items-center overflow-hidden rounded-[4px] border px-1.5 text-left text-[11px] leading-none whitespace-nowrap hover:z-10 hover:ring-2 hover:ring-ring',
        block.onAgenda ? 'border-primary bg-primary font-medium text-primary-foreground' : 'border-transparent text-foreground',
        block.starred && 'border-l-[3px] border-l-warning pl-1 ring-1 ring-warning/70',
      )}
      style={{
        left: x(block.startMin),
        width: Math.max(8, (block.endMin - block.startMin) * PX_PER_MIN - 2),
        top: 4 + block.row * ROW_HEIGHT,
        height: ROW_HEIGHT - 4,
        background: block.onAgenda ? undefined : `${color}${alpha}`,
      }}
    >
      {block.starred && <Star aria-label="Starred" className="mr-0.5 size-3 shrink-0 fill-warning text-warning" />}
      <span className="mr-1 font-mono opacity-70">{block.code}</span>
      <span className="truncate">{block.title}</span>
    </button>
  );
}
