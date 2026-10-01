# System Architecture & Directory Organization

**Swinburne University of Technology Sarawak** · Final Year Project (FYP)  
**Supervisor:** Ts. Dr. Vong Wan Tze  
**Project:** Smart Diabetes Digital Twin and Personalised Health Management Platform

---

## 5-Tier Decoupled Architecture

```text
FYP-A-Sep-2026/
├── data/                          # 📁 1. DATASET LAYER
│   ├── raw/                       # Raw ShanghaiT2DM files (.xls sensor files, Summary.xlsx)
│   ├── processed/                 # Standardized clean parquet/CSV matrices
│   └── loaders/                   # Ingestion scripts (shanghai_loader.py)
│
├── models/                        # 📁 2. AI / ML MODELING LAYER (Offline Training)
│   ├── training/                  # Model training scripts (Temporal XGBoost, BiLSTM)
│   ├── evaluation/                # AUROC metrics, validation curves, confusion matrices
│   ├── xai/                       # SHAP TreeExplainer & feature importance scripts
│   └── weights/                   # Exported model weights (*.pkl, *.pt) [gitignored]
│
├── knowledge_graph/               # 📁 3. KNOWLEDGE GRAPH & ONTOLOGY (Outside Web)
│   ├── ontology/                  # SNOMED-CT / ShanghaiT2DM ontology schemas
│   ├── cypher/                    # Neo4j CQL constraints & relation definitions
│   └── seed_graph.py              # Script to populate Neo4j from patient data
│
├── digital_twin/                  # 📁 4. DIGITAL TWIN & SIMULATION CORE (Outside Web)
│   ├── biophysical_models/        # Organ stress mathematical algorithms
│   ├── causal_simulation/         # Counterfactual what-if perturbation logic
│   └── avatar_assets/             # 3D avatars (.glb / .gltf) & morphometry definitions
│
├── web/                           # 📁 5. PRODUCTION WEB PLATFORM (Deployable)
│   ├── backend/                   # Flask REST API (Deployed to Render)
│   │   ├── app.py                 # REST routes & CORS gateway
│   │   ├── services/              # Pluggable runtime service wrappers
│   │   ├── requirements.txt       # Production dependencies
│   │   └── tests/                 # REST endpoint automated test suite
│   │
│   └── frontend/                  # React 18 + Vite + TypeScript (Deployed to Vercel)
│       ├── src/
│       │   ├── components/        # Multi-tab workflow, Recharts CGM, Cytoscape
│       │   ├── api/               # Typed fetch client
│       │   └── types/             # Shared TypeScript schemas
│       ├── package.json
│       ├── vercel.json            # SPA rewrite routing
│       └── vite.config.ts
│
├── render.yaml                    # Render Web Service Blueprint (rootDir: web/backend)
├── docs/                          # Architecture & FYP project documentation
└── README.md                      # Master team onboarding & setup guide
```

---

## Separation of Concerns: Outside Web vs Inside Web

1. **Knowledge Graph:**
   - **Outside (`knowledge_graph/`):** Graph modeling, schema design, constraints, and batch database seeding.
   - **Inside (`web/backend/services/knowledge_graph_service.py` & `web/frontend/`):** Lightweight runtime query execution returning JSON nodes/edges to Cytoscape.js.

2. **Digital Twin & Cyber Simulation:**
   - **Outside (`digital_twin/`):** Biophysical differential equations, causal inference models (DoWhy/EconML), and 3D mesh morphing pipelines.
   - **Inside (`web/backend/services/simulation_service.py` & `digital_twin_service.py`):** User slider evaluation and response formatting for before/after outcome visualization in under 100ms.
