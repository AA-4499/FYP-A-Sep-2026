/**
 * Personal Patient Portal Page.
 * Human-centered, empowering interface tailored for patient self-management, continuous telemetry, and what-if goal setting.
 * Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
 */
import React, { useState, useEffect } from 'react';
import {
  Heart,
  TrendingUp,
  Activity,
  CheckCircle2,
  Calendar,
  Clock,
  Sparkles,
  Award,
  AlertCircle,
  FileText,
  UserCheck,
  Footprints,
  Pill,
  Apple,
  MessageSquare,
  ChevronRight,
  RefreshCw,
  Info,
  Droplet,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type {
  PatientProfile,
  TimelineResponse,
  DigitalTwinResponse,
  RiskAssessmentResponse,
  InsightsResponse,
} from '../types';
import {
  fetchPatient,
  fetchTimeline,
  fetchDigitalTwin,
  fetchRiskAssessment,
  fetchInsights,
} from '../api/client';
import { MOCK_PATIENTS } from '../api/mockData';

interface PatientPortalProps {
  patientId: string;
  onSelectPatient: (id: string) => void;
  onOpenReport: () => void;
  onNavigateToWorkspace: () => void;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({
  patientId,
  onSelectPatient,
  onOpenReport,
  onNavigateToWorkspace,
}) => {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [twin, setTwin] = useState<DigitalTwinResponse | null>(null);
  const [risk, setRisk] = useState<RiskAssessmentResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Interactive Checklist states for patient daily goals
  const [checklist, setChecklist] = useState({
    med_morning: true,
    walk_lunch: true,
    water_goal: false,
    dinner_salad: false,
    med_evening: false,
  });

  // What-If Goal Simulator sliders for the patient
  const [extraWalkingMins, setExtraWalkingMins] = useState(25);
  const [carbReductionPct, setCarbReductionPct] = useState(20);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [p, t, tw, r, ins] = await Promise.all([
          fetchPatient(patientId),
          fetchTimeline(patientId),
          fetchDigitalTwin(patientId),
          fetchRiskAssessment(patientId),
          fetchInsights(patientId),
        ]);
        setProfile(p);
        setTimeline(t);
        setTwin(tw);
        setRisk(r);
        setInsights(ins);
      } catch (e) {
        console.error('Error loading patient data:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [patientId]);

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const completedCount = Object.values(checklist).filter(Boolean).length;
  const totalCount = Object.keys(checklist).length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  // Simulated projected outcome based on user sliders
  const currentHba1c = profile?.hba1c || 7.4;
  const projectedDrop = Number(((extraWalkingMins * 0.012) + (carbReductionPct * 0.015)).toFixed(2));
  const projectedHba1c = Number(Math.max(5.8, currentHba1c - projectedDrop).toFixed(1));
  const projectedRiskReductionPct = Math.round((projectedDrop / currentHba1c) * 100 * 2.2);

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">
          Loading your personal health records and digital twin...
        </p>
      </div>
    );
  }

  const patientName = profile?.name || `Patient #${patientId}`;

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* 1. WELCOME HEADER & PATIENT BANNER */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        {/* Background glow circle */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 text-white px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                Patient Portal · ShanghaiT2DM Cohort
              </span>
              <span className="text-xs text-blue-100 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Welcome back, {patientName}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
              Here is your daily blood glucose telemetry, organ wellness twin, and personalized lifestyle targets for today.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-blue-200">
              <span>Patient ID: <strong className="text-white">#{patientId}</strong></span>
              <span>•</span>
              <span>Age: <strong className="text-white">{profile?.age} yrs</strong></span>
              <span>•</span>
              <span>Attending Doctor: <strong className="text-white">Dr. Alex Wong</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {/* Quick Cohort Patient Switcher */}
            <div className="relative">
              <select
                value={patientId}
                onChange={(e) => onSelectPatient(e.target.value)}
                className="text-xs font-semibold px-3 py-2 rounded-xl bg-white/15 border border-white/25 text-white hover:bg-white/25 transition cursor-pointer appearance-none pr-8 focus:outline-hidden"
                aria-label="Switch patient profile"
              >
                {MOCK_PATIENTS.map((p) => (
                  <option key={p.id} value={p.id} className="text-slate-900">
                    Switch: {p.name} (#{p.id})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                ▼
              </div>
            </div>

            <button
              onClick={onOpenReport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs shadow-xs transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download Health Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KEY VITALS & METRIC STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Real-Time Glucose */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <Droplet className="w-4 h-4 text-blue-600" />
              Current Glucose
            </span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              In Target
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-slate-900">
              {profile?.fasting_glucose || '7.8'}
            </span>
            <span className="text-xs font-semibold text-slate-500">mmol/L</span>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            Sensor sync: 5 mins ago (CGM Active)
          </p>
        </div>

        {/* Card 2: Time in Range (TIR) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600" />
              Time In Range (TIR)
            </span>
            <span className="text-[10px] text-slate-500">Goal: &gt;70%</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-emerald-600">
              {timeline?.summary.time_in_range_pct || 72}%
            </span>
            <span className="text-xs font-semibold text-emerald-700">Meets ADA Goal</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${timeline?.summary.time_in_range_pct || 72}%` }}
            />
          </div>
        </div>

        {/* Card 3: HbA1c */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-600" />
              Latest HbA1c
            </span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
              -0.4% this quarter
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-slate-900">
              {profile?.hba1c || 7.4}%
            </span>
            <span className="text-xs font-semibold text-slate-500">Target &lt; 7.0%</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Last laboratory blood draw: Oct 2025
          </p>
        </div>

        {/* Card 4: Daily Habits Completed */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              Daily Health Routine
            </span>
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
              {progressPct}% Done
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-teal-700">
              {completedCount}
            </span>
            <span className="text-sm font-semibold text-slate-500">of {totalCount} habits</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-teal-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. CONTINUOUS GLUCOSE TELEMETRY (24-Hour CGM Curve) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Today's Continuous Glucose Telemetry (24-Hour CGM)
            </h2>
            <p className="text-xs text-slate-500">
              Readings tracked every 15 minutes by wearable sensor. Target range: 3.9 - 10.0 mmol/L.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-slate-600">
              <span className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-400 inline-block" />
              Target Zone (3.9 - 10.0)
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              <span className="w-3 h-1 bg-blue-600 inline-block rounded-full" />
              Your Glucose
            </span>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full pt-2">
          {timeline?.hourly_cgm_profile ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline.hourly_cgm_profile} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="patientGlucoseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[3, 14]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const val = data.glucose;
                      const inRange = val >= 3.9 && val <= 10.0;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-lg space-y-1">
                          <p className="text-slate-400 font-semibold">{data.hour}</p>
                          <p className="text-sm font-black">
                            {val} <span className="text-[10px] font-normal text-slate-300">mmol/L</span>
                          </p>
                          <span
                            className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                              inRange ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {inRange ? 'Within Target' : val > 10.0 ? 'High' : 'Low'}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={10.0} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Target Max (10.0)', position: 'insideTopRight', fill: '#059669', fontSize: 10 }} />
                <ReferenceLine y={3.9} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Target Min (3.9)', position: 'insideBottomRight', fill: '#059669', fontSize: 10 }} />
                <Area
                  type="monotone"
                  dataKey="glucose"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#patientGlucoseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </div>

      {/* 4. DIGITAL TWIN & ORGAN HEALTH STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 3D Twin Avatar View */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500" />
                My Physiological Digital Twin
              </h2>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: twin?.avatar_status_color ? `${twin.avatar_status_color}15` : '#10b98115',
                  color: twin?.avatar_status_color || '#10b981',
                }}
              >
                {twin?.twin_status || 'Optimal Equilibrium'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Virtual bio-computational replica reflecting your current blood sugar, organ strain, and metabolism.
            </p>
          </div>

          {/* Model viewer or stylized avatar */}
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 p-6 flex flex-col items-center justify-center min-h-[260px] border border-slate-200/60">
            <div
              className="w-32 h-32 rounded-full flex items-center justify-center shadow-lg transition-transform duration-500 hover:scale-105"
              style={{
                boxShadow: `0 0 35px ${twin?.avatar_glow || 'rgba(16, 185, 129, 0.3)'}`,
                background: 'radial-gradient(circle, #f8fafc 40%, #e2e8f0 100%)',
              }}
            >
              <div className="text-center">
                <Heart className="w-10 h-10 text-rose-500 mx-auto animate-pulse" />
                <span className="text-[10px] font-bold text-slate-700 block mt-1">
                  Twin #{patientId}
                </span>
              </div>
            </div>

            <div className="w-full mt-6 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-white border border-slate-200">
                <span className="text-slate-400 text-[10px] block">BMI</span>
                <strong className="text-slate-800 font-bold">{profile?.bmi} kg/m²</strong>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200">
                <span className="text-slate-400 text-[10px] block">Blood Pressure</span>
                <strong className="text-slate-800 font-bold">{profile?.systolic_bp}/{profile?.diastolic_bp}</strong>
              </div>
            </div>
          </div>

          <button
            onClick={onNavigateToWorkspace}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
          >
            <span>Open Clinical Twin Analysis</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Right 2 columns: Multi-Organ Health Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Organ Health Status & Metabolic Load
              </h2>
              <p className="text-xs text-slate-500">
                How diabetes and daily habits affect your key physiological systems.
              </p>
            </div>
            <span className="text-[11px] text-slate-400">Continuous Assessment</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {twin?.organs && Object.entries(twin.organs).map(([key, organ]) => (
              <div
                key={key}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 hover:bg-slate-50 transition"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900">{organ.name}</h3>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${organ.color}15`,
                      color: organ.color,
                    }}
                  >
                    {organ.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Stress Level:</span>
                    <strong className="text-slate-800">{organ.stress_score}/100</strong>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${organ.stress_score}%`,
                        backgroundColor: organ.color,
                      }}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
                  {organ.details}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. DAILY HEALTH HABITS CHECKLIST & GOAL SIMULATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Habit Checklist */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                Today's Wellness Action Plan
              </h2>
              <p className="text-xs text-slate-500">
                Recommended daily micro-habits based on your ShanghaiT2DM profile.
              </p>
            </div>
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
              {completedCount} / {totalCount} Done
            </span>
          </div>

          <div className="space-y-2.5">
            {[
              {
                id: 'med_morning',
                icon: Pill,
                title: 'Morning Medication',
                desc: 'Take Metformin 1000mg with breakfast meal.',
                color: 'text-blue-600 bg-blue-50',
              },
              {
                id: 'walk_lunch',
                icon: Footprints,
                title: 'Post-Lunch 20-Min Walk',
                desc: 'Brisk walking activates muscle glucose uptake and lowers post-meal spikes.',
                color: 'text-emerald-600 bg-emerald-50',
              },
              {
                id: 'water_goal',
                icon: Droplet,
                title: 'Drink 2 Liters of Water',
                desc: 'Adequate hydration supports renal glucose filtration.',
                color: 'text-cyan-600 bg-cyan-50',
              },
              {
                id: 'dinner_salad',
                icon: Apple,
                title: 'High-Fiber Dinner Choice',
                desc: 'Include cruciferous greens or legumes before carbohydrates.',
                color: 'text-amber-600 bg-amber-50',
              },
              {
                id: 'med_evening',
                icon: Pill,
                title: 'Evening Medication',
                desc: 'Take Gliclazide / Evening dose with dinner at 7:30 PM.',
                color: 'text-purple-600 bg-purple-50',
              },
            ].map((habit) => {
              const Icon = habit.icon;
              const isChecked = checklist[habit.id as keyof typeof checklist];
              return (
                <div
                  key={habit.id}
                  onClick={() => toggleCheck(habit.id as keyof typeof checklist)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    isChecked
                      ? 'bg-slate-50 border-slate-200 opacity-90'
                      : 'bg-white border-slate-200 hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${habit.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${isChecked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {habit.title}
                      </p>
                      <p className="text-[11px] text-slate-500">{habit.desc}</p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* What-If Personal Goal Simulator */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Personal "What-If" Goal Simulator
            </h2>
            <p className="text-xs text-slate-500">
              See how small changes in your daily routine can lower your 3-month HbA1c.
            </p>
          </div>

          <div className="space-y-4">
            {/* Slider 1: Extra walking */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Footprints className="w-4 h-4 text-emerald-600" />
                  Additional Daily Walking
                </span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                  +{extraWalkingMins} mins/day
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={extraWalkingMins}
                onChange={(e) => setExtraWalkingMins(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0m</span>
                <span>+15m</span>
                <span>+30m</span>
                <span>+45m</span>
                <span>+60m</span>
              </div>
            </div>

            {/* Slider 2: Dinner Carb Reduction */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Apple className="w-4 h-4 text-amber-600" />
                  Dinner Carbohydrate Reduction
                </span>
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-bold">
                  -{carbReductionPct}% carbs
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={carbReductionPct}
                onChange={(e) => setCarbReductionPct(Number(e.target.value))}
                className="w-full accent-amber-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Normal (0%)</span>
                <span>-15%</span>
                <span>-30%</span>
                <span>-50%</span>
              </div>
            </div>

            {/* Projected Outcome Showcase */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 via-teal-50 to-emerald-50 border border-teal-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  Projected 3-Month Outcome:
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  -{projectedDrop}% HbA1c Drop
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center pt-1">
                <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100">
                  <span className="text-[10px] text-slate-500 block">Current HbA1c</span>
                  <span className="text-lg font-black text-slate-700">{currentHba1c}%</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100">
                  <span className="text-[10px] text-slate-500 block">Projected HbA1c</span>
                  <span className="text-lg font-black text-emerald-600">{projectedHba1c}%</span>
                </div>
              </div>

              <p className="text-[11px] text-teal-800 leading-relaxed pt-1">
                🎯 By sustaining these small goals, your overall long-term diabetic complication risk decreases by approx. <strong>{projectedRiskReductionPct}%</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. DOCTOR'S NOTES & CARE TEAM CONTACT */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            Care Team Notes from Dr. Alex Wong
          </h2>
          <span className="text-xs text-slate-400">Chief Endocrinologist</span>
        </div>

        <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
          <img
            src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80"
            alt="Dr. Alex Wong"
            className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/30 shrink-0"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-indigo-950">Dr. Alex Wong, MD, PhD</span>
              <span className="text-[10px] text-slate-400">Consultation Note · 2 days ago</span>
            </div>
            <p className="text-xs text-indigo-900 leading-relaxed">
              "{patientName}, your 14-day continuous glucose monitoring data shows that your post-lunch glycemic response is well stabilized. Continue taking your morning Metformin with breakfast, and aim to keep up your 20-minute post-dinner walks to flatten any evening glucose peaks."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
