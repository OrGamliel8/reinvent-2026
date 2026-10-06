import { describe, expect, it } from 'vitest';
import type { Planner } from '../src/core/planner';
import type { ProfileDraft } from '../src/core/types';
import { fixtureProfile, openPlanner } from './helpers';

function detectiveDraft(planner: Planner): ProfileDraft {
  return {
    ...planner.profileDraft(),
    name: 'Detection engineer',
    roles: ['Cloud Security Specialist'],
    topics: { 'Security & Identity': 'medium' },
    services: { 'Amazon Detective': 'high' },
    level: { min: 300, max: 400 },
    avoid: { keywords: ['blockchain'], topics: [], services: ['Amazon Bedrock'] },
    availability: { days: { thu: { start: '09:00', end: '17:00' } }, lunch: null, maxPerDay: 2 },
    freeText: 'I hunt threats in AWS accounts and want deep detection content.',
  };
}

describe('profile builder', () => {
  it('starts from defaults when there is no profile: unrecorded formats preferred, recorded neutral', async () => {
    const { planner } = await openPlanner({ profile: null });
    const draft = planner.profileDraft();
    expect(draft).toMatchObject({ name: 'My profile', roles: [], topics: {}, services: {}, freeText: '', level: { min: 200, max: 400 } });
    expect(draft.formats['Chalk talk']).toBe('prefer');
    expect(draft.formats['Breakout session']).toBe('neutral');
    expect(Object.keys(draft.availability.days)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
  });

  it('turns a draft into a valid profile that ranks the matching session first and respects avoid', async () => {
    const { planner } = await openPlanner({ profile: null });
    const result = planner.profileFromDraft(detectiveDraft(planner));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(planner.getProfile()).toBeNull(); // not saved until the caller decides
    const profile = result.value;
    expect(profile.services).toEqual({ 'Amazon Detective': 1 });
    expect(profile.topics).toEqual({ 'Security & Identity': 0.6 });
    expect(profile.interests[0]).toMatchObject({ label: 'Amazon Detective', weight: 1, keywords: expect.arrayContaining(['Amazon Detective', 'Detective']) });
    expect(profile.description).toBe('I hunt threats in AWS accounts and want deep detection content.');
    expect(profile.formats['Chalk talk']).toBe(1);

    planner.updateProfile(profile);
    const ranked = planner.rank({});
    expect(ranked[0].session.key).toBe('SEC330');
    const keys = ranked.map((r) => r.session.key);
    expect(keys).not.toContain('BLK201'); // avoided keyword
    expect(keys).not.toContain('SEC401'); // avoided service (Amazon Bedrock)
  });

  it('auto-build respects the draft availability', async () => {
    const { planner } = await openPlanner({ profile: null });
    const result = planner.profileFromDraft(detectiveDraft(planner));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    planner.updateProfile(result.value);
    const { agenda } = planner.autoBuild();
    expect(agenda.length).toBeGreaterThan(0);
    expect(agenda.length).toBeLessThanOrEqual(2);
    const days = agenda.map((i) => planner.session(i.sessionKey)!.slots.find((s) => s.slotId === i.slotId)!.day);
    expect(new Set(days)).toEqual(new Set(['thu']));
  });

  it('generates a summary description when there is no free text, and reports invalid drafts by field', async () => {
    const { planner } = await openPlanner({ profile: null });
    const result = planner.profileFromDraft({ ...detectiveDraft(planner), freeText: '  ' });
    expect(result.ok && result.value.description).toMatch(/^Summary: Cloud Security Specialist · .*Amazon Detective \(high\).*levels 300–400/);

    const invalid = planner.profileFromDraft({ ...detectiveDraft(planner), name: '', level: { min: 400, max: 200 } });
    expect(!invalid.ok && invalid.errors.map((e) => e.path)).toEqual(['name', 'level.max']);
  });

  it('bakes the fixed choices and free text into the copy prompt', async () => {
    const { planner } = await openPlanner({ profile: null });
    const draft = detectiveDraft(planner);
    const prompt = planner.copyPrompt(draft);
    expect(prompt).toContain('## Fixed choices');
    expect(prompt).toContain('"services": {"Amazon Detective":1}');
    expect(prompt).toContain('"topics": {"Security & Identity":0.6}');
    expect(prompt).toContain('"maxPerDay":2');
    expect(prompt).toContain('"blockchain"');
    expect(prompt).toContain('"Chalk talk":1');
    expect(prompt).toContain(draft.freeText);
    expect(prompt).toMatch(/\nSummary: Cloud Security Specialist/);
    expect(prompt).toMatch(/Services: \[.*"Amazon GuardDuty".*\]/);
    expect(prompt).toContain('"$schema"');
    expect(prompt).not.toContain('"interests": ['); // Claude writes those
    expect(planner.copyPrompt()).toContain('- Security & Identity'); // no-arg prompt unchanged
  });

  it('round-trips a draft through the active profile', async () => {
    const { planner } = await openPlanner({ profile: null });
    const draft = { ...detectiveDraft(planner), industries: ['Financial Services'] };
    const result = planner.profileFromDraft(draft);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    planner.updateProfile(result.value);
    expect(planner.profileDraft()).toEqual(draft);
  });

  it('pre-fills from an imported profile, bucketing weights and keeping only the own words', async () => {
    const { planner } = await openPlanner();
    planner.updateProfile({ ...fixtureProfile(), description: 'My words.\nSummary: generated' });
    const draft = planner.profileDraft();
    expect(draft.topics).toEqual({ 'Security & Identity': 'high', 'Artificial Intelligence': 'medium' });
    expect(draft.services).toEqual({ 'Amazon Bedrock': 'medium', 'Amazon GuardDuty': 'high' });
    expect(draft.formats).toMatchObject({ 'Chalk talk': 'prefer', Workshop: 'prefer', 'Breakout session': 'neutral' });
    expect(draft.freeText).toBe('My words.');
    expect(draft.name).toBe(fixtureProfile().name);
  });
});
