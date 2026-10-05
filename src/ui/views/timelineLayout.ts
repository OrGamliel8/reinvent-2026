// Pure presentation helpers for the timeline: pack overlapping blocks into rows.
export interface Interval {
  startMin: number;
  endMin: number;
}

export function packRows<T extends Interval>(blocks: T[]): (T & { row: number })[] {
  const rowEnds: number[] = [];
  return [...blocks]
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
    .map((block) => {
      let row = rowEnds.findIndex((end) => end <= block.startMin);
      if (row === -1) row = rowEnds.length;
      rowEnds[row] = block.endMin;
      return { ...block, row };
    });
}
