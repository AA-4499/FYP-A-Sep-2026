/**
 * Clinic overview metrics & dataset matching Borneo Center Kuching dashboard (Image 1)
 */

export interface ClinicStats {
  activePatients: number;
  activePatientsGrowth: string;
  timeInRange: number;
  timeInRangeGrowth: string;
  meanGlucose: number;
  meanGlucoseDelta: string;
  alertsCount: number;
  reviewCapacityPct: number;
  reviewsCompleted: number;
  totalReviewsNeeded: number;
}

export const CLINIC_STATS: ClinicStats = {
  activePatients: 2486,
  activePatientsGrowth: '↑ 3.2% in 30 days',
  timeInRange: 68.4,
  timeInRangeGrowth: '↑ 2.8% in 30 days',
  meanGlucose: 154,
  meanGlucoseDelta: '↓ 6 mg/dL in 30 days',
  alertsCount: 17,
  reviewCapacityPct: 68,
  reviewsCompleted: 174,
  totalReviewsNeeded: 256,
};

export const GENDER_DISTRIBUTION = [
  { name: 'Female', value: 45.87, color: '#84cc16' }, // light green
  { name: 'Male', value: 54.13, color: '#3b82f6' }, // blue
];

export const AGE_DISTRIBUTION = [
  { range: '18 - 30', pct: 0.92 },
  { range: '31 - 40', pct: 10.09 },
  { range: '41 - 50', pct: 12.85 },
  { range: '51 - 60', pct: 20.18 },
  { range: '61 - 70', pct: 35.78 },
  { range: '71+', pct: 20.18 },
];

export const BMI_DISTRIBUTION = [
  { category: 'Underweight', pct: 5.0 },
  { category: 'Normal', pct: 20.0 },
  { category: 'Overweight', pct: 25.0 },
  { category: 'Obese', pct: 50.0 },
];

export const HBA1C_TREND_6M = [
  { month: 'Apr', hba1c: 7.6, benchmark: 7.0 },
  { month: 'May', hba1c: 7.5, benchmark: 7.0 },
  { month: 'Jun', hba1c: 7.4, benchmark: 7.0 },
  { month: 'Jul', hba1c: 7.3, benchmark: 7.0 },
  { month: 'Aug', hba1c: 7.2, benchmark: 7.0 },
  { month: 'Sep', hba1c: 7.2, benchmark: 7.0 },
];

export const GLYCEMIC_CONTROL = {
  atTarget: 1391,
  aboveTarget: 746,
  highRisk: 349,
  medianHbA1c: 7.2,
};

export const CGM_TREND_24H = [
  { time: '12:00', glucose: 165 },
  { time: '14:00', glucose: 158 },
  { time: '16:00', glucose: 153 },
  { time: '18:00', glucose: 148 },
  { time: '20:00', glucose: 144 },
  { time: '22:00', glucose: 142 },
];

export const CLINICAL_SNAPSHOT = {
  avgGlucose: 154,
  timeInRange: 68.4,
  highRisk: 127,
  moderate: 412,
  stable: 1947,
};

export const CLINICAL_ALERTS = [
  { id: 'ALT-1', patient: 'Elena Morales', code: '2000_0_20201230', severity: 'Critical', issue: 'Repeated glucose > 300 mg/dL', time: '12m ago' },
  { id: 'ALT-2', patient: 'James Bennett', code: '2000_0_20201231', severity: 'High', issue: '3 nocturnal lows in 7 days', time: '45m ago' },
  { id: 'ALT-3', patient: 'Amina Patel', code: '2000_0_20211228', severity: 'Moderate', issue: 'Care plan review due today', time: '2h ago' },
  { id: 'ALT-4', patient: 'Samuel Lee', code: '2001_0_20210304', severity: 'Moderate', issue: 'CGM data gap · 18 hours', time: '4h ago' },
];
