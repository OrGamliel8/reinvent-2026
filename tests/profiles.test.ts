import { describe, expect, it } from 'vitest';
import { loadSqlite } from '../src/core/sqlite';
import { SqliteUserStore } from '../src/core/store/sqliteUserStore';
import { ME, type Profile } from '../src/core/types';
import type { Planner } from '../src/core/planner';
import { add, fixtureProfile, openPlanner } from './helpers';

const keys = (planner: Planner): string[] => planner.agenda().map((i) => i.sessionKey).sort();

async function friend(name: string, codes: string[], stars: string[] = []): Promise<string> {
  const { planner } = await openPlanner({ profile: { ...fixtureProfile(), name: `${name}'s profile`, interests: [{ label: name, weight: 1, keywords: ['agents'] }] } });
  for (const code of codes) add(planner, code);
  for (const key of stars) planner.star(key);
  return planner.exportSharedPlan(name);
}

describe('profiles library', () => {
  it('saves, activates, renames, duplicates and deletes entries; activating keeps the agenda', async () => {
    const { planner } = await openPlanner();
    add(planner, 'SEC401');
    planner.star('IAM333');
    const work = planner.saveProfileAs('  Work  ');
    expect(work).toMatchObject({ name: 'Work', kind: 'mine', active: true, hasProfile: true, hasPlan: false, agendaCount: 0 });
    expect(planner.getProfile()!.name).toBe('Work');

    const fun: Profile = { ...fixtureProfile(), interests: [{ label: 'Games', weight: 1, keywords: ['jam'] }] };
    planner.updateProfile(fun);
    const funEntry = planner.saveProfileAs('Fun');
    expect(planner.profiles().map((p) => [p.name, p.active])).toEqual([
      ['Fun', true],
      ['Work', false],
    ]);

    planner.activateProfile(work.id);
    expect(planner.getProfile()).toMatchObject({ name: 'Work', interests: fixtureProfile().interests });
    expect(keys(planner)).toEqual(['SEC401']);
    expect(planner.starred()).toEqual(['IAM333']);
    expect(planner.profiles().find((p) => p.active)!.id).toBe(work.id);

    planner.renameProfile(funEntry.id, 'Games');
    expect(() => planner.renameProfile(funEntry.id, ' ')).toThrow(/empty/);
    const copy = planner.duplicateProfile(funEntry.id);
    expect(copy).toMatchObject({ name: 'Games (copy)', kind: 'mine', active: false });
    planner.activateProfile(copy.id);
    expect(planner.getProfile()).toMatchObject({ name: 'Games (copy)', interests: fun.interests });

    planner.deleteProfile(copy.id);
    expect(planner.profiles().map((p) => p.name)).toEqual(['Games', 'Work']);
    expect(planner.profiles().some((p) => p.active)).toBe(false);
    expect(planner.getProfile()!.name).toBe('Games (copy)'); // deleting an entry leaves the active profile alone
    expect(() => planner.activateProfile(copy.id)).toThrow(/Unknown profile/);
  });

  it('imports a profile as a new entry or replacing the current one, keeping the previous version and the agenda', async () => {
    const { planner } = await openPlanner({ profile: null });
    add(planner, 'SEC401');
    const incoming = (name: string): Profile => ({ ...fixtureProfile(), name, interests: [{ label: name, weight: 1, keywords: [name.toLowerCase()] }] });

    const first = planner.importProfileAs(incoming('Work'), { mode: 'replace' }); // no active profile: just imported, with an entry
    expect(first).toMatchObject({ ok: true, value: { name: 'Work', kind: 'mine', active: true } });
    expect(planner.profiles().map((p) => p.name)).toEqual(['Work']);

    const added = planner.importProfileAs(incoming('Work'), { mode: 'new' });
    expect(added).toMatchObject({ ok: true, value: { name: 'Work (2)', active: true } });
    expect(planner.getProfile()).toMatchObject({ name: 'Work (2)', interests: [{ label: 'Work' }] });
    expect(planner.importProfileAs(incoming('Other'), { mode: 'new', name: ' Hobby ' })).toMatchObject({ ok: true, value: { name: 'Hobby' } });

    const replaced = planner.importProfileAs(incoming('Claude v2'), { mode: 'replace' });
    expect(replaced).toMatchObject({ ok: true, value: { name: 'Hobby', active: true } }); // the active entry is overwritten in place
    expect(planner.getProfile()).toMatchObject({ name: 'Hobby', interests: [{ label: 'Claude v2' }] });
    expect(planner.profiles().map((p) => p.name)).toEqual(['Hobby', 'Hobby (previous)', 'Work', 'Work (2)']);
    planner.activateProfile(planner.profiles().find((p) => p.name === 'Hobby (previous)')!.id);
    expect(planner.getProfile()!.interests).toEqual([expect.objectContaining({ label: 'Other' })]);

    expect(planner.parseProfile('{ "version": 1 }')).toMatchObject({ ok: false, errors: expect.arrayContaining([{ path: 'name', message: expect.any(String) }]) });
    expect(planner.importProfileAs({ ...incoming('Bad'), level: { min: 150, max: 300 } }, { mode: 'new' })).toMatchObject({ ok: false, errors: [{ path: 'level.min' }] });
    expect(planner.profiles()).toHaveLength(4);
    expect(keys(planner)).toEqual(['SEC401']);
  });

  it('persists entries in the SQLite store, and round-trips them through state export/import', async () => {
    const sqlite3 = await loadSqlite();
    const db = new sqlite3.oo1.DB(':memory:');
    const { planner } = await openPlanner({ store: new SqliteUserStore({ db }) });
    const work = planner.saveProfileAs('Work');
    planner.importSharedPlan(await friend('Alice', ['SEC401']));
    const shared = JSON.parse(planner.exportSharedPlan('Me')).sourceId as string;
    expect(new SqliteUserStore({ db }).getProfileEntries().map((e) => e.name)).toEqual(['Work', 'Alice']); // reopening is idempotent

    const exported = planner.exportState();
    const { planner: fresh } = await openPlanner();
    expect(fresh.importState(exported)).toEqual({ ok: true, value: null });
    expect(fresh.profiles()).toEqual(planner.profiles());
    expect(fresh.profiles().find((p) => p.active)!.id).toBe(work.id);
    expect(JSON.parse(fresh.exportSharedPlan('Me')).sourceId).toBe(shared);

    const legacy = JSON.parse(exported);
    delete legacy.profiles;
    delete legacy.activeProfileId;
    delete legacy.shareSourceId;
    expect(fresh.importState(JSON.stringify(legacy))).toEqual({ ok: true, value: null });
    expect(fresh.profiles()).toEqual([]);
    expect(JSON.parse(fresh.exportSharedPlan('Me')).sourceId).toBe(shared); // an older backup keeps this browser's id
  });
});

describe('shared plans', () => {
  it('imports a friend without touching my profile or agenda, and updates the same entry from a newer file', async () => {
    const { planner } = await openPlanner();
    add(planner, 'SEC401');
    const profile = planner.getProfile();

    const { planner: alice } = await openPlanner({ profile: { ...fixtureProfile(), name: 'Alice AI' } });
    add(alice, 'NET310');
    alice.star('SEC360');
    alice.setManualScore('NET310', 90);
    const file = JSON.parse(alice.exportSharedPlan(' Alice '));
    expect(file).toMatchObject({
      kind: 'reinvent-planner-shared-plan',
      version: 1,
      sourceId: expect.any(String),
      displayName: 'Alice',
      profile: { name: 'Alice AI' },
      items: [{ code: 'NET310', slotId: expect.any(String), venue: 'venetian' }],
      starred: [{ sessionKey: 'SEC360' }],
      scores: [{ sessionKey: 'NET310', score: 90 }],
    });
    expect(JSON.parse(alice.exportSharedPlan('Alice')).sourceId).toBe(file.sourceId); // generated once per browser

    const imported = planner.importSharedPlan(JSON.stringify(file));
    expect(imported).toMatchObject({ ok: true, value: { name: 'Alice', kind: 'friend', hasProfile: true, agendaCount: 1, starCount: 1, active: false } });
    const id = imported.ok ? imported.value.id : '';
    planner.renameProfile(id, 'Ali');

    add(alice, 'SEC320');
    const newer = planner.importSharedPlan(alice.exportSharedPlan('Alice'));
    expect(newer).toMatchObject({ ok: true, value: { id, name: 'Ali', agendaCount: 2 } }); // same entry, my rename kept
    expect(planner.importSharedPlan(alice.exportSharedPlan('Alice'), 'Alice B')).toMatchObject({ ok: true, value: { id, name: 'Alice B' } });
    expect(planner.profiles()).toHaveLength(1);

    expect(planner.getProfile()).toEqual(profile);
    expect(keys(planner)).toEqual(['SEC401']);
    expect(planner.starred()).toEqual([]);
    expect(planner.manualScores()).toEqual({});

    planner.activateProfile(id); // rank by a friend's interests
    expect(planner.getProfile()).toMatchObject({ name: 'Alice B' });
    expect(keys(planner)).toEqual(['SEC401']);
  });

  it('imports a plain agenda file as a friend (name required, updated by name) and rejects bad files with field paths', async () => {
    const { planner } = await openPlanner();
    const { planner: bob } = await openPlanner();
    add(bob, 'AIM350');
    const agenda = bob.exportAgenda();

    expect(planner.importSharedPlan(agenda)).toMatchObject({ ok: false, errors: [{ path: 'name' }] });
    const imported = planner.importSharedPlan(agenda, 'Bob');
    expect(imported).toMatchObject({ ok: true, value: { name: 'Bob', kind: 'friend', hasProfile: false, agendaCount: 1 } });
    add(bob, 'BLK201');
    expect(planner.importSharedPlan(bob.exportAgenda(), 'Bob')).toMatchObject({ ok: true, value: { id: imported.ok && imported.value.id, agendaCount: 2 } });
    expect(() => planner.activateProfile(imported.ok ? imported.value.id : '')).toThrow(/no profile/);
    expect(() => planner.duplicateProfile(imported.ok ? imported.value.id : '')).toThrow(/no profile/);

    const bad = JSON.parse(await friend('Carol', ['SEC401']));
    bad.items[0].origin = 'magic';
    bad.profile.level.min = 150;
    delete bad.displayName;
    const result = planner.importSharedPlan(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['items[0].origin', 'profile.level.min', 'displayName']));
    expect(planner.importSharedPlan('{ nope')).toMatchObject({ ok: false });
    expect(planner.importSharedPlan(planner.exportSharedPlan('Me'))).toMatchObject({ ok: false, errors: [{ path: 'sourceId', message: 'This is your own shared plan' }] });
    expect(planner.profiles()).toHaveLength(1);
  });
});

describe('compare', () => {
  async function threeFriends(): Promise<{ planner: Planner; alice: string; bob: string }> {
    const { planner } = await openPlanner();
    for (const code of ['SEC401', 'SEC310', 'ANT319-R1', 'CMP301']) add(planner, code);
    planner.star('IAM333');

    const aliceFile = JSON.parse(await friend('Alice', ['SEC401', 'NET310', 'ANT319-R2', 'SEC320'], ['SEC360']));
    aliceFile.items.push({ ...aliceFile.items[0], sessionKey: 'XYZ999', code: 'XYZ999', title: 'Gone', slotId: 'e-xyz999' });
    const alice = planner.importSharedPlan(JSON.stringify(aliceFile));
    const bob = planner.importSharedPlan(await friend('Bob', ['SEC401', 'AIM350', 'BLK201'], ['SEC320']));
    if (!alice.ok || !bob.ok) throw new Error('import failed');
    return { planner, alice: alice.value.id, bob: bob.value.id };
  }

  it('lines up me and two friends: together, same session in other slots, split, only one, and others picks', async () => {
    const { planner, alice, bob } = await threeFriends();
    const result = planner.compare([ME, alice, bob]);

    expect(result.people).toEqual([
      expect.objectContaining({ id: ME, name: 'You', agendaCount: 4, missing: [] }),
      expect.objectContaining({ id: alice, name: 'Alice', agendaCount: 4, missing: [{ code: 'XYZ999', title: 'Gone' }] }),
      expect.objectContaining({ id: bob, name: 'Bob', agendaCount: 3, missing: [] }),
    ]);
    expect(result.people[1].profileSummary).toMatchObject({ topInterests: ['Alice'], level: fixtureProfile().level, days: expect.any(Array) });

    expect(result.together).toEqual([expect.objectContaining({ sessionKey: 'SEC401', slotCode: 'SEC401', day: 'mon', personIds: [ME, alice, bob] })]);
    expect(result.sameSessionDifferentSlot).toEqual([
      expect.objectContaining({ sessionKey: 'ANT319', placements: [expect.objectContaining({ personId: ME, slotCode: 'ANT319-R1' }), expect.objectContaining({ personId: alice, slotCode: 'ANT319-R2' })] }),
    ]);
    expect(result.split.map((s) => s.entries.map((e) => [e.personId, e.sessionKey]))).toEqual([
      [
        [ME, 'SEC310'],
        [alice, 'NET310'],
        [bob, 'AIM350'],
      ],
      [
        [ME, 'CMP301'],
        [bob, 'BLK201'],
      ],
    ]);
    const onlyOne = Object.fromEntries(Object.entries(result.onlyOne).map(([id, list]) => [id, list.map((s) => s.sessionKey).sort()]));
    expect(onlyOne).toEqual({ [ME]: ['CMP301', 'SEC310'], [alice]: ['NET310', 'SEC320'], [bob]: ['AIM350', 'BLK201'] });
    expect(result.starredByOthers.map((s) => [s.sessionKey, s.personIds])).toEqual([
      ['SEC320', [alice, bob]],
      ['AIM350', [bob]],
      ['BLK201', [bob]],
      ['NET310', [alice]],
      ['SEC360', [alice]],
    ]);
    expect(result.starredByOthers.find((s) => s.sessionKey === 'SEC360')!.slotId).toBeNull();

    expect(result.days.map((d) => d.day)).toEqual(['mon', 'tue', 'wed', 'thu']);
    const mon = result.days[0].rows;
    expect(mon).toHaveLength(1);
    expect(Object.values(mon[0].cells).map((c) => c?.status)).toEqual(['together', 'together', 'together']);
    const tueSplit = result.days[1].rows.find((r) => r.cells[ME]?.sessionKey === 'SEC310')!;
    expect(tueSplit.cells[bob]).toMatchObject({ sessionKey: 'AIM350', venue: 'caesars-palace', status: 'split' });
    const thu = result.days.find((d) => d.day === 'thu')!.rows;
    expect(thu.flatMap((r) => Object.values(r.cells)).filter(Boolean).map((c) => [c!.sessionKey, c!.status])).toEqual([
      ['ANT319', 'solo'],
      ['SEC320', 'solo'],
    ]);
    expect(thu.every((r) => r.cells[ME] === null && r.cells[bob] === null)).toBe(true);
  });

  it('adds a friend pick to my agenda with their slot, and rejects entries without a plan', async () => {
    const { planner, alice } = await threeFriends();
    const pick = planner.compare([ME, alice]).starredByOthers.find((s) => s.sessionKey === 'NET310')!;
    planner.addSlot(pick.slotId!);
    expect(planner.compare([ME, alice]).starredByOthers.map((s) => s.sessionKey)).not.toContain('NET310');
    expect(planner.compare([alice]).people.map((p) => p.name)).toEqual(['Alice']);

    const mine = planner.saveProfileAs('Work');
    expect(() => planner.compare([ME, mine.id])).toThrow(/no shared plan/);
    expect(() => planner.compare(['nope'])).toThrow(/Unknown profile/);
  });
});
