import { useMemo, useState } from 'react';
import { DAYS, type DayId, type Filters } from '@/core/types';
import { usePlannerQuery } from '../PlannerProvider';
import { buildLanes, timelineFilters, type Lane } from './timelineModel';

export const TOP_N_OPTIONS = [50, 100, 150, 300, null] as const; // null = all
export type TopN = (typeof TOP_N_OPTIONS)[number];

export interface TimelineSettings {
  day: DayId;
  setDay: (day: DayId) => void;
  dayOptions: DayId[];
  topN: TopN;
  setTopN: (topN: TopN) => void;
}

// The timeline shows one day; when the Day filter is set, only those days are offered.
export function useTimelineSettings(filterDays: DayId[] | undefined): TimelineSettings {
  const [picked, setDay] = useState<DayId>('mon');
  const [topN, setTopN] = useState<TopN>(150);
  const dayOptions = useMemo(() => DAYS.map((d) => d.id).filter((id) => !filterDays?.length || filterDays.includes(id)), [filterDays]);
  const day = dayOptions.includes(picked) ? picked : dayOptions[0];
  return { day, setDay, dayOptions, topN, setTopN };
}

export interface TimelineData {
  lanes: Lane[];
  shown: number; // sessions placed after the Top N cut
  matching: number; // sessions matching the filters on this day
  tbaHidden: number; // matching sessions with no time yet, which can't be placed
}

export function useTimelineData(filters: Filters, filtersKey: string, day: DayId, topN: TopN): { data: TimelineData | undefined; loading: boolean } {
  const { data, loading } = usePlannerQuery(async (api) => {
    const [matching, tba, agenda] = await Promise.all([api.rank(timelineFilters(filters, day)), api.rank({ ...filters, tbaOnly: true }), api.agenda()]);
    return { matching, tbaHidden: tba.length, agendaSlots: new Set(agenda.map((i) => i.slotId)) };
  }, [filtersKey, day]);

  const result = useMemo(() => {
    if (!data) return undefined;
    const top = topN === null ? data.matching : data.matching.slice(0, topN);
    return { lanes: buildLanes(top, data.agendaSlots), shown: top.length, matching: data.matching.length, tbaHidden: data.tbaHidden };
  }, [data, topN]);
  return { data: result, loading };
}
