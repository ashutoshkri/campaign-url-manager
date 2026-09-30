# Campaign URL Manager

A small web app for managing ad campaign tracking links. An admin creates a campaign, gets a unique tracking URL like `https://your-domain.com/go/DIWALI2026`, and every visit to that URL is recorded and redirected to the campaign's destination.

![Stack](https://img.shields.io/badge/Node-Express-0b6e69) ![Stack](https://img.shields.io/badge/React-Vite-0b6e69) ![Stack](https://img.shields.io/badge/DB-SQLite-0b6e69) ![Tests](https://img.shields.io/badge/tests-13%20passing-0b6e69)

## Features

- **Create campaigns** with name, campaign ID, destination URL and status (Active / Paused). The campaign ID is suggested from the name and can be edited.
- **Unique tracking URL** per campaign: `/go/<CAMPAIGN_ID>`, with copy and open buttons.
- **Click tracking and redirect**: each visit records the time, IP, user agent and referrer, then sends a `302` redirect to the destination.
- **Dashboard table** with campaign name, campaign ID, status, total clicks and last click time. Auto-refreshes every 10 seconds.
- **Edit, delete and activate/pause** each campaign. Pausing is a one-click toggle.
- **Click history** per campaign: clicks per day for the last 7 days and the 25 most recent clicks with source and device.
- Summary figures, search and status filter, inline validation errors, responsive layout.

## Quick start

Requires **Node.js 20 or newer**.

```bash
npm install
npm run build      # builds the React dashboard
npm run seed       # optional: adds 4 sample campaigns with a week of clicks
npm start
```

Open **http://localhost:4000**. No database setup is needed; SQLite creates `data/campaigns.db` on first run.

Try it: create a campaign, click **Open** next to its tracking URL (or visit `http://localhost:4000/go/<ID>`), then watch the click count and last click time update on the dashboard.

### Development mode

```bash
npm run dev
```

Runs the API on port 4000 (auto-restarts on change) and the Vite dev server with hot reload on **http://localhost:5173**. Vite proxies `/api` and `/go` to the API.

### Tests

```bash
npm test
```

13 API tests using Node's built-in test runner and Supertest, covering create/edit/delete, validation, duplicate IDs, redirects, click counting, paused campaigns, bot filtering, stats and auth. Each test uses a fresh in-memory database.

## Configuration

Copy `.env.example` to `.env` to change defaults. All settings are optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Server port |
| `DB_PATH` | `data/campaigns.db` | SQLite file location |
| `PUBLIC_BASE_URL` | request host | Base for tracking URLs, e.g. `https://track.example.com` |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `admin` / empty | Enables HTTP Basic Auth on the dashboard and API when a password is set |
| `TRUST_PROXY` | `false` | Set `true` behind Render, Nginx, etc. so client IPs and https are detected |

Tracking URLs under `/go/` are always public, even when admin login is on.

## How tracking works

When someone opens `/go/:campaignId`:

1. The campaign is looked up by ID (case-insensitive). Unknown IDs get a "Link not found" page (404).
2. Paused campaigns show a "This link is not active" page (404) and the visit is not counted, so the same link can be switched back on later without changing ads.
3. For active campaigns, the click row is inserted and the campaign's counters are updated **in one SQLite transaction**, then the visitor gets a `302` redirect.

Design decisions worth noting:

- **302, not 301.** Browsers cache 301 redirects permanently and would skip the server on repeat visits, so those clicks would never be recorded. The response also sends `Cache-Control: no-store`.
- **Counters are stored on the campaign row** (`click_count`, `last_click_at`) as well as in the `clicks` log. The dashboard reads totals in O(1) per campaign instead of counting the log on every refresh, and the transaction keeps the two in sync.
- **Link previews are filtered.** When a link is pasted into WhatsApp, Slack, Telegram and similar apps, their preview bots fetch it before anyone clicks. These visits are logged with `is_bot = 1` and shown as "Filtered previews", but are not added to total clicks. `HEAD` requests from link checkers are answered but not recorded.
- **Query parameters pass through.** `/go/DIWALI2026?utm_source=fb&sub1=abc` redirects to the destination with those parameters added, without overriding any the destination already has. Useful for UTM tags and sub-IDs.
- **No redirect loops.** A destination that points to another `/go/` URL on this app is rejected.
- **Validation** happens on the server with Zod: name required, campaign ID 2–50 characters of letters, numbers, `-` or `_` (stored uppercase, unique), destination must be an `http`/`https` URL. Errors are returned per field and shown inline in the form.

## API

All admin endpoints are under `/api` and return JSON.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/campaigns?search=&status=` | List campaigns with click totals |
| `POST` | `/api/campaigns` | Create `{ name, campaignId, destinationUrl, status }` |
| `GET` | `/api/campaigns/:id` | One campaign |
| `PUT` | `/api/campaigns/:id` | Update all fields |
| `PATCH` | `/api/campaigns/:id/status` | Set `{ status: "active" \| "paused" }` |
| `DELETE` | `/api/campaigns/:id` | Delete the campaign and its click history |
| `GET` | `/api/campaigns/:id/clicks` | 7-day daily counts and recent clicks |
| `GET` | `/api/stats` | Totals for the summary row |
| `GET` | `/go/:campaignId` | Public tracking URL: records the click and redirects |
| `GET` | `/health` | Health check |

Errors look like `{ "error": "message", "fields": { "campaignId": "..." } }` with status 400 (validation), 404 (not found), 409 (duplicate campaign ID) or 401 (login required).

## Project structure

```
server/
  index.js              starts the server
  app.js                Express app: security headers, routes, static dashboard
  config.js             environment settings
  db.js                 SQLite connection and schema
  repository.js         all SQL queries, click recording transaction, bot detection
  validation.js         Zod schemas and field error formatting
  routes/campaigns.js   admin REST API
  routes/redirect.js    /go/:campaignId tracking and redirect
  middleware/           basic auth, error handling
client/src/
  App.jsx               dashboard state, polling, actions
  components/           table, create/edit form, delete confirm, click history
  api.js, format.js     fetch wrapper, formatting helpers
scripts/seed.js         sample data
test/api.test.js        API tests
```

## Why this stack

- **Express + React** keeps the backend and the dashboard in one repo and one process in production: Express serves the built React app and the API from the same origin, so there is no CORS setup.
- **SQLite (better-sqlite3)** means the app runs with `npm install` alone, with no database server to install. It handles this workload comfortably, supports transactions and foreign keys (deleting a campaign cascades to its clicks), and all SQL lives in `repository.js`, so moving to PostgreSQL or MongoDB means replacing one file.

## Deploying

Any Node host works (Render, Railway, a VPS). Set `PUBLIC_BASE_URL` to your domain, `TRUST_PROXY=true` behind a proxy, and `ADMIN_PASSWORD`. Use a persistent disk for `DB_PATH`, since many free tiers wipe the filesystem on restart.

## What I would add next

- Unique visitors and per-country breakdown (IP geolocation)
- Rate limiting on `/go/` to reduce click fraud, and a stronger bot list
- Date range filters and CSV export of clicks
- Proper user accounts and roles instead of a single admin login
- Click logging through a queue for very high traffic, so redirects never wait on the database
