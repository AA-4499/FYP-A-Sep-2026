/**
 * Main Application Shell for DiabetesTwin
 * Implements the exact layout and modular architecture specified in the mockup:
 * - Left Sidebar with 8 modules (Patients, Monitoring, Risk, Explain AI, Knowledge graph, Digital twin, What-if, Reports)
 * - Top Bar with patient header (P07, 58y, 14 visits) and search
 * - Dashboard with 4 Key Metrics + 2x2 Grid + Bottom navigation buttons
 * - Dedicated Digital Twin Page with 3D / organ highlights
 * - Dedicated Report Page with summary, trends, risk, factors, what-if, and PDF export
 * - Dedicated Patient List & Sign-In view
 * - Clean modular drafts for remaining modules
 */
import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { DigitalTwinView } from './components/DigitalTwinView';
import { ReportView } from './components/ReportView';
import { PatientsView } from './components/PatientsView';
import { ModuleDraftView } from './components/ModuleDraftView';
import type { NavigationModule, Patient } from './types';
import { PATIENTS, getPatientById } from './data/patientsData';

export const App: React.FC = () => {
  // Default to Patient P07 matching the user's mockup image
  const [currentPatientId, setCurrentPatientId] = useState<string>('P07');
  const [activeModule, setActiveModule] = useState<NavigationModule>('patients');

  // Secondary sub-view state: toggle between the primary Dashboard and directory
  const [isPatientDirectoryOpen, setIsPatientDirectoryOpen] = useState(false);

  const currentPatient = getPatientById(currentPatientId);

  const handleSelectPatient = (id: string) => {
    setCurrentPatientId(id);
    setIsPatientDirectoryOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] text-slate-900 font-sans p-3 sm:p-6 lg:p-8 flex justify-center selection:bg-blue-600 selection:text-white">
      <div className="max-w-7xl w-full flex flex-col md:flex-row gap-5 lg:gap-6 items-start">
        {/* 1. LEFT SIDEBAR */}
        <Sidebar
          activeModule={activeModule}
          onSelectModule={(module) => {
            setActiveModule(module);
            setIsPatientDirectoryOpen(false);
          }}
        />

        {/* 2. MAIN WORKSPACE */}
        <main className="flex-1 w-full space-y-5">
          {/* Top Bar with Patient Profile & Search */}
          <TopBar
            currentPatient={currentPatient}
            onSelectPatient={handleSelectPatient}
          />

          {/* View Routing */}
          {activeModule === 'patients' && !isPatientDirectoryOpen && (
            <DashboardView
              patient={currentPatient}
              onNavigate={(mod) => setActiveModule(mod)}
            />
          )}

          {activeModule === 'patients' && isPatientDirectoryOpen && (
            <PatientsView
              currentPatient={currentPatient}
              onSelectPatient={handleSelectPatient}
              onNavigate={(mod) => {
                setActiveModule(mod);
                setIsPatientDirectoryOpen(false);
              }}
            />
          )}

          {activeModule === 'digital_twin' && (
            <DigitalTwinView
              patient={currentPatient}
              onNavigate={(mod) => setActiveModule(mod)}
            />
          )}

          {activeModule === 'reports' && (
            <ReportView
              patient={currentPatient}
              onNavigate={(mod) => setActiveModule(mod)}
            />
          )}

          {/* Modular Drafts for other sidebar links */}
          {activeModule !== 'patients' &&
            activeModule !== 'digital_twin' &&
            activeModule !== 'reports' && (
              <ModuleDraftView
                module={activeModule}
                patient={currentPatient}
                onNavigate={(mod) => setActiveModule(mod)}
              />
            )}
        </main>
      </div>
    </div>
  );
};

export default App;
