// Scores every session against a profile. Scores land roughly in 0..100 and come with a structured explanation.
import type { CatalogRepository } from '../catalog/catalogRepository';
import type { MatchExplanation, Profile, Session, Settings } from '../types';

export interface ScoredSession {
  score: number;
  explanation: MatchExplanation;
  relevant: boolean; // matched at least one interest or weighted tag (auto-build only suggests these)
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

// Soft OR: combining independent matches in 0..1 without exceeding 1.
const softOr = (values: number[]): number => 1 - values.reduce((acc, v) => acc * (1 - Math.min(1, Math.max(0, v))), 1);

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
    const textTotal = scale * weights.text * softOr(matched.map((m) => m.strength));
    const strengthSum = matched.reduce((sum, m) => sum + m.strength, 0);

    const tags = tagMatches(session, profile);
    const tagTotal = scale * weights.tags * softOr(tags.map((t) => t.weight));

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

    result.set(session.key, {
      score: round1(Math.max(0, textTotal + tagTotal + levelContribution + formatContribution)),
      relevant: matched.length > 0 || tags.length > 0,
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
