import React from "react";
import type { Patient } from "../types";
import { clinicalValue } from "../lib/clinicalData";

type Row = { label: string; key: string; unit: string };

const groups: { title: string; rows: Row[] }[] = [
  {
    title: "Glycaemic markers",
    rows: [
      { label: "HbA1c", key: "HbA1c (mmol/mol)", unit: "mmol/mol" },
      { label: "Fasting plasma glucose", key: "Fasting Plasma Glucose (mg/dl)", unit: "mg/dL" },
      { label: "2-hour postprandial glucose", key: "2-hour Postprandial Plasma Glucose (mg/dl)", unit: "mg/dL" },
      { label: "Glycated albumin", key: "Glycated Albumin (%)", unit: "%" },
    ],
  },
  {
    title: "Insulin and C-peptide",
    rows: [
      { label: "Fasting C-peptide", key: "Fasting C-peptide (nmol/L)", unit: "nmol/L" },
      { label: "2-hour postprandial C-peptide", key: "2-hour Postprandial C-peptide (nmol/L)", unit: "nmol/L" },
      { label: "Fasting insulin", key: "Fasting Insulin (pmol/L)", unit: "pmol/L" },
      { label: "2-hour postprandial insulin", key: "2-hour Postprandial insulin (pmol/L)", unit: "pmol/L" },
    ],
  },
  {
    title: "Lipids",
    rows: [
      { label: "Total cholesterol", key: "Total Cholesterol (mmol/L)", unit: "mmol/L" },
      { label: "Triglycerides", key: "Triglyceride (mmol/L)", unit: "mmol/L" },
      { label: "HDL cholesterol", key: "High-Density Lipoprotein Cholesterol (mmol/L)", unit: "mmol/L" },
      { label: "LDL cholesterol", key: "Low-Density Lipoprotein Cholesterol (mmol/L)", unit: "mmol/L" },
    ],
  },
  {
    title: "Kidney and metabolic markers",
    rows: [
      { label: "Creatinine", key: "Creatinine (umol/L)", unit: "µmol/L" },
      { label: "eGFR", key: "Estimated Glomerular Filtration Rate  (ml/min/1.73m²)", unit: "mL/min/1.73m²" },
      { label: "Uric acid", key: "Uric Acid (mmol/L)", unit: "mmol/L" },
      { label: "Blood urea nitrogen", key: "Blood Urea Nitrogen (mmol/L)", unit: "mmol/L" },
    ],
  },
];

export function LabResultsView({ patient }: { patient: Patient }) {
  const recorded = patient.recordedFields ?? {};
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const available = groups.reduce(
    (sum, group) => sum + group.rows.filter((row) => recorded[row.key] !== null && recorded[row.key] !== undefined && recorded[row.key] !== "").length,
    0,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Recorded measurements</p>
        <h1 className="mt-2 text-2xl font-bold">Lab results</h1>
        <p className="mt-2 text-sm text-slate-500">
          Values recorded for {patient.name} ({patient.id}). Missing values are shown as not recorded; no values are inferred.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Measurements available</p>
            <p className="mt-1 text-xl font-semibold">{available} / {total}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Patient record</p>
            <p className="mt-1 text-xl font-semibold">{patient.id}</p>
          </div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold">{group.title}</h2>
            <dl className="mt-3 divide-y divide-slate-100">
              {group.rows.map((row) => (
                <div key={row.key} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <dt className="text-slate-600">{row.label}</dt>
                  <dd className="font-semibold text-slate-900">{clinicalValue(recorded[row.key], row.unit)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
        This page displays recorded laboratory values only. It does not contain model predictions or clinical recommendations.
      </p>
    </div>
  );
}

export default LabResultsView;
