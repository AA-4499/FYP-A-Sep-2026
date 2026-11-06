# Main-compatible environment configuration

Environment configuration has been restored to `main`. `render.yaml`,
`web/frontend/.env.example`, the Knowledge Graph view and shared API origin
resolution follow the main branch. The prediction models, trained checkpoints,
what-if charts, Lab Results and the server preflight fix are retained.

## Frontend

Keep the original `VITE_API_BASE_URL` and original Supabase configuration in the
existing frontend hosting project. The removed model/KG-specific origin variables
and conditional-engine variable are no longer read. Rebuild and redeploy the
frontend after restoring the original variables.

The default v3 engine runs in the browser and reads authorized Supabase records.
It does not require the newly created model Render service. The trained medium
checkpoint and server inference code remain in the repository for later use.
The medium server option has been removed from the simulator because its Render
service was deleted; no new server environment variable is required.

## Clear a saved model-service override

Main's shared API resolver gives the browser-local `dt_forecast_api_url` setting
priority over `VITE_API_BASE_URL`. The frontend now automatically removes that
override only when its host is the deleted `fyp-a-sep-2026-2.onrender.com` service,
then uses the original configured API origin. Existing KG/legacy server settings,
Supabase credentials and other browser data are preserved. The deleted service
cannot be saved again through Service connection.

## Existing backend

Keep the existing backend's environment variables and Neo4j credentials. Do not
replace them with the new model server's settings. Existing CORS configuration
still needs to allow the actual frontend origin; restoring source configuration
does not modify live Render or Vercel settings.

Removing an unused Render model service is a separate dashboard action. No live
service, environment variable, Supabase record or Neo4j graph was deleted by
this source rollback.
