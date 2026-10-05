import { describe, expect, it } from 'vitest';
import { add, fixtureProfile, openPlanner } from './helpers';

describe('profile', () => {
  it('imports a valid profile and exports it back', async () => {
    const { planner } = await openPlanner({ profile: null });
    expect(planner.getProfile()).toBeNull();
    const result = planner.importProfile(JSON.stringify(fixtureProfile()));
    expect(result.ok).toBe(true);
    expect(planner.getProfile()).toEqual(fixtureProfile());
    expect(JSON.parse(planner.exportProfile())).toEqual(fixtureProfile());
  });

  it('fills defaults for optional fields', async () => {
    const { planner } = await openPlanner({ profile: null });
    const result = planner.importProfile(JSON.stringify({ version: 1, name: 'Minimal', interests: [{ label: 'Agents', weight: 1, keywords: ['agentic'] }] }));
    expect(result.ok).toBe(true);
    const profile = planner.getProfile()!;
    expect(profile.avoid).toEqual({ keywords: [], topics: [], services: [] });
    expect(profile.level).toEqual({ min: 200, max: 400 });
    expect(Object.keys(profile.availability.days)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
    expect(profile.availability.maxPerDay).toBe(6);
  });

  it('names the offending field in validation errors', async () => {
    const { planner } = await openPlanner({ profile: null });
    const errorsFor = (mutate: (p: Record<string, any>) => void): { path: string; message: string }[] => {
      const profile: Record<string, any> = fixtureProfile();
      mutate(profile);
      const result = planner.importProfile(JSON.stringify(profile));
      if (result.ok) throw new Error('expected invalid');
      return result.errors;
    };
    expect(errorsFor((p) => (p.interests[1].weight = 2))).toEqual([{ path: 'interests[1].weight', message: expect.any(String) }]);
    expect(errorsFor((p) => (p.interests[2].keywords = []))[0].path).toBe('interests[2].keywords');
    expect(errorsFor((p) => (p.version = 2))[0].path).toBe('version');
    expect(errorsFor((p) => (p.topics['Security & Identity'] = 3))[0].path).toBe('topics["Security & Identity"]');
    expect(errorsFor((p) => (p.availability.days.mon.end = '07:00'))[0].path).toBe('availability.days.mon.end');
    expect(errorsFor((p) => (p.availability.days.tue.start = '9am'))[0].path).toBe('availability.days.tue.start');
    expect(errorsFor((p) => (p.level = { min: 400, max: 200 }))[0].path).toBe('level.max');
    expect(errorsFor((p) => delete p.name)[0].path).toBe('name');
    expect(errorsFor((p) => (p.availability.days.monday = { start: '08:00', end: '18:00' }))[0].path).toBe('availability.days');

    const bad = planner.importProfile('{ not json');
    expect(bad).toMatchObject({ ok: false, errors: [{ path: '' }] });
    expect(!bad.ok && bad.errors[0].message).toMatch(/^Invalid JSON/);
    expect(planner.getProfile()).toBeNull(); // nothing saved
  });

  it('updateProfile validates too', async () => {
    const { planner } = await openPlanner();
    const result = planner.updateProfile({ ...fixtureProfile(), availability: { ...fixtureProfile().availability, maxPerDay: 0 } });
    expect(result).toMatchObject({ ok: false, errors: [{ path: 'availability.maxPerDay' }] });
    expect(planner.getProfile()!.availability.maxPerDay).toBe(6);
  });

  it('swapping the profile keeps the agenda and stars', async () => {
    const { planner } = await openPlanner();
    const item = add(planner, 'SEC401');
    planner.star('ANT319');
    const before = planner.agenda();
    planner.importProfile(JSON.stringify({ version: 1, name: 'Storage person', interests: [{ label: 'S3', weight: 1, keywords: ['S3'] }] }));
    expect(planner.getProfile()!.name).toBe('Storage person');
    expect(planner.agenda()).toEqual(before);
    expect(planner.agenda()[0].id).toBe(item);
    expect(planner.starred()).toEqual(['ANT319']);
    expect(planner.rank({})[0].session.key).toBe('STG201');
  });

  it('builds a self-contained copy prompt with the schema and the catalog vocabulary', async () => {
    const { planner } = await openPlanner();
    const prompt = planner.copyPrompt();
    expect(prompt).toContain('"$schema"');
    expect(prompt).toContain('"interests"');
    expect(prompt).toContain('- Security & Identity');
    expect(prompt).toContain('- Amazon GuardDuty');
    expect(prompt).toContain("- Builders' session");
    expect(prompt).toContain('- 400');
    expect(prompt).toContain('maxPerDay');
  });
});
