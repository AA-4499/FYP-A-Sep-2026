/**
 * Global Navigation Bar & Shell.
 * Sticky glassmorphic bar supporting multi-page routing, authentication status, and instant role switching.
 * Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
 */
import React, { useState } from 'react';
import {
  Activity,
  Home,
  User,
  ShieldCheck,
  Stethoscope,
  FileText,
  LogOut,
  LogIn,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  HeartPulse,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { PlatformPage } from '../types';

interface NavbarProps {
  currentPage: PlatformPage;
  onNavigate: (page: PlatformPage) => void;
  onOpenLogin: () => void;
  onOpenReport: () => void;
  isBackendHealthy: boolean | null;
  datasetName: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  onOpenLogin,
  onOpenReport,
  isBackendHealthy,
  datasetName,
}) => {
  const { currentUser, isAuthenticated, switchRole, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems: { id: PlatformPage; label: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'patient_portal', label: 'Patient Portal', icon: User, badge: currentUser?.role === 'patient' ? 'Active' : undefined },
    { id: 'admin_portal', label: 'Admin Portal', icon: ShieldCheck, badge: currentUser?.role === 'admin' ? 'Active' : undefined },
    { id: 'workspace', label: 'Clinical Workspace', icon: Stethoscope },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition transform">
                <HeartPulse className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-slate-900 text-lg tracking-tight">
                    Diabe<span className="text-blue-600">Twin</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/70 px-1.5 py-0.2 rounded-md">
                    FYP AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  ShanghaiT2DM Digital Twin Platform
                </p>
              </div>
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-blue-100 text-blue-700">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Connectivity, Report & User Account */}
          <div className="flex items-center gap-2.5">
            {/* Backend Connectivity Status Pill */}
            <div
              className={`hidden lg:flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                isBackendHealthy === true
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={
                isBackendHealthy === true
                  ? `Flask REST API online (${datasetName})`
                  : 'Using high-fidelity ShanghaiT2DM local cohort dataset (Demo Mode)'
              }
            >
              <Activity className="w-3 h-3 animate-pulse" />
              <span>
                {isBackendHealthy === true ? 'Live API Connected' : 'ShanghaiT2DM Demo Mode'}
              </span>
            </div>

            {/* Quick Report Button */}
            <button
              onClick={onOpenReport}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80 transition shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Report</span>
            </button>

            {/* User Account / Profile Button */}
            {isAuthenticated && currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 transition shadow-2xs"
                  aria-expanded={isProfileMenuOpen}
                >
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-full object-cover ring-2 ring-blue-500/30"
                  />
                  <div className="text-left hidden xl:block">
                    <p className="text-xs font-bold text-slate-800 leading-tight">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">
                      {currentUser.role === 'admin' ? 'Clinician / Admin' : 'Patient'}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-fadeIn z-50 text-xs">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="font-bold text-slate-900 text-sm">{currentUser.name}</p>
                      <p className="text-slate-500 text-[11px] truncate">{currentUser.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {currentUser.title}
                      </span>
                    </div>

                    {/* Quick Role Switcher */}
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Quick Role Switcher
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => {
                            switchRole('patient');
                            onNavigate('patient_portal');
                            setIsProfileMenuOpen(false);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-left font-semibold transition ${
                            currentUser.role === 'patient'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          Patient View
                        </button>
                        <button
                          onClick={() => {
                            switchRole('admin');
                            onNavigate('admin_portal');
                            setIsProfileMenuOpen(false);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-left font-semibold transition ${
                            currentUser.role === 'admin'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          Admin View
                        </button>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => {
                          onOpenLogin();
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                      >
                        <LogIn className="w-4 h-4 text-slate-400" />
                        <span>Switch Account / Sign In</span>
                      </button>
                      <button
                        onClick={() => {
                          logout();
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Hamburger Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 md:hidden text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-100 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
