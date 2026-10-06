// "Work" -> "Work (2)", "Work (3)"… until it no longer clashes with `taken` (case-insensitive).
export function uniqueName(base: string, taken: string[]): string {
  const name = base.trim();
  const used = new Set(taken.map((t) => t.toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  let n = 2;
  while (used.has(`${name} (${n})`.toLowerCase())) n++;
  return `${name} (${n})`;
}
