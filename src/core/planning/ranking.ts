// Scores every session against a profile. Scores land roughly in 0..100 and come with a structured explanation.
import type { CatalogRepository } from '../catalog/catalogRepository';
import type { MatchExplanation, Profile, Session, Settings } from '../types';

export interface ScoredSession {
  score: number; // effective: manualScore ?? computedScore
  computedScore: number;
  manualScore: number | null;
  explanation: MatchExplanation;
  relevant: boolean; // matched at least one interest or weighted tag, or has a manual score > 0 (auto-build only suggests these)
  excluded: boolean; // hit the avoid list and the user hasn't scored it above 0
}

const TEXT_RATE = 1;
const TAG_RATE = 0.7;

const round1 = (n: number): number => Math.round(n * 10) / 10;

// Combines several matches into 0..1 with diminishing returns: one perfect match ≈ half credit, more matches climb toward 1
// without bunching many sessions at the top (a plain soft-OR saturated after two or three strong matches).
const saturate = (values: number[], rate: number): number => 1 - Math.exp(-rate * values.reduce((sum, v) => sum + Math.max(0, v), 0));

export function isRecorded(type: string, settings: Settings): boolean {
  return settings.recorded[type] ?? false;
}

export function scoreSessions({ catalog, profile, settings }: { catalog: CatalogRepository; profile: Profile | null; settings: Settings }): Map<string, ScoredSession> {
  const sessions = catalog.sessions();
  const interests = (profile?.interests ?? []).map((interest) => {
    const perKeyword = interest.keywords.map((keyword) => ({ keyword, hits: catalog.matchKeyword(keyword) }));
    const totals = new Map<string, number>();
    for (const { hits } of perKeyword) for (const [key, relevance] of hits) totals.set(key, (totals.get(key) ?? 0) + relevance);
    const max = Math.max(0, ...totals.values());
    return { interest, perKeyword, totals, max };
  });
  const avoidHits = (profile?.avoid.keywords ?? []).map((keyword) => ({ keyword, hits: catalog.matchKeyword(keyword) }));

  const { weights } = settings;
  const weightSum = weights.text + weights.tags + weights.level + weights.format;
  const scale = weightSum > 0 ? 100 / weightSum : 0;

  const result = new Map<string, ScoredSession>();
  for (const session of sessions) {
    const matched = interests
      .map(({ interest, perKeyword, totals, max }) => ({
        label: interest.label,
        keywords: perKeyword.filter(({ hits }) => hits.has(session.key)).map(({ keyword }) => keyword),
        strength: interest.weight * (max > 0 ? (totals.get(session.key) ?? 0) / max : 0),
      }))
      .filter((m) => m.strength > 0);
    const textTotal = scale * weights.text * saturate(matched.map((m) => m.strength), TEXT_RATE);
    const strengthSum = matched.reduce((sum, m) => sum + m.strength, 0);

    const tags = tagMatches(session, profile);
    const tagTotal = scale * weights.tags * saturate(tags.map((t) => t.weight), TAG_RATE);

    const level = levelFit(session, profile);
    const levelContribution = scale * weights.level * level.value;

    const recorded = isRecorded(session.type, settings);
    const formatPreference = profile?.formats[session.type] ?? (recorded ? -0.5 : 0.5);
    const formatContribution = scale * weights.format * formatPreference;

    const avoided = [
      ...avoidHits.filter(({ hits }) => hits.has(session.key)).map(({ keyword }) => `keyword "${keyword}"`),
      ...(profile?.avoid.topics ?? []).filter((t) => session.topics.includes(t)).map((t) => `topic "${t}"`),
      ...(profile?.avoid.services ?? []).filter((s) => session.services.includes(s)).map((s) => `service "${s}"`),
    ];

    const score = round1(Math.max(0, textTotal + tagTotal + levelContribution + formatContribution));
    result.set(session.key, {
      score,
      computedScore: score,
      manualScore: null,
      relevant: matched.length > 0 || tags.length > 0,
      excluded: avoided.length > 0,
      explanation: {
        interests: matched
          .map((m) => ({ label: m.label, keywords: m.keywords, contribution: round1((textTotal * m.strength) / strengthSum) }))
          .sort((a, b) => b.contribution - a.contribution),
        tags,
        level: { fit: level.fit, contribution: round1(levelContribution) },
        format: { type: session.type, recorded, contribution: round1(formatContribution) },
        avoided,
      },
    });
  }
  return result;
}

// Overlays the user's manual scores: they replace the score, 0 makes a session irrelevant and > 0 makes it relevant
// (an explicit score above 0 also overrides the avoid list).
export function applyManualScores(scores: Map<string, ScoredSession>, manual: Record<string, number>): Map<string, ScoredSession> {
  const result = new Map(scores);
  for (const [key, manualScore] of Object.entries(manual)) {
    const scored = scores.get(key);
    if (scored) result.set(key, { ...scored, score: manualScore, manualScore, relevant: manualScore > 0, excluded: scored.excluded && manualScore === 0 });
  }
  return result;
}

function tagMatches(session: Session, profile: Profile | null): MatchExplanation['tags'] {
  if (!profile) return [];
  const topics = session.topics.filter((t) => (profile.topics[t] ?? 0) > 0).map((name) => ({ kind: 'topic' as const, name, weight: profile.topics[name] }));
  const services = session.services.filter((s) => (profile.services[s] ?? 0) > 0).map((name) => ({ kind: 'service' as const, name, weight: profile.services[name] }));
  return [...topics, ...services].sort((a, b) => b.weight - a.weight);
}

// Full credit inside the range; half a point of penalty per 100 levels outside it (floored at -1).
function levelFit(session: Session, profile: Profile | null): { fit: MatchExplanation['level']['fit']; value: number } {
  if (!profile || session.level === null) return { fit: 'unknown', value: 0 };
  const { min, max } = profile.level;
  if (session.level < min) return { fit: 'below', value: Math.max(-1, (-0.5 * (min - session.level)) / 100) };
  if (session.level > max) return { fit: 'above', value: Math.max(-1, (-0.5 * (session.level - max)) / 100) };
  return { fit: 'in', value: 1 };
}
