import React from 'react';
import { BarChart3, Database, Activity } from 'lucide-react';
import { getCachedRawDetails, getCachedRawSummaries } from '../lib/supabase';
import type { SupabasePatientDetail, SupabasePatientSummary } from '../lib/supabase';

type Field = { label: string; key: keyof SupabasePatientSummary; unit?: string; numeric?: boolean };

const summaryFields: Field[] = [
  { label: 'Smoking history', key: 'Smoking History (pack year)', unit: 'pack-years', numeric: true },
  { label: 'Alcohol history', key: 'Alcohol Drinking History (drinker/non-drinker)' },
  { label: 'Diabetes duration', key: 'Duration of diabetes (years)', unit: 'years', numeric: true },
  { label: 'Acute complications', key: 'Acute Diabetic Complications' },
  { label: 'Macrovascular complications', key: 'Diabetic Macrovascular Complications' },
  { label: 'Microvascular complications', key: 'Diabetic Microvascular Complications' },
  { label: 'Comorbidities', key: 'Comorbidities' },
  { label: 'Hypoglycemic agents', key: 'Hypoglycemic Agents' },
  { label: 'Other agents', key: 'Other Agents' },
  { label: '2-hour postprandial glucose', key: '2-hour Postprandial Plasma Glucose (mg/dl)', unit: 'mg/dL', numeric: true },
  { label: 'Fasting C-peptide', key: 'Fasting C-peptide (nmol/L)', unit: 'nmol/L', numeric: true },
  { label: '2-hour postprandial C-peptide', key: '2-hour Postprandial C-peptide (nmol/L)', unit: 'nmol/L', numeric: true },
  { label: 'Fasting insulin', key: 'Fasting Insulin (pmol/L)', unit: 'pmol/L', numeric: true },
  { label: '2-hour postprandial insulin', key: '2-hour Postprandial insulin (pmol/L)', unit: 'pmol/L', numeric: true },
  { label: 'Glycated albumin', key: 'Glycated Albumin (%)', unit: '%', numeric: true },
  { label: 'Total cholesterol', key: 'Total Cholesterol (mmol/L)', unit: 'mmol/L', numeric: true },
  { label: 'Triglyceride', key: 'Triglyceride (mmol/L)', unit: 'mmol/L', numeric: true },
  { label: 'HDL cholesterol', key: 'High-Density Lipoprotein Cholesterol (mmol/L)', unit: 'mmol/L', numeric: true },
  { label: 'LDL cholesterol', key: 'Low-Density Lipoprotein Cholesterol (mmol/L)', unit: 'mmol/L', numeric: true },
  { label: 'Creatinine', key: 'Creatinine (umol/L)', unit: 'umol/L', numeric: true },
  { label: 'eGFR', key: 'Estimated Glomerular Filtration Rate  (ml/min/1.73m\u00b2)', unit: 'mL/min/1.73m\u00b2', numeric: true },
  { label: 'Uric acid', key: 'Uric Acid (mmol/L)', unit: 'mmol/L', numeric: true },
  { label: 'Blood urea nitrogen', key: 'Blood Urea Nitrogen (mmol/L)', unit: 'mmol/L', numeric: true },
  { label: 'Hypoglycemia', key: 'Hypoglycemia (yes/no)' },
];

const detailFields = [
  ['Blood ketone', 'Blood Ketone (mmol / L)', 'mmol/L'],
  ['Dietary intake', 'Dietary intake', ''],
  ['Insulin dose (subcutaneous)', 'Insulin dose - s.c.', ''],
  ['Insulin dose (intravenous)', 'Insulin dose - i.v.', ''],
  ['Non-insulin hypoglycemic agents', 'Non-insulin hypoglycemic agents', ''],
  ['CSII bolus insulin', 'CSII - bolus insulin (Novolin R, IU)', 'IU'],
  ['CSII basal insulin', 'CSII - basal insulin (Novolin R, IU / H)', 'IU/H'],
] as const;

const display = (value: unknown, unit = '') => value == null || value === '' ? '—' : `${typeof value === 'number' ? Number(value.toFixed(2)) : value}${unit ? ` ${unit}` : ''}`;
const numericValues = (rows: SupabasePatientSummary[], key: keyof SupabasePatientSummary) => rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

function SummaryCard({ field, rows, patient }: { field: Field; rows: SupabasePatientSummary[]; patient?: SupabasePatientSummary }) {
  const values = patient ? [patient[field.key]] : rows.map((r) => r[field.key]);
  const present = values.filter((v) => v != null && v !== '');
  const value = field.numeric && present.length ? present.reduce<number>((a, v) => a + Number(v), 0) / present.length : patient ? values[0] : present.length ? `${present.length}/${rows.length} populated` : null;
  return <div className="rounded-xl border border-slate-200 bg-white p-3 min-h-20"><div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{field.label}</div><div className="mt-1 text-sm font-semibold text-slate-800 break-words">{field.numeric && typeof value === 'number' ? display(value, field.unit) : display(value)}</div>{!patient && field.numeric && <div className="mt-1 text-[10px] text-slate-400">{present.length}/{rows.length} rows populated</div>}</div>;
}

export const ClinicalDataView: React.FC<{ patientId?: string }> = ({ patientId }) => {
  const rows = getCachedRawSummaries();
  const details = getCachedRawDetails().filter((d) => !patientId || d['Patient Number'] === patientId);
  const patient = patientId ? rows.find((r) => r['Patient Number'] === patientId) : undefined;
  return <section className="mt-5 rounded-2xl border border-slate-200/90 bg-slate-50 p-5 space-y-5">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">{patient ? 'Patient clinical measurements' : 'Clinical measurements from Supabase'}</h2><p className="text-xs text-slate-500 mt-1">{patient ? `patient_summary and patient_detail for ${patientId}` : `${rows.length} patient_summary rows · ${getCachedRawDetails().length} patient_detail rows`}</p></div><Database className="w-5 h-5 text-blue-600" /></div>
    <div><h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" />Patient summary fields</h3><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{summaryFields.map((field) => <SummaryCard key={field.label} field={field} rows={rows} patient={patient} />)}</div></div>
    <div><h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2"><Activity className="w-4 h-4" />Patient detail fields</h3>{details.length === 0 ? <p className="text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl p-4">No patient_detail rows are available for this selection.</p> : <div className="overflow-x-auto bg-white rounded-xl border border-slate-200"><table className="w-full text-xs"><thead><tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-100"><th className="p-3">Date</th><th className="p-3">CGM</th><th className="p-3">CBG</th>{detailFields.map(([label]) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{details.slice(0, 100).map((row: SupabasePatientDetail, index) => <tr key={row.id ?? index} className="border-b border-slate-50"><td className="p-3 whitespace-nowrap">{display(row.Date)}</td><td className="p-3">{display(row['CGM (mg / dl)'], 'mg/dL')}</td><td className="p-3">{display(row['CBG (mg / dl)'], 'mg/dL')}</td>{detailFields.map(([, key, unit]) => <td key={key} className="p-3">{display(row[key as keyof SupabasePatientDetail], unit)}</td>)}</tr>)}</tbody></table></div>}</div>
  </section>;
};

