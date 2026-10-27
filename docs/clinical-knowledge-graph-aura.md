# Neo4j Aura clinical knowledge graph connection

The Doctor Knowledge Graph page reads the shared clinical concept graph from Neo4j Aura through the Flask backend. The frontend never connects directly to Neo4j and never receives the Neo4j password.

## Architecture

1. The React page requests \`GET /api/doctor/knowledge-graph\` from the Python backend.
2. The backend validates the signed-in Supabase access token and requires the trusted Doctor role.
3. The backend uses the Neo4j Python driver with the Aura Bolt URI and server-side environment variables.
4. The backend runs read-only queries against \`:MedicalConcept\` nodes and relationships between those nodes.
5. The frontend renders the returned concepts and relationships using Cytoscape. Relationship source references and \`evidenceStatus\` are shown in the inspector.

The endpoint does not create, update or delete graph data. It does not query patient-specific nodes. Patient context displayed elsewhere on the page continues to come from the selected application record. Candidate relationships can be visualised with their status, but this endpoint is not an AI recommendation endpoint and does not mark candidates as reviewed.

## Server environment variables

Configure these variables on the **Python backend service** (Render for the deployed application), not in Vercel's public frontend variables:

| Variable | Value |
| --- | --- |
| \`CLINICAL_KG_NEO4J_URI\` | \`neo4j+s://63525938.databases.neo4j.io\` |
| \`CLINICAL_KG_NEO4J_USER\` | The Neo4j Aura database username, usually \`neo4j\` |
| \`CLINICAL_KG_NEO4J_PASSWORD\` | The Aura database password (server-side secret) |
| \`CLINICAL_KG_NEO4J_DATABASE\` | \`neo4j\`, unless the Aura instance uses another database name |

Use a dedicated read-only database account for this visualisation where your Aura setup supports it. Do not commit a real password or place it in a \`VITE_*\` variable. The checked-in \`.env.example\` contains only a placeholder; put real values in a local ignored \`.env\` file or the hosting provider's secret environment-variable settings.

For local development, keep \`VITE_API_BASE_URL\` set to the Flask server origin (usually \`http://localhost:5000\`). For deployment, set it to the deployed Python API origin without a trailing \`/api\`, and ensure the exact Vercel origin is included in the backend \`ALLOWED_ORIGINS\`.

## URLs provided by Aura

The application uses the Bolt URI with the Neo4j Python driver. The Query API URL and MCP URL are not used by this implementation; they are alternative interfaces for different integration styles and do not replace the username/password required by the Bolt driver.

## Failure behavior

If the backend variables are missing, the Aura instance is unavailable, the signed-in user is not a Doctor, or the backend is not configured, the API returns a clear error. The frontend displays the error and offers a retry button. The UI must not substitute static demo graph data when the live request fails.

## API response

The response contains graph source/scope, counts, concept nodes (including category, description, source references and schema version), and concept edges (including predicate, source references, evidence note and evidence status). All fields are returned as JSON-safe strings, arrays and counts.
