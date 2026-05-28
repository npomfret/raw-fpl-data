# raw-fpl-data

End-of-season snapshots of the unauthenticated Fantasy Premier League API.

The script fetches every game-data endpoint (players, fixtures, per-gameweek and per-fixture stats) and writes the raw JSON to disk. No manager-, entry-, or league-specific data is captured.

## Usage

```sh
npm install
npm run collect          # fetch fresh, overwriting any existing files
npm run collect:resume   # skip files that already exist on disk
```

A full run is ~420 requests and completes in a few seconds.

## Output

```
data/
  2025-2026/
    bootstrap-static.json           # players, teams, events, scoring rules
    fixtures.json                   # all 380 season fixtures
    current-gameweek.json           # PL resources current matchweek
    events/{1..38}/
      live.json                     # per-player stats for the gameweek
      fixtures.json                 # fixtures filtered to the gameweek
    fixtures/{fixture_id}/
      stats.json                    # per-player stats for the fixture
```

The season directory is hardcoded in `src/index.ts` (`DATA_DIR`); bump it each summer.

## Endpoints

| Endpoint                          | Saved to                                       |
| --------------------------------- | ---------------------------------------------- |
| `/bootstrap-static/`              | `bootstrap-static.json`                        |
| `/fixtures/`                      | `fixtures.json`                                |
| `resources/.../current-gameweek`  | `current-gameweek.json`                        |
| `/event/{id}/live/`               | `events/{id}/live.json`                        |
| `/fixtures/?event={id}`           | `events/{id}/fixtures.json`                    |
| `/fixture/{id}/stats/`            | `fixtures/{id}/stats.json`                     |

See `/Users/nickpomfret/projects/fantasy-football/docs/fpl/fpl-api.md` for endpoint schemas.
