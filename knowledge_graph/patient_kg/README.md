# Patient condition KG integration

This branch replaces the illustrative Module 5 graph generator with a graph containing only one central `Patient` node and relationships to recorded diabetes and other conditions. It uses the existing patient service first; the browser sends a restricted payload as a fallback when the selected ID is not available in the current backend service. In the integrated deployment, keep the patient's Supabase-backed service authoritative.

## Separate Neo4j environment

The compose file in this folder starts Neo4j Community on Browser port 7475 and Bolt port 7688. It has a separate host data directory and does not change the team's admin Neo4j on 7474/7687.

1. Copy `.env.example` to `.env` in this directory.
2. From this directory run `docker compose -p patient-kg up -d`.
3. Open `http://localhost:7475` and sign in with the username `neo4j` and the password in your local `.env`.
4. Run the two statements from `schema.cypher` separately.

The sample password is for local development only. Change it in the local, ignored `.env` before using on a network. Do not commit secrets.

## Backend

The backend reads only the `PATIENT_NEO4J_*` variables, not generic `NEO4J_*` settings, to avoid accidentally connecting to the admin graph. For Flask run directly on Windows, ensure its process has:

- `PATIENT_NEO4J_URI=bolt://127.0.0.1:7688`
- `PATIENT_NEO4J_USER=neo4j`
- `PATIENT_NEO4J_PASSWORD=<same password as the container>`

Set these in your terminal/process or local secret manager. Copying `.env.example` to `.env` does not automatically load environment values into Python unless the app already loads dotenv. If Flask runs inside Docker, set the URI to `bolt://host.docker.internal:7688`.

Install dependencies from `web/backend/requirements.txt`; the Neo4j driver is already listed. The frontend dependencies already include Cytoscape.

## Frontend behaviour

The existing `Knowledge graph` sidebar route now renders `KnowledgeGraphView`. Local Vite config proxies `/api` to Flask at port 5000. If frontend and backend are deployed separately, configure the existing `VITE_API_BASE_URL` deployment variable to the backend origin.

## Test

Run Flask from `web/backend`, run Vite from `web/frontend`, select a patient, then open **Knowledge graph**. The frontend posts only the selected ID and condition-related fields to the existing route. The backend prefers its own patient record; the small request payload is used only when the backend patient service does not find that ID.

In Neo4j Browser, run each query separately:

```cypher
MATCH (p:Patient)-[r:HAS_CONDITION]->(c:Condition)
RETURN p, r, c LIMIT 100;
```

```cypher
MATCH (n) RETURN labels(n) AS labels, count(*) AS count ORDER BY count DESC;
```

The graph intentionally excludes demographics, biomarkers, medications, risk scores, treatment recommendations, and causal assertions. Relationship labels describe recorded conditions.


## Phase 2 web-app demonstration

The frontend Knowledge Graph page currently uses a fixed demonstration record so it can be reviewed without changing the team's authentication or Supabase integration.

- Open the existing **Knowledge graph** item in the sidebar.
- The page shows one central patient node and four condition nodes.
- Select a node to inspect the recorded value, source field, relationship type, and explanatory note.
- The page labels the sample record and explicitly states that it is not connected to the signed-in user yet.
- No Supabase writes, schema changes, authentication changes, or patient selector changes are part of this demonstration.

The demo is implemented in `web/frontend/src/components/KnowledgeGraphView.tsx`. Later, the group can replace `DEMO_RECORD`, `DEMO_NODES`, and `DEMO_RELATIONSHIPS` with an API payload while preserving the graph and node-details UI.

The example source row is `2000_0_20201230`; it uses the recorded Type 2 diabetes, hypertension, nephropathy, and hypoglycemia values. Verify those values against the team's agreed demo record before presenting.
