/**
 * Patient dataset for Smart Diabetes Digital Twin platform.
 * Features exact patients and metrics from Figma designs:
 * - Elena Morales (2000_0_20201230 / P07)
 * - James Bennett (2000_0_20201231)
 * - Amina Patel (2000_0_20211228)
 * - Samuel Lee (2001_0_20210304)
 */
import type { Patient } from '../types';

export const PATIENTS: Patient[] = [
  {
    id: '2000_0_20201230',
    displayId: 'P07',
    name: 'Elena Morales',
    avatarInitials: 'EM',
    age: 58,
    condition: 'Type 2 diabetes',
    visitsCount: 14,
    hba1c: 8.1,
    fastingGlucose: 9.4,
    bmi: 27.3,
    currentRiskPct: 68,
    timeInRangePct: 38,
    latestSignal: 'Repeated glucose > 300 mg/dL',
    riskCategory: 'High',
    timelineData: [
      { visit: 1, currentHba1c: 6.9, avgHba1c: 6.4 },
      { visit: 2, currentHba1c: 7.0, avgHba1c: 6.5 },
      { visit: 3, currentHba1c: 7.2, avgHba1c: 6.6 },
      { visit: 4, currentHba1c: 7.4, avgHba1c: 6.7 },
      { visit: 5, currentHba1c: 7.5, avgHba1c: 6.8 },
      { visit: 6, currentHba1c: 7.6, avgHba1c: 6.9 },
      { visit: 7, currentHba1c: 7.5, avgHba1c: 7.0 },
      { visit: 8, currentHba1c: 7.3, avgHba1c: 6.9 },
      { visit: 9, currentHba1c: 7.6, avgHba1c: 7.0 },
      { visit: 10, currentHba1c: 7.8, avgHba1c: 7.1 },
      { visit: 11, currentHba1c: 7.9, avgHba1c: 7.1 },
      { visit: 12, currentHba1c: 8.0, avgHba1c: 7.2 },
      { visit: 13, currentHba1c: 8.0, avgHba1c: 7.2 },
      { visit: 14, currentHba1c: 8.1, avgHba1c: 7.3 },
    ],
    keyFactors: [
      { name: 'HbA1c', value: 85, label: 'Glycated Hemoglobin' },
      { name: 'Fasting glucose', value: 68, label: 'Basal Glucose' },
      { name: 'BMI', value: 45, label: 'Body Mass Index' },
      { name: 'Age', value: 30, label: 'Patient Age' },
      { name: 'Triglycerides', value: 22, label: 'Lipid Profile' },
    ],
    organs: {
      pancreas: { status: 'High Strain', stress: 78, color: '#ef4444' },
      kidneys: { status: 'Moderate', stress: 52, color: '#f59e0b' },
      cardio: { status: 'Moderate', stress: 64, color: '#f59e0b' },
      liver: { status: 'Moderate', stress: 58, color: '#f59e0b' },
      retina: { status: 'Normal', stress: 25, color: '#10b981' },
    },
  },
  {
    id: '2000_0_20201231',
    displayId: 'JB',
    name: 'James Bennett',
    avatarInitials: 'JB',
    age: 62,
    condition: 'Type 2 diabetes',
    visitsCount: 11,
    hba1c: 8.7,
    fastingGlucose: 10.2,
    bmi: 28.4,
    currentRiskPct: 74,
    timeInRangePct: 51,
    latestSignal: '3 nocturnal lows in 7 days',
    riskCategory: 'High',
    timelineData: [
      { visit: 1, currentHba1c: 7.8, avgHba1c: 6.9 },
      { visit: 3, currentHba1c: 8.0, avgHba1c: 7.0 },
      { visit: 6, currentHba1c: 8.3, avgHba1c: 7.1 },
      { visit: 9, currentHba1c: 8.5, avgHba1c: 7.2 },
      { visit: 11, currentHba1c: 8.7, avgHba1c: 7.3 },
    ],
    keyFactors: [
      { name: 'HbA1c', value: 88, label: 'Glycated Hemoglobin' },
      { name: 'Fasting glucose', value: 75, label: 'Basal Glucose' },
      { name: 'BMI', value: 50, label: 'Body Mass Index' },
      { name: 'Age', value: 40, label: 'Patient Age' },
      { name: 'Triglycerides', value: 30, label: 'Lipid Profile' },
    ],
    organs: {
      pancreas: { status: 'High Strain', stress: 82, color: '#ef4444' },
      kidneys: { status: 'High Strain', stress: 70, color: '#ef4444' },
      cardio: { status: 'Moderate', stress: 60, color: '#f59e0b' },
      liver: { status: 'Moderate', stress: 55, color: '#f59e0b' },
      retina: { status: 'Moderate', stress: 45, color: '#f59e0b' },
    },
  },
  {
    id: '2000_0_20211228',
    displayId: 'AP',
    name: 'Amina Patel',
    avatarInitials: 'AP',
    age: 45,
    condition: 'Type 2 diabetes',
    visitsCount: 8,
    hba1c: 6.4,
    fastingGlucose: 6.8,
    bmi: 24.1,
    currentRiskPct: 32,
    timeInRangePct: 76,
    latestSignal: 'Care plan review due today',
    riskCategory: 'Moderate',
    timelineData: [
      { visit: 1, currentHba1c: 7.2, avgHba1c: 6.6 },
      { visit: 2, currentHba1c: 7.0, avgHba1c: 6.5 },
      { visit: 4, currentHba1c: 6.8, avgHba1c: 6.5 },
      { visit: 6, currentHba1c: 6.5, avgHba1c: 6.4 },
      { visit: 8, currentHba1c: 6.4, avgHba1c: 6.4 },
    ],
    keyFactors: [
      { name: 'HbA1c', value: 42, label: 'Glycated Hemoglobin' },
      { name: 'Fasting glucose', value: 38, label: 'Basal Glucose' },
      { name: 'BMI', value: 28, label: 'Body Mass Index' },
      { name: 'Age', value: 25, label: 'Patient Age' },
      { name: 'Triglycerides', value: 20, label: 'Lipid Profile' },
    ],
    organs: {
      pancreas: { status: 'Normal', stress: 30, color: '#10b981' },
      kidneys: { status: 'Normal', stress: 24, color: '#10b981' },
      cardio: { status: 'Normal', stress: 28, color: '#10b981' },
      liver: { status: 'Normal', stress: 22, color: '#10b981' },
      retina: { status: 'Normal', stress: 15, color: '#10b981' },
    },
  },
  {
    id: '2001_0_20210304',
    displayId: 'SL',
    name: 'Samuel Lee',
    avatarInitials: 'SL',
    age: 53,
    condition: 'Type 2 diabetes',
    visitsCount: 12,
    hba1c: 7.3,
    fastingGlucose: 8.2,
    bmi: 26.5,
    currentRiskPct: 48,
    timeInRangePct: 67,
    latestSignal: 'CGM data gap · 18 hours',
    riskCategory: 'Moderate',
    timelineData: [
      { visit: 1, currentHba1c: 7.6, avgHba1c: 7.0 },
      { visit: 4, currentHba1c: 7.5, avgHba1c: 7.0 },
      { visit: 8, currentHba1c: 7.4, avgHba1c: 6.9 },
      { visit: 12, currentHba1c: 7.3, avgHba1c: 6.9 },
    ],
    keyFactors: [
      { name: 'HbA1c', value: 65, label: 'Glycated Hemoglobin' },
      { name: 'Fasting glucose', value: 58, label: 'Basal Glucose' },
      { name: 'BMI', value: 45, label: 'Body Mass Index' },
      { name: 'Age', value: 35, label: 'Patient Age' },
      { name: 'Triglycerides', value: 28, label: 'Lipid Profile' },
    ],
    organs: {
      pancreas: { status: 'Moderate', stress: 55, color: '#f59e0b' },
      kidneys: { status: 'Moderate', stress: 46, color: '#f59e0b' },
      cardio: { status: 'Moderate', stress: 50, color: '#f59e0b' },
      liver: { status: 'Moderate', stress: 42, color: '#f59e0b' },
      retina: { status: 'Normal', stress: 20, color: '#10b981' },
    },
  },
];

export function getPatientById(id: string): Patient {
  return (
    PATIENTS.find((p) => p.id === id || p.displayId === id) ||
    PATIENTS[0]
  );
}
