# Smart Diabetes Digital Twin and Personalised Health Management Platform

**Swinburne University of Technology Sarawak** · Final Year Project (FYP)  
**Project Supervision:** Ts. Dr. Vong Wan Tze  
**Target Dataset:** ShanghaiT2DM Longitudinal Cohort (100+ Type 2 Diabetes Patients)

---

## 1. Executive Summary & Clinical Background

Diabetes is a chronic metabolic condition that demands continuous monitoring of glycemic control, lifestyle habits, and vascular risk indicators over time. In traditional healthcare settings, patient information is frequently recorded at discrete, sparse points in time (e.g. quarterly or annual clinic visits), making it challenging to establish a clear, holistic understanding of dynamic physiological changes and impending complication trajectories.

This platform establishes a **Smart Diabetes Digital Twin and Personalised Health Management Platform** utilizing the **ShanghaiT2DM longitudinal dataset**. In contrast to single-survey cross-sectional datasets (such as CDC BRFSS), ShanghaiT2DM provides high-frequency repeated measurements, continuous glucose monitoring (CGM) sensor streams (at 15-minute intervals across 14-day monitoring windows), diurnal glycemic excursion profiles, Time-in-Range (TIR) metrics, and historical laboratory trajectories.

### The 9-Step Clinical Digital Twin Workflow
The system orchestrates an end-to-end, patient-centric clinical journey:
```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. Select       │  ──►  │ 2. View Health  │  ──►  │ 3. Assess       │
│    Patient      │       │    History(CGM) │       │    Current Risk │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                                                   │
         ▼                                                   ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 4. Understand   │  ──►  │ 5. Explore      │  ──►  │ 6. View Digital │
│    Factors(XAI) │       │    Insights     │       │    Twin (Organs)│
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                                                   │
         ▼                                                   ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 7. Create What- │  ──►  │ 8. Compare      │  ──►  │ 9. Generate     │
│    If Scenario  │       │    Outcomes     │       │    Report (PDF) │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **Select Patient:** Choose from the cohort of 105 longitudinal ShanghaiT2DM patients with rich clinical history.
2. **View Health History:** Inspect 14-day Continuous Glucose Monitoring (CGM) sensor trends, diurnal meal curves (breakfast, lunch, dinner, dawn phenomenon), Time-in-Range (TIR), Time-Below-Range (TBR), and 18-month visit progressions.
3. **Assess Current Risk:** Evaluate multi-system complication risks (Glycemic Instability, Cardiovascular, Nephropathy, Hypoglycemia) produced by temporal ML models.
4. **Understand Key Factors (XAI):** Unpack patient-specific SHAP feature attributions that explain exactly which clinical biomarkers push risk up or down.
5. **Explore Personalised Insights:** Review patient-specific clinical recommendations, safety warnings, and lifestyle goals.
6. **View Digital Twin:** Inspect multi-organ physiological status (Pancreas, Heart, Kidneys, Liver) and anthropometric avatar metrics.
7. **Create What-If Scenario:** Dynamically adjust dietary plans, aerobic exercise frequency, and physiological targets.
8. **Compare Simulated Outcomes:** Evaluate counterfactual outcome deltas and projected organ stress reductions.
9. **Generate Clinical Report:** Export a consolidated, printable clinical summary complete with institutional letterhead and physician sign-off.

---

## 2. Platform Architecture & Folder Organization

The repository is structured into 5 decoupled layers:

```text
FYP-A-Sep-2026/
├── data/                          # 📁 1. DATASET LAYER
│   ├── raw/                       # Raw ShanghaiT2DM (.xls CGM sensor files + Summary.xlsx)
│   ├── processed/                 # Cleaned patient cohorts & standardized 14-day CSV/Parquet
│   └── loaders/                   # Ingestion scripts & CGM feature extractors (TIR/TBR/TAR)
│
├── models/                        # 📁 2. AI / ML MODELING LAYER (Offline Training)
│   ├── training/                  # Model training scripts (Temporal XGBoost, BiLSTM, LightGBM)
│   ├── evaluation/                # AUROC metrics, validation curves, confusion matrices
│   ├── xai/                       # SHAP TreeExplainer / KernelExplainer training
│   └── weights/                   # Exported model files (*.pkl, *.pt, *.joblib) [gitignored]
│
├── knowledge_graph/               # 📁 3. KNOWLEDGE GRAPH & ONTOLOGY (Outside Web)
│   ├── ontology/                  # SNOMED-CT / ShanghaiT2DM ontology mapping files
│   ├── cypher/                    # Neo4j CQL scripts (constraints, relations, queries)
│   └── seed_graph.py              # Script to populate Neo4j from patient data
│
├── digital_twin/                  # 📁 4. DIGITAL TWIN & SIMULATION CORE (Outside Web)
│   ├── biophysical_models/        # Organ stress algorithms (pancreas, cardiovascular, renal)
│   ├── causal_simulation/         # Counterfactual what-if perturbation logic
│   └── avatar_assets/             # 3D avatars (.glb / .gltf) & morphometry definitions
│
├── web/                           # 📁 5. PRODUCTION WEB PLATFORM (Deployable)
│   ├── backend/                   # Flask REST API (Deployed on Render)
│   │   ├── app.py                 # REST routes & CORS gateway
│   │   ├── services/              # Pluggable runtime service wrappers
│   │   ├── requirements.txt       # Production dependencies
│   │   └── tests/                 # REST endpoint automated test suite
│   │
│   └── frontend/                  # React 18 + Vite + TypeScript (Deployed on Vercel)
│       ├── src/
│       │   ├── components/        # Tabs, Recharts CGM charts, Cytoscape canvas
│       │   ├── api/               # Typed fetch client
│       │   └── types/             # Shared TypeScript interfaces
│       ├── package.json
│       ├── vercel.json            # SPA URL rewrite rules
│       └── vite.config.ts
│
├── render.yaml                    # Infrastructure-as-code for Render backend (rootDir: web/backend)
├── docs/                          # Swinburne FYP reports & architecture documentation
└── README.md                      # Master team onboarding & setup guide
```

---

## 3. Team Member Onboarding & Contribution Guide

> [!IMPORTANT]
> **Zero-Breakage Guarantee:** The platform is designed with contract interfaces and high-fidelity stubs. Every service in `web/backend/services/` currently returns realistic ShanghaiT2DM patient data so the frontend runs out-of-the-box. As each team member builds their module, they replace the internal logic in their assigned file **without modifying other services or breaking the web application**.

### Module Assignment & API Contract Table

| Module & Assignment | Responsible File | Primary REST Endpoint | Key Inputs / Outputs |
| :--- | :--- | :--- | :--- |
| **1. Patient Management** | `web/backend/services/patient_service.py` | `GET /api/patients`<br>`GET /api/patients/<id>` | Input: query, page<br>Output: Demographic profile (age, BMI, duration, BP, HbA1c, FBG, meds) |
| **2. Longitudinal Monitoring** | `web/backend/services/longitudinal_service.py` | `GET /api/patients/<id>/timeline` | Input: patient_id<br>Output: 14-day CGM daily summaries, 24-hr diurnal curve, TIR/TBR/TAR, visit history |
| **3. Risk Assessment** | `web/backend/services/risk_model_service.py` | `POST /api/patients/<id>/risk-assessment` | Input: patient_id, optional feature overrides<br>Output: Composite risk %, sub-risks (glycemic, CV, hypo, renal) |
| **4. Explainable AI (XAI)** | `web/backend/services/xai_service.py` | `POST /api/patients/<id>/xai-explanation` | Input: patient_id, optional feature overrides<br>Output: SHAP attribution values, waterfall directions, clinical summary |
| **5. Knowledge Graph** | `web/backend/services/knowledge_graph_service.py` | `GET /api/patients/<id>/knowledge-graph` | Input: patient_id<br>Output: Cytoscape elements (nodes: biomarkers, risks, drugs; edges: relationships) |
| **6. Trend Insights** | `web/backend/services/insights_service.py` | `POST /api/patients/<id>/insights` | Input: patient_id, optional feature overrides<br>Output: Alert level (normal/warning/urgent), targeted recommendations |
| **7. Digital Twin State** | `web/backend/services/digital_twin_service.py` | `GET /api/patients/<id>/digital-twin` | Input: patient_id, optional feature overrides<br>Output: Organ stress scores (pancreas, heart, kidney, liver), avatar glow |
| **8. What-If Simulation** | `web/backend/services/simulation_service.py` | `POST /api/patients/<id>/simulate` | Input: Diet, exercise, HbA1c delta, BP delta, TIR delta<br>Output: Baseline vs simulated comparison, risk delta % |
| **9. Clinical Reporting** | `web/backend/services/reporting_service.py` | `GET /api/patients/<id>/report` | Input: patient_id<br>Output: Consolidated medical summary JSON for PDF printing |

---

## 4. Local Development & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Git

### 1. Backend Setup
```powershell
# From repository root
cd web/backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run Flask backend server
python app.py
# Backend runs at http://localhost:5000
```

### 2. Frontend Setup
```powershell
# From repository root
cd web/frontend
npm install
npm run dev
# Vite dev server runs at http://localhost:5173
```

---

## 5. Automated Testing & Verification

Run automated test suites to ensure zero regressions before pushing code:

```powershell
# 1. Run all 12 backend REST API integration tests (from repository root)
python -m unittest web/backend/tests/test_api_endpoints.py

# 2. Verify frontend TypeScript types and build bundle
cd web/frontend
npm run build
```

---

## 6. Cloud Deployment Guide

### Deploying Frontend on Vercel
1. Link your GitHub repository to **Vercel**.
2. Set **Root Directory** to `web/frontend`.
3. Set **Framework Preset** to `Vite`.
4. Add Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-backend-render-app.onrender.com`
5. Deploy. (Routing is handled automatically by `web/frontend/vercel.json`).

### Deploying Backend on Render
1. Create a **Web Service** on **Render** linked to this repo.
2. In Render settings (or via `render.yaml`):
   - **Root Directory:** `web/backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn -w 2 -b 0.0.0.0:$PORT app:app`
3. Set Environment Variables:
   - `PORT`: `5000`
   - (Optional) `GEMINI_API_KEY` or `NEO4J_URI`

---

## 7. Academic Attribution & License

- **Institution:** Swinburne University of Technology Sarawak Campus
- **Project Title:** Smart Diabetes Digital Twin and Personalised Health Management Platform
- **Supervisor:** Ts. Dr. Vong Wan Tze
- **Cohort Dataset:** ShanghaiT2DM (Longitudinal Continuous Glucose Monitoring & Clinical Records)
- **License:** MIT License for academic and research evaluation.
