# HStats Frontend

HStats Frontend is the web application for [HStats.dev](https://hstats.dev), a lightweight analytics platform for the Hytale modding community.

It displays live network statistics, mod analytics, developer profiles, documentation, account login, and the private dashboard used by mod developers to manage their tracked mods.

[Visit HStats.dev](https://hstats.dev)

## What This Frontend Does

- Shows live HStats network totals for servers, players, countries, developers, and tracked mods.
- Provides a searchable public mods directory with detailed per-mod analytics.
- Renders global and per-mod charts for hourly history, versions, countries, operating systems, Java versions, CPU cores, and co-installed mods.
- Supports developer account login, registration, Discord OAuth, and reCAPTCHA-protected registration.
- Provides a private dashboard for creating mods, viewing public Mod IDs, copying private server reporting keys, editing profile links, and managing mod links.
- Displays public developer profiles with managed mods and aggregate usage share.
- Documents the HStats class integration and public stats API endpoints.
- Builds public SEO metadata, Open Graph tags, a sitemap, robots rules, and SPA route fallbacks.

## Privacy Model

This frontend does not ingest Hytale server telemetry directly. It renders data from the HStats backend and sends account, dashboard, and authentication requests to the configured API.

The frontend displays aggregate analytics such as:

- Active server and player counts.
- Country-level, operating system, Java version, and CPU core distributions.
- Public mod names, public Mod IDs, public developer profile links, and embed URLs.
- Account-owned private server reporting keys inside the authenticated dashboard.

The frontend includes:

- Google Analytics tracking in `index.html`.
- Google reCAPTCHA v3 loading on registration.
- Cookie-backed API requests using `credentials: "include"`.

Do not expose private server reporting keys outside the dashboard or server integration code.

## Public and Private Mod IDs

HStats uses two identifiers for each mod:

- Public Mod ID: safe for routes, public API responses, embeds, and sharing.
- Private server reporting key: used by Hytale servers to submit stats.

Frontend public pages use public Mod IDs. The private server reporting key is shown only in the authenticated dashboard and should be used only by the server-side mod integration.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0` for Vite 7.
- npm.
- A running HStats backend API for live data, dashboard, and authentication flows.

## Setup

Install dependencies:

```powershell
npm install
```

Create a local environment file:

```powershell
New-Item .env.local -ItemType File
```

Configure the backend API URL:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

Optionally override the reCAPTCHA site key used by registration:

```env
VITE_RECAPTCHA_SITE_KEY=...
```

Run the frontend:

```powershell
npm run dev
```

Build for production:

```powershell
npm run build
```

Preview the production build locally:

```powershell
npm run preview
```

## Environment Configuration

Supported Vite environment variables:

- `VITE_API_BASE_URL`: backend API root. Defaults to `http://localhost:3000/api`.
- `VITE_RECAPTCHA_SITE_KEY`: Google reCAPTCHA v3 site key for registration.

Vite environment variables are bundled into client-side code. Do not put secrets in `VITE_*` variables.

The backend must be configured to allow the frontend origin and cookie-based sessions when using login, registration, Discord OAuth, or the dashboard.

## Routes

Public routes:

- `/` - home page and live network summary.
- `/overall-stats` - global charts, history, important date markers, and activity feed.
- `/mods` - searchable mods directory.
- `/mods/:pluginUuid` - detailed public mod analytics.
- `/developers/:developerUuid` - public developer profile.
- `/docs` and `/documentation` - integration and public API documentation.
- `/bstats-for-hytale` - SEO article explaining HStats as bStats-style analytics for Hytale.
- `/tos` - terms of service.
- `/privacy` - privacy policy.

Account routes:

- `/auth` - login/register page.
- `/login` - login mode.
- `/register` - registration mode.
- `/dashboard` - authenticated developer dashboard.

## Dashboard

The dashboard requires an active backend session.

Developers can:

- Create and delete tracked mods.
- Copy public Mod IDs and private server reporting keys.
- View live per-mod analytics and history charts.
- Refresh private server reporting keys.
- Edit mod GitHub and CurseForge links.
- Edit public username and developer profile links.
- Preview and copy developer SVG embed URLs.
- Log out of the current session.

Dashboard mod analytics refresh every 15 seconds by default.

## Charts and Analytics

Charts are rendered with Chart.js, `chartjs-plugin-zoom`, and `chartjs-plugin-annotation`.

The app supports:

- Time-series server and player history.
- Zoom reset controls.
- Preset and custom date ranges.
- Important date marker overlays.
- Pie and bar charts for environment distributions.
- Per-mod version and co-installed mod breakdowns.

## Deployment

Production output is written to `dist/`:

```powershell
npm run build
```

This is a single-page app. Hosts must route unknown paths back to `index.html`.

The repository includes `public/_redirects` for Netlify-style deployments:

```text
/* /index.html 200
```

For other hosts, configure an equivalent SPA fallback for routes such as `/mods/:id`, `/developers/:id`, and `/dashboard`.

## Project Structure

- `src/main.js` - app startup, theme initialization, session refresh, and router bootstrapping.
- `src/router.js` - client-side routing and per-route SEO metadata.
- `src/api/` - API wrappers for account, plugin, and server stats endpoints.
- `src/pages/` - route-level page modules.
- `src/components/` - shared UI, chart, analytics, loading, error, and empty-state components.
- `src/utils/` - formatting, escaping, theme, SEO, Ko-fi, and plugin access helpers.
- `public/` - static assets, sitemap, robots file, 404 page, and SPA redirects.

## Security

Do not publish:

- `.env.local`
- Private server reporting keys
- Backend session secrets
- Discord OAuth secrets
- reCAPTCHA secret keys
- API credentials or webhook URLs

Only public browser-safe values should be placed in `VITE_*` variables.

