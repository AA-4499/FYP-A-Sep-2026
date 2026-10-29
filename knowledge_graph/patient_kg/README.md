# Isolated local Neo4j sandbox

This directory contains an optional local Neo4j Community instance for isolated experiments. It is **not** the database used by the deployed Doctor Knowledge Graph.

The integrated application is implemented in `web/backend/services/clinical_knowledge_graph_service.py` and `web/backend/services/knowledge_graph_service.py`:

- The shared Aura instance stores reusable `:MedicalConcept` nodes and their reviewed/candidate relationships.
- The Flask backend reads a doctor's assigned patient IDs from Supabase and verifies assignments again on patient graph and analysis routes.
- The patient's graph is composed in memory from the authoritative Supabase record and the shared clinical concepts. Patient nodes, identifiers, demographics, and readings are not persisted to Aura.
- Deployment configuration belongs under the `CLINICAL_KG_NEO4J_*` environment variables described in [the Aura integration guide](../../docs/clinical-knowledge-graph-aura.md).

## Start the isolated local database

1. Copy `.env.example` to `.env` in this folder and change the local password.
2. From this folder, run `docker compose -p patient-kg up -d`.
3. Open `http://localhost:7475` and sign in with username `neo4j` and the local password.
4. Run statements from `schema.cypher` only against this local instance.

The Compose file binds Browser to `127.0.0.1:7475` and Bolt to `127.0.0.1:7688`, separate from the root project's local Neo4j ports (`7474` and `7687`). The sample credentials are for local development only. Never use them for a network-accessible database, and do not commit the real local `.env`.

The local `PATIENT_NEO4J_*` variables are not used by the deployed shared clinical graph service. Do not confuse them with `CLINICAL_KG_NEO4J_*`, and do not run the legacy patient-data seed scaffold against the shared Aura instance.
