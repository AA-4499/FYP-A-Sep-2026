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

The **Knowledge graph** sidebar item in both the doctor and patient workspaces renders `KnowledgeGraphView`. The current frontend is the fixed demonstration described below and makes no graph API requests. Local Vite config proxies `/api` to Flask at port 5000. A future live graph client will need to use the configured backend origin and pass the verified Supabase access token, as the existing patient API requires authentication.

## Test

The current frontend demonstration does not test Neo4j connectivity. To test the separate backend integration, run Flask from `web/backend` with the `PATIENT_NEO4J_*` environment variables and request `/api/patients/<patient_id>/knowledge-graph` using an authorized Supabase bearer token. GET uses the backend patient service; POST can also accept a `patient` object with a matching ID and recorded condition fields when that service has no matching record. The backend prefers its own record. It synchronizes that patient's condition relationships in the dedicated Neo4j database; it does not write Supabase data.

For isolated automated checks without a running Neo4j instance:

```text
python -m unittest discover -s web/backend/tests -p test_patient_knowledge_graph.py -v
```

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

The example source row is `2000_0_20201230`. Its four fields were checked against `data/raw/cleaned_Shanghai_T2DM_Summary.xlsx`: `T2DM`, `hypertension`, `nephropathy`, and hypoglycemia `yes`. The UI normalizes the diagnosis label to Type 2 Diabetes while preserving `T2DM` in the recorded-value inspector. This remains a fixed example, not the current user's condition profile.
