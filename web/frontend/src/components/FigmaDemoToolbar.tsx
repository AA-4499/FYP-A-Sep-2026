/**
 * Figma Demo Presentation Toolbar.
 * Floating controls designed specifically for UI/UX walkthroughs, Figma prototype demos, and screen switching.
 * Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
 */
import React, { useState } from 'react';
import {
  Sparkles,
  Home,
  User,
  ShieldCheck,
  Stethoscope,
  LogIn,
  FileText,
  ChevronDown,
  ChevronUp,
  Sliders,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { PlatformPage } from '../types';

interface FigmaDemoToolbarProps {
  currentPage: PlatformPage;
  onNavigate: (page: PlatformPage) => void;
  onOpenLogin: () => void;
  onOpenReport: () => void;
}

export const FigmaDemoToolbar: React.FC<FigmaDemoToolbarProps> = ({
  currentPage,
  onNavigate,
  onOpenLogin,
  onOpenReport,
}) => {
  const { currentUser, switchRole } = useAuth();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 p-2.5 rounded-full bg-slate-900/90 text-white shadow-xl hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-bold border border-slate-700 backdrop-blur-md"
        title="Show Figma Demo Toolbar"
      >
        <Sparkles className="w-4 h-4 text-amber-400" />
        <span className="hidden sm:inline">Figma Demo Bar</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Figma Demo Controls"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-4xl w-[94%] sm:w-auto bg-slate-900/95 text-white rounded-2xl shadow-2xl border border-slate-700/80 p-2 sm:p-2.5 backdrop-blur-xl animate-fadeIn transition-all"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left Badge */}
        <div className="flex items-center gap-2 pl-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-pink-500 to-amber-500 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="hidden md:block text-left">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-200">
              Figma Demo Navigation
            </p>
            <p className="text-[9px] text-slate-400">
              Active: <strong className="text-amber-400 capitalize">{currentPage.replace('_', ' ')}</strong>
            </p>
          </div>
        </div>

        {/* Middle Screen Switchers */}
        {!isMinimized && (
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5">
            <button
              onClick={() => onNavigate('home')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                currentPage === 'home'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Home</span>
            </button>

            <button
              onClick={() => {
                switchRole('patient');
                onNavigate('patient_portal');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                currentPage === 'patient_portal'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>Patient</span>
            </button>

            <button
              onClick={() => {
                switchRole('admin');
                onNavigate('admin_portal');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                currentPage === 'admin_portal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Admin</span>
            </button>

            <button
              onClick={() => onNavigate('workspace')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                currentPage === 'workspace'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Workspace</span>
            </button>

            <span className="h-4 w-px bg-slate-700 hidden sm:inline" />

            {/* Modal Triggers */}
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Show Login Modal"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Sign In</span>
            </button>

            <button
              onClick={onOpenReport}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Show Consolidated Report Modal"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Report</span>
            </button>
          </div>
        )}

        {/* Right Toggle Controls */}
        <div className="flex items-center gap-1 pr-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title={isMinimized ? 'Expand bar' : 'Minimize bar'}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
            title="Hide bar for clean presentation/screenshots"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
