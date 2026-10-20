# DiabeTwin Frontend Structure

This folder contains the React/Vite frontend for the Smart Diabetes Digital Twin platform. The interface has three main application modes:

1. **Authentication** – sign-in and registration screens.
2. **Clinic workspace** – cohort-level monitoring for clinicians.
3. **Patient workspace** – an individual patient's digital twin, monitoring, risk, explainable AI, knowledge graph, and reports.

## Runtime flow

```text
main.tsx
  └── App.tsx
       ├── AuthView                 (auth mode)
       └── Application shell
            ├── Sidebar             (navigation)
            ├── TopBar              (patient/mode controls)
            ├── Clinic workspace
            │    ├── ClinicDashboardView
            │    ├── PatientsView
            │    └── ReportView
            └── Patient workspace
                 ├── DashboardView
                 ├── ClinicalDataView
                 ├── LongitudinalMonitoringView
                 ├── RiskSimulationView
                 ├── AIChatView
                 ├── KnowledgeGraphView
                 ├── DigitalTwinView
                 └── ReportView
```

`App.tsx` owns the main UI state: application mode, selected module, current patient, authentication role, patient data, and Supabase connection status. It also coordinates patient selection and navigation between modules.

## Directory structure

```text
src/
├── main.tsx                         # React entry point
├── App.tsx                          # Application shell and route-like rendering
├── index.css                        # Global styles and Tailwind-related styles
├── components/                      # Page views and reusable UI sections
├── data/                            # Local demo and chart data
├── lib/                             # External-service and utility logic
└── types/                           # Shared TypeScript types
```

## Components

### Application shell and navigation

| Component | Responsibility |
| --- | --- |
| `App.tsx` | Central state, mode switching, module rendering, patient selection, and Supabase synchronization. |
| `Sidebar.tsx` | Main navigation for clinic and patient workspaces. |
| `TopBar.tsx` | Current patient, workspace controls, connection status, and authentication actions. |
| `AuthView.tsx` | Sign-in and registration UI. |
| `SupabaseConfigModal.tsx` | Configure or update the Supabase connection. |

### Clinic workspace

| Component | Responsibility |
| --- | --- |
| `ClinicDashboardView.tsx` | Cohort overview: active patients, glucose/HbA1c metrics, patient distribution, trends, glycemic control, clinical snapshot, and priority patient activity. |
| `PatientsView.tsx` | Browse patients and select a patient for the digital-twin workspace. |
| `ClinicalDataView.tsx` | Shared clinical-data section used by both clinic and patient views. |
| `ReportView.tsx` | Clinical health dossier/report view and printable report output. |

`ClinicDashboardView` receives patient data and callbacks from `App.tsx`. It calculates cohort statistics through `computeCohortStats` and falls back to local `PATIENTS` data when no patient list is supplied.

### Patient digital-twin workspace

| Component | Responsibility |
| --- | --- |
| `DashboardView.tsx` | Patient overview dashboard with key vitals and summary cards. |
| `LongitudinalMonitoringView.tsx` | Historical monitoring and recent glucose distribution. |
| `RiskSimulationView.tsx` | Risk assessment and what-if scenario simulation. |
| `AIChatView.tsx` | Explainable AI and model-insights conversation interface. |
| `KnowledgeGraphView.tsx` | Interactive clinical knowledge graph and entity inspection. |
| `DigitalTwinView.tsx` | Physiological/metabolic digital-twin visualization. |
| `ReportView.tsx` | Patient clinical dossier and report output. |

## Data and services

| Location | Purpose |
| --- | --- |
| `src/data/patientsData.ts` | Local patient records and patient lookup helpers. |
| `src/data/clinicData.ts` | Clinic dashboard chart, trend, and snapshot data. |
| `src/data/knowledgeGraphData.ts` | Knowledge graph entities and relationships. |
| `src/lib/supabase.ts` | Supabase client, connection testing, patient-list loading, patient-detail loading, and cohort-stat calculations. |
| `src/types/index.ts` | Shared `Patient`, navigation, authentication, and related TypeScript definitions. |

## Supabase data behavior

The frontend starts with local demo data from `src/data/patientsData.ts`. On startup, `App.tsx` tests the Supabase connection. If the connection is available and returns patients, the remote data replaces the local list. Selecting a patient can then load detailed observations from Supabase. If Supabase is unavailable, the application continues using the local fallback data.

## Important navigation state

- `appMode`: `auth`, `clinic`, or `patient`.
- `clinicModule`: active clinic section, such as `overview`, `patients`, `glucose_review`, or `reports`.
- `patientModule`: active patient section, such as `patient_dashboard`, `monitoring`, `risk`, `explain_ai`, `knowledge_graph`, `digital_twin`, or `reports`.
- `currentPatientId`: identifier of the patient currently displayed.
- `isSupabaseConnected`: whether live Supabase data is available.

## Technology stack

- React 18 with TypeScript
- Vite
- Tailwind CSS
- Supabase JavaScript client
- Recharts and SVG charts for clinical trends
- Cytoscape for knowledge-graph visualization
- Lucide React for icons
- Google Model Viewer for 3D model content

## Development commands

Run these commands from `web/frontend`:

```bash
npm install
npm run dev       # Start the Vite development server
npm run build     # Type-check and create a production build
npm run preview   # Preview the production build locally
```

## Where to start when changing the UI

- Change global navigation or data loading in `src/App.tsx`.
- Change clinic overview cards, charts, or tables in `src/components/ClinicDashboardView.tsx`.
- Change patient navigation in `Sidebar.tsx` and the `patientModule` rendering section of `App.tsx`.
- Change local sample values in `src/data/`.
- Change live database behavior in `src/lib/supabase.ts`.
