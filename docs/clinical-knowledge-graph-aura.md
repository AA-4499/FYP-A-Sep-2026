# Neo4j Aura Knowledge Graph integration

The Doctor Knowledge Graph workspace reads two graph views from one Neo4j Aura database.

- **Patient graph:** the selected patient's recorded diabetes type, comorbidities and complications, represented as a Patient node linked to Condition nodes.
- **Clinical concept graph:** shared \`:MedicalConcept\` nodes and their literature-linked relationships.

The browser never connects directly to Neo4j and never receives the Neo4j password. The Flask backend authenticates Doctor requests, checks the authenticated user's patient assignments, and then accesses Aura.

## Current Aura connection

Configure these variables on the Python backend (Render for the hosted application):

| Variable | Value |
| --- | --- |
| \`CLINICAL_KG_NEO4J_URI\` | \`neo4j+s://e72f4649.databases.neo4j.io\` |
| \`CLINICAL_KG_NEO4J_USER\` | \`e72f4649\` |
| \`CLINICAL_KG_NEO4J_PASSWORD\` | Use the newly rotated Aura database password |
| \`CLINICAL_KG_NEO4J_DATABASE\` | \`e72f4649\` |

The password was exposed in a chat message. Rotate it in Neo4j Aura before use and configure the replacement only as a backend secret. Do not commit it, put it into Vercel, put it in any \`VITE_*\` variable, or send it in a message. Restart/redeploy the backend after updating environment variables. The checked-in \`.env.example\` files intentionally contain a placeholder, not a real password.

This service connects using the Bolt URI and the Neo4j Python driver. The Aura Query API URL and MCP URL are not used by this code path.

## Seed the new Aura instance

A newly created Aura instance starts with an empty database. Before the Clinical Concepts tab can display the curated Type 2 Diabetes concept graph, import the curated seed package using the included seed and verification instructions. The previous instance's graph is not automatically copied into this instance.

The known curated package was previously verified to contain 37 clinical concepts and 42 concept relationships. After import, use its audit/verification queries to confirm counts and metadata before relying on relationship analysis. Seed the shared concept catalogue before selecting patient graphs; do not run a destructive cleanup query after Patient/Condition nodes have been added.

## Doctor assignments and patient selection

The UI gets selectable patient IDs from \`public.clinician_patient_assignments\`. Each assignment row binds \`clinician_id\` to a \`patient_id\`. The backend independently validates the assignment before returning a selected patient's graph or analysis. It fails closed if the table cannot be read or the patient is not assigned.

Make sure:
1. The \`public.clinician_patient_assignments\` table and its row-level security policies exist.
2. The authenticated Doctor can read their own assignment rows.
3. Each Doctor has one row per patient they manage.
4. The configured Supabase backend credentials point at the same project where the app's patient records and assignments live.

The existing general patient directory and other dashboard authorization rules are controlled by Supabase policies. This KG-specific backend guard is not a substitute for reviewing policies on all patient-record endpoints.

## Patient graph details

The patient graph is synchronised from the authorised \`patient_summary\` record when requested. Only condition labels and the minimum graph structure are written to Aura; raw CGM traces, demographic details, and the complete patient summary are not copied into Aura. Patient-specific graph data is kept distinct by the Patient identifier and connected to shared Condition concept nodes.

For condition extraction, the backend reads the selected summary's recorded fields, including diabetes type, comorbidities, and acute, macrovascular, and microvascular complications.

## Graph analysis and AI provider

The Doctor's Graph Analysis tab compares the selected patient's recorded condition nodes against the shared clinical concept graph.

By default \`KG_AI_PROVIDER=rules\` produces an on-backend graph-grounded summary. It reports direct condition/concept matches and uses only relationships with \`evidenceStatus=reviewed\`. Relationships labelled \`candidate_for_review\` are counted but excluded from reasoning.

To enable a hosted model, configure backend-only values:

\`\`\`dotenv
KG_AI_PROVIDER=openai
OPENAI_API_KEY=<your-own-server-side-key>
OPENAI_MODEL=gpt-4.1-mini
\`\`\`

Never send the OpenAI key to the frontend or commit it. The model request is minimised to recorded condition labels, matched concept details, cited source references, and reviewed relationships; it omits the patient ID, demographic values and raw readings. Because condition labels are still health-related data, enable external model processing only if it is permitted by the team's privacy and project governance. The analysis is decision support for a clinician, not a diagnosis or a treatment plan.

## Endpoints to verify

| Endpoint | Expected purpose |
| --- | --- |
| \`GET /api/health\` | Backend liveness |
| \`GET /api/doctor/assigned-patients\` | Patient IDs assigned to the current Doctor |
| \`GET /api/doctor/knowledge-graph\` | Shared clinical concepts and relationships |
| \`GET /api/doctor/patients/<patient_id>/knowledge-graph\` | Selected assigned patient's condition graph |
| \`POST /api/doctor/patients/<patient_id>/knowledge-graph/analysis\` | Graph-grounded interpretation of the selected patient graph |

Backend unit tests mock Neo4j and Supabase. Passing CI validates the code paths and access checks but does not prove that live Aura credentials, seed data, Supabase assignments, or deployment environment variables are configured correctly.
