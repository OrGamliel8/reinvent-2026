import { describe, expect, it } from 'vitest';
import { loadSqlite } from '../src/core/sqlite';
import { SqliteUserStore } from '../src/core/store/sqliteUserStore';
import { add, fixtureProfile, openPlanner } from './helpers';

describe('manual scores', () => {
  it('lets a positive manual score override the avoid list, while Skip keeps it excluded', async () => {
    const { planner } = await openPlanner();
    expect(planner.rank({}).map((r) => r.session.key)).not.toContain('BLK201');

    planner.setManualScore('BLK201', 60);
    const scored = planner.rank({}).find((r) => r.session.key === 'BLK201')!;
    expect(scored).toMatchObject({ score: 60, manualScore: 60 });
    expect(scored.explanation.avoided).toEqual(['keyword "blockchain"']);

    planner.setManualScore('BLK201', 0);
    expect(planner.rank({}).map((r) => r.session.key)).not.toContain('BLK201');
  });

  it('reorders the ranking and is reported alongside the computed score; clearing restores it', async () => {
    const { planner } = await openPlanner();
    const computed = planner.explain('STG201')!.score;
    expect(planner.explain('STG201')).toMatchObject({ manualScore: null, computedScore: computed });

    planner.setManualScore('STG201', 99.6);
    const ranked = planner.rank({});
    expect(ranked[0]).toMatchObject({ session: { key: 'STG201' }, score: 100, manualScore: 100, computedScore: computed });
    expect(planner.manualScores()).toEqual({ STG201: 100 });
    planner.setManualScore('SEC401', 0);
    expect(planner.rank({}).at(-1)!.session.key).toBe('SEC401');

    planner.setManualScore('STG201', null);
    planner.setManualScore('SEC401', null);
    expect(planner.manualScores()).toEqual({});
    expect(planner.explain('STG201')).toMatchObject({ score: computed, manualScore: null });
    expect(planner.rank({})[0].session.key).toBe('SEC401');
  });

  it('filters by scored / not scored', async () => {
    const { planner } = await openPlanner();
    planner.setManualScore('STG201', 40);
    planner.setManualScore('SEC310', 80);
    expect(planner.rank({ scored: 'manual' }).map((r) => r.session.key)).toEqual(['SEC310', 'STG201']);
    const unscored = planner.rank({ scored: 'unscored' }).map((r) => r.session.key);
    expect(unscored).not.toContain('STG201');
    expect(unscored.length).toBe(planner.rank({}).length - 2);
  });

  it('0 excludes a session from auto-build suggestions and alternatives; > 0 makes an irrelevant session suggestable', async () => {
    const { planner } = await openPlanner();
    expect(planner.autoBuild().agenda.map((i) => i.sessionKey)).toContain('SEC401');
    expect(planner.autoBuild().agenda.map((i) => i.sessionKey)).not.toContain('STG201');

    planner.setManualScore('SEC401', 0);
    planner.setManualScore('STG201', 100);
    const keys = planner.autoBuild().agenda.map((i) => i.sessionKey);
    expect(keys).not.toContain('SEC401');
    expect(keys).toContain('STG201');

    const { planner: fresh } = await openPlanner();
    const alternativeKeys = (): string[] => fresh.alternatives({ sessionKey: 'SEC310' }).map((a) => a.sessionKey);
    add(fresh, 'SEC310'); // Tue 13:00; NET310 runs in the same window
    expect(alternativeKeys()).toContain('NET310');
    fresh.setManualScore('NET310', 0);
    expect(alternativeKeys()).not.toContain('NET310');
  });

  it('starred sessions are still placed even with a manual 0', async () => {
    const { planner } = await openPlanner();
    planner.star('STG201');
    planner.setManualScore('STG201', 0);
    expect(planner.autoBuild().agenda.find((i) => i.sessionKey === 'STG201')).toMatchObject({ origin: 'starred' });
  });

  it('survives a profile swap and persists in the SQLite store', async () => {
    const sqlite3 = await loadSqlite();
    const db = new sqlite3.oo1.DB(':memory:');
    const { planner } = await openPlanner({ store: new SqliteUserStore({ db }) });
    planner.setManualScore('STG201', 75);
    planner.updateProfile({ ...fixtureProfile(), interests: [] });
    expect(planner.importProfile(JSON.stringify(fixtureProfile()))).toMatchObject({ ok: true });
    expect(planner.explain('STG201')).toMatchObject({ score: 75, manualScore: 75 });
    expect(new SqliteUserStore({ db }).getManualScores()).toEqual({ STG201: 75 }); // reopening an existing DB is idempotent
  });

  it('round-trips through state export/import, and imports older state without scores', async () => {
    const { planner } = await openPlanner();
    planner.setManualScore('STG201', 60);
    planner.setManualScore('SEC401', 0);
    const exported = planner.exportState();
    expect(JSON.parse(exported).manualScores).toEqual({ STG201: 60, SEC401: 0 });

    const { planner: fresh } = await openPlanner();
    fresh.setManualScore('SEC310', 10);
    expect(fresh.importState(exported)).toEqual({ ok: true, value: null });
    expect(fresh.manualScores()).toEqual({ STG201: 60, SEC401: 0 });

    const legacy = JSON.parse(exported);
    delete legacy.manualScores;
    expect(fresh.importState(JSON.stringify(legacy))).toEqual({ ok: true, value: null });
    expect(fresh.manualScores()).toEqual({});
  });

  it('round-trips through agenda export/import: merge lets imported scores win, replace replaces all, unknown sessions are skipped', async () => {
    const { planner } = await openPlanner();
    planner.setManualScore('STG201', 60);
    planner.setManualScore('SEC401', 0);
    const payload = JSON.parse(planner.exportAgenda());
    expect(payload.scores).toEqual([
      { sessionKey: 'STG201', code: 'STG201', title: expect.any(String), score: 60 },
      { sessionKey: 'SEC401', code: 'SEC401', title: expect.any(String), score: 0 },
    ]);
    payload.scores.push({ sessionKey: 'GONE999', code: 'GONE999', title: 'Gone', score: 50 });

    const { planner: other } = await openPlanner();
    other.setManualScore('STG201', 10);
    other.setManualScore('SEC310', 90);
    const merged = other.importAgenda(JSON.stringify(payload), { mode: 'merge', includeBlocks: false });
    expect(merged).toMatchObject({ ok: true, value: { scores: 2, skipped: [{ code: 'GONE999', reason: 'scored session not in catalog' }] } });
    expect(other.manualScores()).toEqual({ STG201: 60, SEC310: 90, SEC401: 0 });

    expect(other.importAgenda(JSON.stringify(payload), { mode: 'replace', includeBlocks: false })).toMatchObject({ ok: true });
    expect(other.manualScores()).toEqual({ STG201: 60, SEC401: 0 });

    delete payload.scores;
    expect(other.importAgenda(JSON.stringify(payload), { mode: 'merge', includeBlocks: false })).toMatchObject({ ok: true, value: { scores: 0 } });
    expect(other.manualScores()).toEqual({ STG201: 60, SEC401: 0 });
  });

  it('validates the score and the session', async () => {
    const { planner } = await openPlanner();
    expect(() => planner.setManualScore('NOPE', 50)).toThrow(/Unknown session/);
    expect(() => planner.setManualScore('STG201', 101)).toThrow(/0 to 100/);
    expect(() => planner.setManualScore('STG201', -1)).toThrow(/0 to 100/);
    expect(() => planner.setManualScore('STG201', Number.NaN)).toThrow(/0 to 100/);
    expect(planner.manualScores()).toEqual({});
  });
});
