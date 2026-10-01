import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  Activity,
  Calendar,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import type { TimelineResponse } from '../types';

interface LongitudinalTimelineProps {
  timeline: TimelineResponse;
  patientName: string;
}

export const LongitudinalTimeline: React.FC<LongitudinalTimelineProps> = ({
  timeline,
  patientName,
}) => {
  const [activeView, setActiveView] = useState<'daily' | 'diurnal' | 'historical'>('daily');

  const { summary, daily_trends, hourly_cgm_profile, historical_visits } = timeline;

  const tirColor =
    summary.time_in_range_pct >= 70
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : summary.time_in_range_pct >= 50
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-rose-600 bg-rose-50 border-rose-200';

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Mean Glucose (14d)
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-slate-900">{summary.average_glucose}</span>
            <span className="text-xs text-slate-500">mmol/L</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Target: 4.4 - 7.0</span>
        </div>

        <div className={`p-4 rounded-xl border shadow-sm ${tirColor}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider">Time in Range</span>
            {summary.time_in_range_pct >= 70 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold">{summary.time_in_range_pct}%</span>
          </div>
          <span className="text-[11px] opacity-80 mt-1 block">Target: &gt; 70.0% (3.9-10.0)</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Below Range (TBR)
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={`text-2xl font-bold ${
                summary.time_below_range_pct > 4.0 ? 'text-rose-600' : 'text-slate-800'
              }`}
            >
              {summary.time_below_range_pct}%
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Safety Goal: &lt; 4.0%</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Above Range (TAR)
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={`text-2xl font-bold ${
                summary.time_above_range_pct > 25.0 ? 'text-amber-600' : 'text-slate-800'
              }`}
            >
              {summary.time_above_range_pct}%
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Target: &lt; 25.0%</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            GMI (Est. HbA1c)
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-blue-600">
              {summary.glucose_management_indicator}%
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">14-Day Sensor Calc</span>
        </div>
      </div>

      {/* Main Chart Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Longitudinal Glucose Dynamics &amp; CGM Trends
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ShanghaiT2DM 14-day continuous glucose monitoring for {patientName}
            </p>
          </div>

          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              onClick={() => setActiveView('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeView === 'daily'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              14-Day Daily Range
            </button>
            <button
              onClick={() => setActiveView('diurnal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeView === 'diurnal'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              24-Hr Diurnal Curve
            </button>
            <button
              onClick={() => setActiveView('historical')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeView === 'historical'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              18-Month Visit History
            </button>
          </div>
        </div>

        {/* View 1: 14-Day Daily Trends */}
        {activeView === 'daily' && (
          <div className="pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily_trends} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="meanGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis domain={[2, 16]} tick={{ fontSize: 12, fill: '#64748b' }} unit=" mmol/L" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <ReferenceLine
                    y={10.0}
                    label={{ value: 'Target Upper (10.0)', fill: '#ef4444', fontSize: 10 }}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                  />
                  <ReferenceLine
                    y={3.9}
                    label={{ value: 'Target Lower (3.9)', fill: '#ef4444', fontSize: 10 }}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="mean_glucose"
                    name="Daily Mean"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#meanGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="max_glucose"
                    name="Max Excursion"
                    stroke="#f97316"
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="min_glucose"
                    name="Min Glucose"
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">
              Target therapeutic range (3.9 - 10.0 mmol/L) indicated by dashed red reference boundaries.
            </p>
          </div>
        )}

        {/* View 2: 24-Hour Diurnal Pattern */}
        {activeView === 'diurnal' && (
          <div className="pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourly_cgm_profile} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis domain={[3, 14]} tick={{ fontSize: 12, fill: '#64748b' }} unit=" mmol/L" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <ReferenceLine y={10.0} stroke="#ef4444" strokeDasharray="3 3" />
                  <ReferenceLine y={3.9} stroke="#ef4444" strokeDasharray="3 3" />
                  <Line
                    type="natural"
                    dataKey="glucose"
                    name="Mean Hourly Glucose"
                    stroke="#0284c7"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#0284c7' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Post-Breakfast (08:00)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Post-Lunch (13:00)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Post-Dinner (19:00)
              </span>
            </div>
          </div>
        )}

        {/* View 3: Historical Visits Trend */}
        {activeView === 'historical' && (
          <div className="pt-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historical_visits} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="visit" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis yAxisId="left" domain={[5, 12]} tick={{ fontSize: 12, fill: '#64748b' }} unit="%" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[4, 14]}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    unit=" mmol/L"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <ReferenceLine yAxisId="left" y={7.0} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'HbA1c Target <7.0%', fill: '#10b981', fontSize: 10 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="hba1c"
                    name="HbA1c (%)"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#8b5cf6' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="fasting_glucose"
                    name="Fasting Glucose (mmol/L)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#f59e0b' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center">
              Progression across consecutive clinical visits over the past 18 months.
            </p>
          </div>
        )}
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">14-Day Day-by-Day Longitudinal Log</h4>
          <span className="text-xs text-slate-500">Sensor: Abbott FreeStyle Libre / Dexcom G6 Format</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Day</th>
                <th className="py-2.5 px-4">Mean Glucose</th>
                <th className="py-2.5 px-4">Min / Max Range</th>
                <th className="py-2.5 px-4">Time in Range (3.9-10.0)</th>
                <th className="py-2.5 px-4">Time Below Range (&lt;3.9)</th>
                <th className="py-2.5 px-4">Time Above Range (&gt;10.0)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daily_trends.map((row) => (
                <tr key={row.day} className="hover:bg-slate-50/70">
                  <td className="py-2 px-4 font-medium text-slate-800">{row.day}</td>
                  <td className="py-2 px-4 font-semibold text-blue-600">{row.mean_glucose} mmol/L</td>
                  <td className="py-2 px-4 text-slate-600">
                    {row.min_glucose} - {row.max_glucose} mmol/L
                  </td>
                  <td className="py-2 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded font-medium ${
                        row.time_in_range_pct >= 70
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {row.time_in_range_pct}%
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded font-medium ${
                        row.time_below_range_pct > 4.0
                          ? 'bg-rose-100 text-rose-800'
                          : 'text-slate-600'
                      }`}
                    >
                      {row.time_below_range_pct}%
                    </span>
                  </td>
                  <td className="py-2 px-4 text-slate-600">{row.time_above_range_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
