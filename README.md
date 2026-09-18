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

## 2. Platform Architecture

The system is engineered as a decoupled, cloud-ready architecture:
```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 REACT FRONTEND (Vercel)                                 │
│                                                                                         │
│  • React 18 + Vite + TypeScript + Tailwind CSS                                          │
│  • Recharts: CGM 14-day trends, 24-hr diurnal profiles, 18-month HbA1c trajectories     │
│  • Cytoscape.js: Personal health knowledge graph & SNOMED-CT clinical ontology          │
│  • Print Engine: Native browser vector printing for A4 clinical reports                 │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ HTTPS / JSON REST API
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FLASK BACKEND (Render)                                  │
│                                                                                         │
│  app.py — Route Handlers, CORS, Request Validation, Static Distribution Fallback        │
│                                                                                         │
│  services/ (Modular Architecture with Typed Pluggable Stubs)                            │
│  ├── patient_service.py         [Teammate A: Patient Ingestion & Search]               │
│  ├── longitudinal_service.py    [Teammate B: Continuous Glucose Monitoring (CGM)]       │
│  ├── risk_model_service.py      [Teammate C: Machine Learning Risk Modeling]            │
│  ├── xai_service.py             [Teammate D: Explainable AI (XAI) & SHAP Analysis]      │
│  ├── knowledge_graph_service.py [Teammate E: Health Knowledge Graph & Neo4j]            │
│  ├── insights_service.py        [Teammate F: Clinical Insights & LLM Decision Support]  │
│  ├── digital_twin_service.py    [Teammate G: Multi-Organ Twin & 3D Physiological State] │
│  ├── simulation_service.py      [Teammate H: Counterfactual What-If Simulation Engine]  │
│  └── reporting_service.py       [Teammate I: Consolidated Clinical Report Compilation]  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Team Member Onboarding & Contribution Guide

> [!IMPORTANT]
> **Zero-Breakage Guarantee:** The platform is designed with contract interfaces and high-fidelity stubs. Every service in `services/` currently returns realistic ShanghaiT2DM patient data so the frontend runs out-of-the-box. As each team member builds their module, they replace the internal logic in their assigned file **without modifying other services or breaking the web application**.

### Module Assignment & API Contract Table

| Module & Assignment | Responsible File | Primary REST Endpoint | Key Inputs / Outputs |
| :--- | :--- | :--- | :--- |
| **1. Patient Management** | `services/patient_service.py` | `GET /api/patients`<br>`GET /api/patients/<id>` | Input: query, page<br>Output: Demographic profile (age, BMI, duration, BP, HbA1c, FBG, meds) |
| **2. Longitudinal Monitoring** | `services/longitudinal_service.py` | `GET /api/patients/<id>/timeline` | Input: patient_id<br>Output: 14-day CGM daily summaries, 24-hr diurnal curve, TIR/TBR/TAR, visit history |
| **3. Risk Assessment** | `services/risk_model_service.py` | `POST /api/patients/<id>/risk-assessment` | Input: patient_id, optional feature overrides<br>Output: Composite risk %, sub-risks (glycemic, CV, hypo, renal) |
| **4. Explainable AI (XAI)** | `services/xai_service.py` | `POST /api/patients/<id>/xai-explanation` | Input: patient_id, optional feature overrides<br>Output: SHAP attribution values, waterfall directions, clinical summary |
| **5. Knowledge Graph** | `services/knowledge_graph_service.py` | `GET /api/patients/<id>/knowledge-graph` | Input: patient_id<br>Output: Cytoscape elements (nodes: biomarkers, risks, drugs; edges: relationships) |
| **6. Trend Insights** | `services/insights_service.py` | `POST /api/patients/<id>/insights` | Input: patient_id, optional feature overrides<br>Output: Alert level (normal/warning/urgent), targeted recommendations |
| **7. Digital Twin State** | `services/digital_twin_service.py` | `GET /api/patients/<id>/digital-twin` | Input: patient_id, optional feature overrides<br>Output: Organ stress scores (pancreas, heart, kidney, liver), avatar glow |
| **8. What-If Simulation** | `services/simulation_service.py` | `POST /api/patients/<id>/simulate` | Input: Diet, exercise, HbA1c delta, BP delta, TIR delta<br>Output: Baseline vs simulated comparison, risk delta % |
| **9. Clinical Reporting** | `services/reporting_service.py` | `GET /api/patients/<id>/report` | Input: patient_id<br>Output: Consolidated medical summary JSON for PDF printing |

---

### Step-by-Step Instructions for Team Members

#### 👩‍💻 Member A: Ingesting the Raw ShanghaiT2DM Dataset
1. Place raw ShanghaiT2DM files (e.g. `ShanghaiT2DM_Summary.xlsx` or CSVs) in a new `data/` directory.
2. In [`services/patient_service.py`](services/patient_service.py):
   - Replace or populate `BASE_PATIENTS` by reading the raw files using `pandas.read_excel()` or `pandas.read_csv()`.
   - Ensure patient dictionaries maintain keys: `id`, `name`, `age`, `gender`, `bmi`, `diabetes_duration_years`, `hba1c`, `fasting_glucose`, `systolic_bp`, `diastolic_bp`, `egfr`, `medications`.
3. Verify by running `python -m unittest test_api_endpoints.py`.

#### 👨‍💻 Member B: High-Frequency CGM Processing & Time-in-Range (TIR)
1. Read the continuous 15-minute sensor CSVs from ShanghaiT2DM (typically 14 days of sensor readings per patient).
2. In [`services/longitudinal_service.py`](services/longitudinal_service.py):
   - Compute standard clinical glycemic metrics:
     - **TIR (Time-in-Range):** Percentage of readings between 3.9 and 10.0 mmol/L (Target > 70%).
     - **TBR (Time-Below-Range):** Percentage of readings < 3.9 mmol/L (Safety goal < 4%).
     - **TAR (Time-Above-Range):** Percentage of readings > 10.0 mmol/L (Target < 25%).
     - **GMI (Glucose Management Indicator):** Formula: $3.31 + 0.02392 \times \text{Mean Glucose (mg/dL)}$.
   - Return the 14-day aggregated array and 24-hour diurnal meal profile.

#### 👩‍💻 Member C: Training & Deploying the Risk Model
1. Train your temporal ML model (e.g. Temporal XGBoost, LightGBM, or BiLSTM) using the longitudinal cohort features.
2. Save your trained model artifact:
   ```bash
   joblib.dump(model, 'models/shanghai_risk_model.pkl')
   ```
3. In [`services/risk_model_service.py`](services/risk_model_service.py):
   - Load the model:
     ```python
     MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "shanghai_risk_model.pkl"
     LOADED_MODEL = joblib.load(MODEL_PATH) if MODEL_PATH.exists() else None
     ```
   - In `assess_patient_risk()`, call `LOADED_MODEL.predict_proba()` when `LOADED_MODEL` is present, falling back to the clinical heuristic stub if absent.

#### 👨‍💻 Member D: Model Interpretability & SHAP Decomposition
1. In [`services/xai_service.py`](services/xai_service.py):
   - Initialize a SHAP explainer:
     ```python
     import shap
     EXPLAINER = shap.TreeExplainer(LOADED_MODEL) if LOADED_MODEL else None
     ```
   - In `explain_patient_risk()`, generate local SHAP values for the patient's feature vector and return sorted contributions with positive (risk-increasing) and negative (risk-lowering) impacts.

#### 👩‍💻 Member E: Connecting Live Neo4j Knowledge Graph
1. Install Neo4j driver: `pip install neo4j`.
2. In [`services/knowledge_graph_service.py`](services/knowledge_graph_service.py):
   - Connect via bolt:
     ```python
     from neo4j import GraphDatabase
     DRIVER = GraphDatabase.driver(os.getenv("NEO4J_URI", "bolt://localhost:7687"), auth=(...))
     ```
   - Query Cypher: `MATCH (p:Patient {id: $id})-[r]->(n) RETURN p, r, n`
   - Map graph nodes and edges into Cytoscape format.

#### 👨‍💻 Member F: LLM Personalised Recommendations
1. In [`services/insights_service.py`](services/insights_service.py):
   - Integrate with Google Gemini API (`pip install google-genai`) or local Ollama:
     ```python
     from google import genai
     client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
     response = client.models.generate_content(
         model="gemini-2.5-flash",
         contents=f"Patient #{patient_id} has HbA1c of {hba1c}% and TIR of {tir}%...",
     )
     ```
   - Parse into structured clinical recommendations.

---

## 4. Local Development & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Git

### 1. Backend Setup
```powershell
# In the repository root
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run the Flask backend
python app.py
# Backend runs at http://localhost:5000
```

### 2. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
# Vite dev server runs at http://localhost:5173 (or :3000)
```

---

## 5. Automated Testing & Verification

Run automated test suites to ensure zero regressions before pushing code:

```powershell
# 1. Run all 12 backend REST API integration tests
python -m unittest test_api_endpoints.py

# 2. Verify frontend TypeScript types and build bundle
cd frontend
npm run build
```

---

## 6. Cloud Deployment Guide

### Deploying Frontend on Vercel
1. Link your GitHub repository to **Vercel**.
2. Set Root Directory to `frontend`.
3. Set Framework Preset to `Vite`.
4. Add Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-backend-render-app.onrender.com`
5. Deploy. (Routing is handled automatically by `frontend/vercel.json`).

### Deploying Backend on Render
1. Create a **Web Service** on **Render** linked to this repo.
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `gunicorn -w 2 -b 0.0.0.0:$PORT app:app`
4. Set Environment Variables:
   - `PORT`: `5000`
   - (Optional) `GEMINI_API_KEY` or `NEO4J_URI`

---

## 7. Academic Attribution & License

- **Institution:** Swinburne University of Technology Sarawak Campus
- **Project Title:** Smart Diabetes Digital Twin and Personalised Health Management Platform
- **Supervisor:** Ts. Dr. Vong Wan Tze
- **Cohort Dataset:** ShanghaiT2DM (Longitudinal Continuous Glucose Monitoring & Clinical Records)
- **License:** MIT License for academic and research evaluation.
