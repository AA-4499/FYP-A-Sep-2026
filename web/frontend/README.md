# DiaTwin frontend

Patient registration, confirmation links, login/logout, session restoration, and password
recovery now use Supabase Auth. Follow the [Patient authentication walkthrough](../../docs/patient-auth-walkthrough.md)
to apply the profile and dashboard SQL scripts and run a real email test. Confirmed Patients
see their own dashboard, health readings, and profile; unlinked accounts see empty states. Unauthenticated
dashboard previews use sample records and do not run the live cohort synchronization.
The active form is `AccountAuthView.tsx`; `AuthView.tsx` is a retained, unused prototype.

This folder contains the React/Vite frontend. `App.tsx` coordinates authentication, patient selection and Supabase synchronization. The platform defines three roles, with the following implementation status:

- **Doctor:** the teal clinical workspace, with overview, patient management, health monitoring, digital twin, knowledge graph, reports and settings.
- **Admin:** dedicated overview, user accounts, doctor approvals, patient assignments, and activity history. These pages use a clearly labelled browser demo with synthetic records; no live account permissions are changed.
- **Patient:** authenticated personal dashboard, recorded health measurements, recent glucose readings, and account profile. The Doctor/sample workspace retains the prototype twin, prediction, and report pages.

The former blue clinic workspace and its separate sidebar have been removed. Its overview, patient/glucose-review pages, clinical analytics, alerts/tasks, care team, devices, settings and support routes are no longer available. The shared patient monitoring, reports and digital-twin components remain available through the current workspaces.

## Application structure

```text
main.tsx
  App.tsx
    AuthGateway / AccountAuthView
    PatientWorkspace (signed-in Patient only)
    Sidebar / TopBar
    DoctorOverviewView / DoctorPatientListView
    AdminWorkspace / AdminPages / AdminUI
    DashboardView / ClinicalDataView
    LongitudinalMonitoringView
    RiskSimulationView
    KnowledgeGraphView
    AIChatView / DigitalTwinView / ReportView
```

`appMode` is `auth`, `doctor`, `admin` or `patient`. `workspaceModule` identifies the active doctor page; `patientModule` identifies the active patient page. Admin mode renders its own navigation and workspace. Returning from a patient opens the teal Doctor dashboard. The shared clinical header identifies the current Doctor or Patient workspace.

Open **Admin dashboard (Demo)** from the workspace profile dropdown, or sign in with an Admin account. Both entry points show the same isolated sample workspace. Account creation, status changes, doctor review, assignment changes, and activity are persisted under `diatwin.admin-demo.v1` in local storage. Storage failures are shown explicitly; reset restores the sample dataset. Account and activity exports are CSV downloads. New doctors require approval, assignments require active accounts, suspension clears affected assignments, and at least one Admin remains active.

These are frontend administration workflows, not a live authorization system. Production integration still requires authenticated Admin-only APIs, trusted role updates, doctor registration storage, assignment enforcement, and server audit records. Demo controls do not call Supabase administrative APIs or send invitations. The earlier governance/model configuration components and availability notice remain unused.

## Data and services

| Location | Purpose |
| --- | --- |
| `src/lib/supabase.ts` | Supabase client, patient list, detail observations and cohort calculations. |
| `src/lib/forecast.ts` | Online forecasting and explicit local-preview selection. |
| `src/lib/forecastPreview.ts` | Load an exact patient's static chart snapshot without a Python service. |
| `public/forecast-preview/` | Local precomputed GRU chart snapshots; not live database results. |
| `src/data/adminData.ts` | Unused administrator prototype data. |
| `src/lib/adminDemo.ts` | Demo account and assignment operations, activity, storage validation, and CSV encoding. |
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
npm run test:admin
npm run preview
```

The frontend uses React, TypeScript, Vite, Tailwind CSS, Supabase, Recharts, Cytoscape, React Day Picker and Lucide icons. Builds type-check the application before producing `dist/`.

Update clinical navigation in `App.tsx`, `Sidebar.tsx` and `TopBar.tsx`. Doctor pages live in `components/doctor/`. Admin navigation and persistence live in `components/admin/AdminWorkspace.tsx`, its five pages and forms in `AdminPages.tsx`, and shared UI in `AdminUI.tsx`. Shared patient pages remain in `components/`.
