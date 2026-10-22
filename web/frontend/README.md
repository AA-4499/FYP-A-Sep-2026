# DiaTwin frontend

This folder contains the React/Vite frontend. `App.tsx` coordinates authentication, patient selection and Supabase synchronization. The platform defines three roles, with the following implementation status:

- **Doctor:** the teal clinical workspace, with overview, patient management, health monitoring, digital twin, knowledge graph, reports and settings.
- **Admin:** dashboard not yet implemented. Admin accounts see an availability notice with a link back to sign in.
- **Patient:** personal dashboard, clinical profile, monitoring, digital twin, knowledge graph, risk prediction and reports.

The former blue clinic workspace and its separate sidebar have been removed. Its overview, patient/glucose-review pages, clinical analytics, alerts/tasks, care team, devices, settings and support routes are no longer available. The shared patient monitoring, reports and digital-twin components remain available through the current workspaces.

## Application structure

```text
main.tsx
  App.tsx
    AuthView
    Sidebar / TopBar
    DoctorOverviewView / DoctorPatientListView
    AdminPendingView (availability notice only)
    DashboardView / ClinicalDataView
    LongitudinalMonitoringView
    RiskSimulationView
    KnowledgeGraphView
    AIChatView / DigitalTwinView / ReportView
```

`appMode` is `auth`, `doctor`, `admin` or `patient`. `workspaceModule` identifies the active doctor page; `patientModule` identifies the active patient page. Admin mode renders only the availability notice. Returning from a patient opens the teal Doctor dashboard. The shared header identifies the current Doctor or Patient workspace; it does not label the clinical dashboard as Admin.

The old administrator demonstration components remain in the repository as unused prototypes. They are not imported by the application or exposed in navigation and do not represent an implemented Admin dashboard.

## Data and services

| Location | Purpose |
| --- | --- |
| `src/lib/supabase.ts` | Supabase client, patient list, detail observations and cohort calculations. |
| `src/lib/forecast.ts` | Online forecasting and explicit local-preview selection. |
| `src/lib/forecastPreview.ts` | Load an exact patient's static chart snapshot without a Python service. |
| `public/forecast-preview/` | Local precomputed GRU chart snapshots; not live database results. |
| `src/data/adminData.ts` | Unused administrator prototype data. |
| `src/data/patientsData.ts` | Patient fallback data and lookup helpers. |
| `src/types/index.ts` | Shared patient, role and navigation definitions. |

The patient list and observations load from Supabase when available. Forecasting currently defaults to the clearly labelled local data preview while the Python service is being deployed. Online forecasting is selectable separately and requires an authenticated API connection. See [prediction service setup](../../docs/prediction-web-setup.md).

The knowledge graph is a fixed demonstration record with node inspection, not the currently selected patient's live graph. Its optional Neo4j backend is documented in [patient KG setup](../../knowledge_graph/patient_kg/README.md).

## Development

From `web/frontend`:

```bash
npm ci
npm run dev
npm run build
npm run preview
```

The frontend uses React, TypeScript, Vite, Tailwind CSS, Supabase, Recharts, Cytoscape, React Day Picker and Lucide icons. Builds type-check the application before producing `dist/`.

Update navigation in `App.tsx`, `Sidebar.tsx` and `TopBar.tsx`. Doctor pages live in `components/doctor/`. `components/admin/AdminPendingView.tsx` is the Admin availability notice; the other files in that folder are unused prototypes. Shared patient pages remain in `components/`.
