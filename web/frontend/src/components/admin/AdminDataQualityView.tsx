import React, { useState } from 'react';
import {
  Database,
  BarChart2,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  PieChart,
} from 'lucide-react';
import { DATA_COVERAGE_METRICS, MISSING_DATA_HEATMAP } from '../../data/adminData';
import type { DataCoverageItem } from '../../types';

export const AdminDataQualityView: React.FC = () => {
  const [selectedDataset, setSelectedDataset] = useState('ShanghaiT2DM');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Glycemic' | 'Vascular' | 'Metabolic' | 'Lifestyle'>('All');
  const [coverageData, setCoverageData] = useState<DataCoverageItem[]>(DATA_COVERAGE_METRICS);

  const filteredMetrics = coverageData.filter(
    (item) => categoryFilter === 'All' || item.category === categoryFilter
  );

  const getHeatmapColor = (pct: number) => {
    if (pct < 2) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (pct < 5) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (pct < 10) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (pct < 20) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Data Pipeline & Technical Integrity
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Data Quality & Completeness Audit
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Monitor biomarker coverage rates, detect missing observation anomalies, and audit input feeds across clinical cohorts.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">Dataset:</span>
            <select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-hidden"
            >
              <option value="ShanghaiT2DM">ShanghaiT2DM Cohort</option>
              <option value="Borneo">Borneo Center Cohort</option>
              <option value="All">All Linked Datasets</option>
            </select>
          </div>

          <button
            onClick={() => alert('Data Quality Audit CSV downloaded.')}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Quality Audit</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Overall Biomarker Completeness
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">93.8%</span>
            <span className="text-xs font-semibold text-emerald-600">High Integrity</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '93.8%' }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Continuous CGM Sensor Coverage
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-600">98.4%</span>
            <span className="text-xs font-semibold text-slate-500">123,787 / 125,800 hrs</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: '98.4%' }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Pending Imputation Queue
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">2,013</span>
            <span className="text-xs font-semibold text-slate-500">Records in Auto-Fill</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">MICE Imputation Engine Active</span>
        </div>
      </div>

      {/* 3. Category Filter & Data Coverage Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Feature Coverage Breakdown</h3>
            <p className="text-[11px] text-slate-400">Clinical indicator validity and missing record count</p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['All', 'Glycemic', 'Vascular', 'Metabolic', 'Lifestyle'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  categoryFilter === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="py-2.5 px-3">Indicator</th>
                <th className="py-2.5 px-3">Domain</th>
                <th className="py-2.5 px-3">Completeness</th>
                <th className="py-2.5 px-3">Valid Records</th>
                <th className="py-2.5 px-3">Missing Records</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredMetrics.map((item) => (
                <tr key={item.indicator} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-3 font-semibold text-slate-900">{item.indicator}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.coveragePct >= 95
                              ? 'bg-emerald-500'
                              : item.coveragePct >= 90
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${item.coveragePct}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-900">{item.coveragePct}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono">{item.validRecords.toLocaleString()}</td>
                  <td className="py-3 px-3 font-mono text-slate-400">{item.missingRecords.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'Excellent'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.status === 'Good'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Missing Data Pattern Heatmap */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Missing Data Pattern Matrix (Weekly Heatmap)</h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Percent of missing observations across rolling 8-week monitoring windows
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>Missing Rate:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">&lt;2%</span>
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">2-5%</span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300">5-10%</span>
            <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-bold border border-orange-300">10-20%</span>
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold border border-red-300">&gt;20%</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50">
              <tr>
                <th className="py-2.5 px-3 text-left">Clinical Observation</th>
                {MISSING_DATA_HEATMAP.map((w) => (
                  <th key={w.week} className="py-2.5 px-3">
                    {w.week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-3 px-3 text-left font-semibold text-slate-800">CGM Glucose</td>
                {MISSING_DATA_HEATMAP.map((w) => (
                  <td key={w.week} className="py-2.5 px-2">
                    <span className={`inline-block w-full py-1.5 rounded-lg font-mono font-bold border text-[11px] ${getHeatmapColor(w.glucose)}`}>
                      {w.glucose}%
                    </span>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 px-3 text-left font-semibold text-slate-800">HbA1c Lab Tests</td>
                {MISSING_DATA_HEATMAP.map((w) => (
                  <td key={w.week} className="py-2.5 px-2">
                    <span className={`inline-block w-full py-1.5 rounded-lg font-mono font-bold border text-[11px] ${getHeatmapColor(w.hba1c)}`}>
                      {w.hba1c}%
                    </span>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 px-3 text-left font-semibold text-slate-800">Blood Pressure</td>
                {MISSING_DATA_HEATMAP.map((w) => (
                  <td key={w.week} className="py-2.5 px-2">
                    <span className={`inline-block w-full py-1.5 rounded-lg font-mono font-bold border text-[11px] ${getHeatmapColor(w.bp)}`}>
                      {w.bp}%
                    </span>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 px-3 text-left font-semibold text-slate-800">Lipid Panels</td>
                {MISSING_DATA_HEATMAP.map((w) => (
                  <td key={w.week} className="py-2.5 px-2">
                    <span className={`inline-block w-full py-1.5 rounded-lg font-mono font-bold border text-[11px] ${getHeatmapColor(w.lipids)}`}>
                      {w.lipids}%
                    </span>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 px-3 text-left font-semibold text-slate-800">Physical Activity (Steps)</td>
                {MISSING_DATA_HEATMAP.map((w) => (
                  <td key={w.week} className="py-2.5 px-2">
                    <span className={`inline-block w-full py-1.5 rounded-lg font-mono font-bold border text-[11px] ${getHeatmapColor(w.steps)}`}>
                      {w.steps}%
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
