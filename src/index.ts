import { join } from 'node:path';
import { fetchAndSave, pmap, summarise } from './lib';

const FPL_BASE = 'https://fantasy.premierleague.com/api';
const PL_RESOURCES = 'https://resources.premierleague.com';
const DATA_DIR = 'data/2025-2026';
const CONCURRENCY = 5;

interface Event {
  id: number;
}

interface Fixture {
  id: number;
}

interface Bootstrap {
  events: Event[];
}

const skipIfExists = process.argv.includes('--resume');

async function collectGlobals(): Promise<{ bootstrap: Bootstrap; fixtures: Fixture[] }> {
  console.log('[1/3] bootstrap-static + fixtures + current-gameweek');
  const bootstrap = (await fetchAndSave(
    `${FPL_BASE}/bootstrap-static/`,
    join(DATA_DIR, 'bootstrap-static.json'),
    { skipIfExists },
  )) as Bootstrap;

  const fixtures = (await fetchAndSave(
    `${FPL_BASE}/fixtures/`,
    join(DATA_DIR, 'fixtures.json'),
    { skipIfExists },
  )) as Fixture[];

  await fetchAndSave(
    `${PL_RESOURCES}/premierleague25/config/current-gameweek.json`,
    join(DATA_DIR, 'current-gameweek.json'),
    { skipIfExists },
  );

  return { bootstrap, fixtures };
}

async function collectEvents(bootstrap: Bootstrap): Promise<number> {
  console.log(`[2/3] per-event live + per-event fixtures (${bootstrap.events.length} events)`);
  const results = await pmap(bootstrap.events, CONCURRENCY, async event => {
    await fetchAndSave(
      `${FPL_BASE}/event/${event.id}/live/`,
      join(DATA_DIR, 'events', `${event.id}`, 'live.json'),
      { skipIfExists },
    );
    await fetchAndSave(
      `${FPL_BASE}/fixtures/?event=${event.id}`,
      join(DATA_DIR, 'events', `${event.id}`, 'fixtures.json'),
      { skipIfExists },
    );
  });
  return summarise('events', results);
}

async function collectFixtures(fixtures: Fixture[]): Promise<number> {
  console.log(`[3/3] per-fixture stats (${fixtures.length} fixtures)`);
  const results = await pmap(fixtures, CONCURRENCY, async fx => {
    await fetchAndSave(
      `${FPL_BASE}/fixture/${fx.id}/stats/`,
      join(DATA_DIR, 'fixtures', `${fx.id}`, 'stats.json'),
      { skipIfExists },
    );
  });
  return summarise('fixtures', results);
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const { bootstrap, fixtures } = await collectGlobals();

  let failures = 0;
  failures += await collectEvents(bootstrap);
  failures += await collectFixtures(fixtures);

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nFinished in ${elapsedSec}s. ${failures} failure(s).`);
  if (failures > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
