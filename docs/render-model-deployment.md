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
checkpoint and server inference code remain in the repository for later use;
no server model is selected automatically by an environment variable.

## Clear a saved model-service override

Main's shared API resolver gives the browser-local `dt_forecast_api_url` setting
priority over `VITE_API_BASE_URL`. If the new model server was saved in Service
connection, clear that field and save, then reload. Otherwise Knowledge Graph
requests can still be sent to the removed model server even with correct Vercel
variables. This is a local browser setting, not a Supabase assignment.

## Existing backend

Keep the existing backend's environment variables and Neo4j credentials. Do not
replace them with the new model server's settings. Existing CORS configuration
still needs to allow the actual frontend origin; restoring source configuration
does not modify live Render or Vercel settings.

Removing an unused Render model service is a separate dashboard action. No live
service, environment variable, Supabase record or Neo4j graph was deleted by
this source rollback.
