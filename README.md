# Window Film Leads → Workflow (Prototype)

This is a **working, offline prototype** for window film companies to turn leads into a repeatable workflow that improves conversion and average order value.

It runs as a static page and stores data in your browser via `localStorage` (no server required).

## Run

- Open `/Users/alexpotter/Documents/New project/index.html` in your browser.
- Click a seed lead, then use:
  - `Create follow-ups`
  - `Generate ballpark`
  - `Generate proposal`
  - `Draft reply`

## Data + Export/Import

- Storage: browser `localStorage` key `wf_db_v1`
- Export: click `Export` (downloads a JSON file)
- Import: click `Import` (paste a previously exported JSON)

## Pricing Assumptions (placeholders)

The default pricing config is embedded in `/Users/alexpotter/Documents/New project/app.js` as `DEFAULT_SETTINGS`:

- Material cost placeholder: `material_per_sqft_default = 1.10`
- Labor rates: `labor_per_sqft`
- Waste factors: `waste_factor`
- Minimum jobs: `minimum_job`
- Gross margin targets: `gross_margin_targets`

## Next Prototype Upgrades (if you want me to build them)

- “Good / Better / Best” proposal options (3 tiers)
- Film catalog import (CSV) + compatibility flags
- Calendar + SMS/email integrations (requires a backend + credentials)
- Multi-user storage (SQLite/Postgres) + role-based access

