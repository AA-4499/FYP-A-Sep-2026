# Digital Twin event catalog and compact workspace

Digital Twin keeps the existing left navigation and Recommendations components.
Its center column has **Prediction** and **What-if events** tabs. Prediction
uses the full center width. Events are edited in the other tab, and a successful
run returns to the prediction. Drafts persist across tab switches. The forecast
values, source settings, model explanations and optional meal nutrients start
collapsed. Existing draft invalidation and Lab Results saving remain intact.

Food, insulin and activity share `EventCatalogPicker`: common choices, a search
box and a small scrollable popup. Clicking a match closes the popup; clicking
the search field again reopens it. Arrow keys, Enter and Escape are supported.
Activity searches all supported presets, with no contradictory category filter.
Insulin lists only the model's two supported bolus formulations, not an assumed
catalog of all medicines or recommended doses.

## Actual Supabase food schema

Read-only verification on 2026-11-16 found **1,677 rows** in
`public.food_composition`, including 47 matches for `rice`. The deployed table
uses unit-bearing columns: `CHO (g)`, `dietaryFiber (g)`, `protein (g)` and
`fat (g)`. The earlier frontend/backend searches used nonexistent `CHO` and
`dietaryFiber` columns. The backend now aliases the actual columns, returns
accurate matching counts, and pages 30 records at a time.

The frontend first queries using the signed-in session and existing RLS. If
that route is unavailable or returns an ambiguous empty result, it uses
authenticated `GET /api/food-composition?q=...&offset=...` on the configured
backend. Browser code never receives the server secret. Existing database
policies are unchanged. A query failure is shown with Retry and manual entry,
not represented as an empty food database. Superseded queries are cancelled.

Per the previously confirmed dataset convention, CHO is available carbohydrate
per 100 g edible portion; v3 adds known dietary fiber once for total carbs.
Unknown nutrients stay unknown. Catalog protein/fat/fiber are filled only when
all three are present and are recalculated with portion changes. Saved event
plans preserve the food reference ID, nutrient basis and metadata fingerprint.
Quick choices remain clearly editable reference estimates, not database rows.

## Verification and deployment

282 frontend tests and the original 158 backend tests passed; two additional
backend paging/invalid-offset tests also passed in the 10-test food/storage
suite. TypeScript and production build passed. Chrome exercised the real
Supabase catalog through a loopback test server, all three event pickers, one
real combined GRU prediction, saved event provenance, display intervals and
1536/1280/1024/390 px layouts with the actual two sidebar components. Patient
data were synthetic and saves were intercepted locally; no live DB writes.

The configured production Render address was confirmed by the user as
`https://diabetes-digital-twin-kg-api.onrender.com`; it timed out during this
session. The backend food schema fix must be deployed there as well as the
frontend release. Vercel deployment alone does not deploy the Python backend.
Live end-user search under the production RLS/session has not been verified.
