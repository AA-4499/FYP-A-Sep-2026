/**
 * Longitudinal Monitoring View matching Figma Image 3
 * Features:
 * - Patient vitals header (HbA1c, Fasting glucose, BMI, Risk)
 * - Key Ambulatory Glucose Profile (AGP) metrics (TIR 70-180 mg/dL, TAR >180, TBR <70, Mean Glucose, CV%)
 * - Longitudinal Continuous CGM Sensor Waveform (14 Days, 1,000+ points)
 * - Actual Daily Glycemic Distribution (Day 1 - Day 14) with real TIR% breakdown
 * - Clean clinical notice for patients without continuous sensor telemetry
 */
import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';
import type { Patient, AGPProfileBin } from '../types';

interface LongitudinalMonitoringViewProps {
  patient: Patient;
  onNavigate: (module: any) => void;
}

export const LongitudinalMonitoringView: React.FC<LongitudinalMonitoringViewProps> = ({
  patient,
  onNavigate,
}) => {
  const [selectedDayRange, setSelectedDayRange] = useState('All 14 days');
  const hasCGM = Boolean(patient.hasContinuousCGM && patient.cgmReadings && patient.cgmReadings.length > 0);
  const cgmSummary = patient.cgmSummary;
  const [selectedAgpRange, setSelectedAgpRange] = useState('14');
  const [selectedAgpView, setSelectedAgpView] = useState<'range' | 'day'>('range');
  const [selectedSingleDay, setSelectedSingleDay] = useState('');

  // Normalize Unix timestamps in seconds or milliseconds.
  const getReadingDate = (timestamp: number): Date => {
    const normalizedTimestamp =
      timestamp < 1_000_000_000_000
        ? timestamp * 1000
        : timestamp;

    return new Date(normalizedTimestamp);
  };

  // Keep only valid readings and sort chronologically.
  const validAgpReadings = useMemo(() => {
    return (patient.cgmReadings ?? [])
      .filter((reading) => {
        return (
          Number.isFinite(reading.cgm) &&
          reading.cgm > 0 &&
          Number.isFinite(reading.timestamp) &&
          Number.isFinite(
            getReadingDate(reading.timestamp).getTime()
          )
        );
      })
      .sort(
        (a, b) =>
          getReadingDate(a.timestamp).getTime() -
          getReadingDate(b.timestamp).getTime()
      );
  }, [patient.cgmReadings]);

  // Use actual calendar dates represented by the sensor readings.
  const availableDateKeys = useMemo(() => {
    return Array.from(
      new Set(
        validAgpReadings.map((reading) => {
          const date = getReadingDate(reading.timestamp);

          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');

          return `${year}-${month}-${day}`;
        })
      )
    ).sort();
  }, [validAgpReadings]);

  const availableDayCount = availableDateKeys.length;

  // Default to the latest available date when entering single-day mode.
  React.useEffect(() => {
    if (availableDateKeys.length === 0) {
      setSelectedSingleDay('');
      return;
    }

    if (!availableDateKeys.includes(selectedSingleDay)) {
      setSelectedSingleDay(
        availableDateKeys[availableDateKeys.length - 1]
      );
    }
  }, [availableDateKeys, selectedSingleDay]);

  // Offer only standard ranges supported by the available data.
  const agpRangeOptions = [
    ...(availableDayCount >= 7
      ? [{ label: 'Last 7 days', value: '7' }]
      : []),
    ...(availableDayCount >= 14
      ? [{ label: 'Last 14 days', value: '14' }]
      : []),
    ...(availableDayCount >= 30
      ? [{ label: 'Last 30 days', value: '30' }]
      : []),
    { label: 'All available', value: 'all' },
  ];

  // Reset the selected range if the available dataset changes.
  React.useEffect(() => {
    const selectionExists = agpRangeOptions.some(
      (option) => option.value === selectedAgpRange
    );

    if (!selectionExists) {
      setSelectedAgpRange('all');
    }
  }, [patient.cgmReadings, selectedAgpRange, availableDayCount]);

  // Profiles to display
  const allProfiles = cgmSummary?.dailyProfiles || [];
  const displayProfiles =
    selectedDayRange === 'First 7 days'
      ? allProfiles.slice(0, 7)
      : selectedDayRange === 'Last 7 days'
      ? allProfiles.slice(-7)
      : allProfiles;

  const filteredAgpReadings = useMemo(() => {
    if (validAgpReadings.length === 0) {
      return [];
    }

    // Single-day mode: use readings from the selected calendar date only.
    if (selectedAgpView === 'day') {
      if (!selectedSingleDay) {
        return [];
      }

      return validAgpReadings.filter((reading) => {
        const date = getReadingDate(reading.timestamp);

        const dateKey = [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, '0'),
          String(date.getDate()).padStart(2, '0'),
        ].join('-');

        return dateKey === selectedSingleDay;
      });
    }

    // Multi-day mode: preserve the selected reporting period.
    if (selectedAgpRange === 'all') {
      return validAgpReadings;
    }

    const days = Number(selectedAgpRange);

    if (!Number.isFinite(days) || days <= 0) {
      return validAgpReadings;
    }

    const latestTimestamp = getReadingDate(
      validAgpReadings[validAgpReadings.length - 1].timestamp
    ).getTime();

    const cutoff =
      latestTimestamp - days * 24 * 60 * 60 * 1000;

    return validAgpReadings.filter((reading) => {
      const timestamp = getReadingDate(
        reading.timestamp
      ).getTime();

      return timestamp > cutoff && timestamp <= latestTimestamp;
    });
  }, [
    validAgpReadings,
    selectedAgpRange,
    selectedAgpView,
    selectedSingleDay,
  ]);

  // Calculate the three metrics from exactly the readings
  // used by the selected AGP reporting period.
  const agpMetrics = useMemo(() => {
    const readings = filteredAgpReadings;

    if (readings.length === 0) {
      return {
        tir: null as number | null,
        tar: null as number | null,
        tbr: null as number | null,
        mean: null as number | null,
        cv: null as number | null,
      };
    }

    const values = readings.map((reading) => reading.cgm);

    const inRange = values.filter(
      (value) => value >= 70 && value <= 180
    ).length;

    const aboveRange = values.filter(
      (value) => value > 180
    ).length;

    const belowRange = values.filter(
      (value) => value < 70
    ).length;

    const mean =
      values.reduce((sum, value) => sum + value, 0) /
      values.length;

    const variance =
      values.reduce(
        (sum, value) => sum + Math.pow(value - mean, 2),
        0
      ) / values.length;

    const standardDeviation = Math.sqrt(variance);

    return {
      tir: (inRange / values.length) * 100,
      tar: (aboveRange / values.length) * 100,
      tbr: (belowRange / values.length) * 100,
      mean,
      cv: mean > 0 ? (standardDeviation / mean) * 100 : null,
    };
  }, [filteredAgpReadings]);

  const availableAgpDays = useMemo(() => {
    const uniqueDays = new Set(
      filteredAgpReadings.map((reading) => {
        const date = getReadingDate(reading.timestamp);

        return [
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
        ].join('-');
      })
    );

    return uniqueDays.size;
  }, [filteredAgpReadings]);

  const requestedAgpDays =
    selectedAgpRange === 'all'
      ? null
      : Number(selectedAgpRange);

  const hasIncompleteAgpRange =
    requestedAgpDays !== null &&
    availableAgpDays < requestedAgpDays;

  // Linear-interpolated percentile calculation.
  const percentile = (
    values: number[],
    percent: number,
  ): number => {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const position = (sorted.length - 1) * percent;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);

    if (lowerIndex === upperIndex) {
      return sorted[lowerIndex];
    }

    const fraction = position - lowerIndex;

    return (
      sorted[lowerIndex] * (1 - fraction) +
      sorted[upperIndex] * fraction
    );
  };

  // Build 96 fifteen-minute time-of-day bins.
  // Each bin aggregates readings from all available days.
  const agpBins = useMemo<AGPProfileBin[]>(() => {
    const readings = filteredAgpReadings;
    const valuesByBin: number[][] = Array.from(
      { length: 96 },
      () => [],
    );

    readings.forEach((reading) => {
      if (
        !Number.isFinite(reading.cgm) ||
        reading.cgm <= 0
      ) {
        return;
      }

      const date = getReadingDate(reading.timestamp);

      if (Number.isNaN(date.getTime())) return;

      const minuteOfDay =
        date.getHours() * 60 + date.getMinutes();

      const binIndex = Math.min(
        95,
        Math.floor(minuteOfDay / 15),
      );

      valuesByBin[binIndex].push(reading.cgm);
    });

    return valuesByBin.flatMap((values, index) => {
      // Leave missing intervals missing rather than
      // inventing glucose readings.
      if (values.length === 0) return [];

      return [{
        minuteOfDay: index * 15,
        p10: percentile(values, 0.10),
        p25: percentile(values, 0.25),
        median: percentile(values, 0.50),
        p75: percentile(values, 0.75),
        p90: percentile(values, 0.90),
        readingsCount: values.length,
      }];
    });
  }, [filteredAgpReadings]);

  const agpHasData = agpBins.length > 0;

  // Chart dimensions and glucose scale.
  const chartWidth = 800;
  const chartHeight = 330;
  const plotLeft = 48;
  const plotRight = 770;
  const plotTop = 28;
  const plotBottom = 276;
  const glucoseMin = 40;
  const glucoseMax = 340;

  const xForMinute = (minute: number) =>
    plotLeft + (minute / 1440) * (plotRight - plotLeft);

  const yForGlucose = (glucose: number) =>
    plotBottom -
    ((Math.max(glucoseMin, Math.min(glucoseMax, glucose)) -
      glucoseMin) /
      (glucoseMax - glucoseMin)) *
      (plotBottom - plotTop);

  // Split the profile at missing intervals so the chart
  // does not connect unrelated data across large gaps.
  const agpSegments = useMemo(() => {
    const segments: AGPProfileBin[][] = [];
    let current: AGPProfileBin[] = [];

    agpBins.forEach((bin) => {
      const previous = current[current.length - 1];

      if (
        previous &&
        bin.minuteOfDay - previous.minuteOfDay > 30
      ) {
        segments.push(current);
        current = [];
      }

      current.push(bin);
    });

    if (current.length > 0) segments.push(current);

    return segments;
  }, [agpBins]);

  const makeBandPath = (
    segment: AGPProfileBin[],
    lowerKey: 'p10' | 'p25',
    upperKey: 'p75' | 'p90',
  ) => {
    if (segment.length < 2) return '';

    const upper = segment.map(
      (bin) =>
        `${xForMinute(bin.minuteOfDay)},${yForGlucose(bin[upperKey])}`,
    );

    const lower = [...segment].reverse().map(
      (bin) =>
        `${xForMinute(bin.minuteOfDay)},${yForGlucose(bin[lowerKey])}`,
    );

    return `M ${upper.join(' L ')} L ${lower.join(' L ')} Z`;
  };

  const makeMedianPath = (segment: AGPProfileBin[]) => {
    if (segment.length === 0) return '';

    return segment
      .map((bin, index) => {
        const command = index === 0 ? 'M' : 'L';

        return (
          `${command} ${xForMinute(bin.minuteOfDay)} ` +
          `${yForGlucose(bin.median)}`
        );
      })
      .join(' ');
  };

  // Build a line from actual CGM readings for the selected day.
  // Unlike the AGP, this does not aggregate readings into percentiles.
  const cgmDayPath = useMemo(() => {
    if (selectedAgpView !== 'day' || filteredAgpReadings.length === 0) {
      return '';
    }

    return filteredAgpReadings
      .map((reading, index) => {
        const date = getReadingDate(reading.timestamp);

        const minuteOfDay =
          date.getHours() * 60 + date.getMinutes();

        const x = xForMinute(minuteOfDay);
        const y = yForGlucose(reading.cgm);

        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [filteredAgpReadings, selectedAgpView]);

  const [hoveredMinute, setHoveredMinute] = useState<number | null>(null);

  const handleChartMouseMove = (
    event: React.MouseEvent<SVGSVGElement>
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();

    // Convert the mouse position into SVG viewBox coordinates.
    const svgX =
      ((event.clientX - rect.left) / rect.width) * chartWidth;

    // Restrict the crosshair to the actual plotting area.
    const clampedX = Math.max(
      plotLeft,
      Math.min(plotRight, svgX)
    );

    const minute = Math.round(
      ((clampedX - plotLeft) / (plotRight - plotLeft)) * 1440
    );

    setHoveredMinute(Math.min(1439, Math.max(0, minute)));
  };

  const formatHoverTime = (minute: number) => {
    const hour = Math.floor(minute / 60);
    const mins = minute % 60;

    return `${String(hour).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const hoveredAgpBin = useMemo(() => {
    if (hoveredMinute === null || agpBins.length === 0) {
      return null;
    }

    // Find the nearest populated 15-minute bin.
    return agpBins.reduce((nearest, bin) =>
      Math.abs(bin.minuteOfDay - hoveredMinute) <
      Math.abs(nearest.minuteOfDay - hoveredMinute)
        ? bin
        : nearest
    );
  }, [hoveredMinute, agpBins]);

  const hoveredCgmReading = useMemo(() => {
    if (
      hoveredMinute === null ||
      selectedAgpView !== 'day' ||
      filteredAgpReadings.length === 0
    ) {
      return null;
    }

    const nearest = filteredAgpReadings.reduce((best, reading) => {
      const date = getReadingDate(reading.timestamp);
      const minute = date.getHours() * 60 + date.getMinutes();

      const bestDate = getReadingDate(best.timestamp);
      const bestMinute =
        bestDate.getHours() * 60 + bestDate.getMinutes();

      return Math.abs(minute - hoveredMinute) <
        Math.abs(bestMinute - hoveredMinute)
        ? reading
        : best;
    });

    const date = getReadingDate(nearest.timestamp);
    const readingMinute = date.getHours() * 60 + date.getMinutes();

    return Math.abs(readingMinute - hoveredMinute) <= 15
      ? nearest
      : null;
  }, [hoveredMinute, selectedAgpView, filteredAgpReadings]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('patient_dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Patient Dashboard</span>
        </button>

        <span className="text-xs text-slate-400 font-medium">
          Module: <strong className="text-slate-700">Longitudinal Monitoring</strong>
        </span>
      </div>

      {/* 2. Top Patient Vitals Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-2">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">HbA1c</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {patient.hba1c}%
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Fasting glucose</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {patient.fastingGlucose} <span className="text-xs font-normal text-slate-500">mmol/L</span>
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">BMI</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {patient.bmi}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Current risk</p>
          <p className="text-2xl sm:text-3xl font-bold text-[#b91c1c] tracking-tight">
            {patient.currentRiskPct}%
          </p>
        </div>
      </div>

      {/* 3. AGP Metrics Strip (If continuous CGM telemetry exists) */}
      {hasCGM && cgmSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4">
          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Time In Range (TIR)</span>
            <p className="text-xl font-bold text-emerald-600">{cgmSummary.timeInRangePct}%</p>
            <span className="text-[10px] text-slate-400">70–180 mg/dL target</span>
          </div>

          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Time Above Range</span>
            <p className="text-xl font-bold text-rose-600">{cgmSummary.timeAboveRangePct}%</p>
            <span className="text-[10px] text-slate-400">&gt; 180 mg/dL</span>
          </div>

          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Time Below Range</span>
            <p className="text-xl font-bold text-amber-600">{cgmSummary.timeBelowRangePct}%</p>
            <span className="text-[10px] text-slate-400">&lt; 70 mg/dL</span>
          </div>

          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Mean CGM Glucose</span>
            <p className="text-xl font-bold text-slate-900">{cgmSummary.meanGlucose} <span className="text-xs font-normal text-slate-500">mg/dL</span></p>
            <span className="text-[10px] text-slate-400">{(cgmSummary.meanGlucose / 18.0182).toFixed(1)} mmol/L</span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-500 font-medium">Glycemic Variability</span>
            <p className="text-xl font-bold text-slate-800">{cgmSummary.cvPct}% <span className="text-xs font-normal text-slate-500">CV</span></p>
            <span className="text-[10px] text-slate-400">Target &le; 36%</span>
          </div>
        </div>
      )}

      {/* 4. Tidepool-style Ambulatory Glucose Profile */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {selectedAgpView === 'range'
                ? 'Ambulatory Glucose Profile (AGP)'
                : 'Continuous Glucose Monitoring (CGM)'}
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              {selectedAgpView === 'range'
                ? 'Glucose distribution by time of day across the selected monitoring period'
                : 'Actual sensor glucose readings throughout the selected 24-hour period'}
            </p>
            {hasCGM && (
              <p className="text-xs text-slate-400 mt-1">
                {filteredAgpReadings.length.toLocaleString()} readings
                {' · '}
                {filteredAgpReadings.length > 0
                  ? `${getReadingDate(
                      filteredAgpReadings[0].timestamp
                    ).toLocaleDateString()} – ${getReadingDate(
                      filteredAgpReadings[
                        filteredAgpReadings.length - 1
                      ].timestamp
                    ).toLocaleDateString()}`
                  : 'No readings in this period'}
                {' · '}
                {agpBins.length} of 96 daily intervals populated
              </p>
            )}
          </div>

          {hasCGM && (
            <div className="flex flex-wrap items-end gap-3 shrink-0">
              {selectedAgpView === 'range' ? (
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="agp-date-range"
                    className="text-[10px] font-medium text-slate-500"
                  >
                    Reporting period
                  </label>

                  <select
                    id="agp-date-range"
                    value={selectedAgpRange}
                    onChange={(e) => setSelectedAgpRange(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {agpRangeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="agp-single-date"
                    className="text-[10px] font-medium text-slate-500"
                  >
                    Select available date
                  </label>

                  <select
                    id="agp-single-date"
                    value={selectedSingleDay}
                    onChange={(e) => setSelectedSingleDay(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableDateKeys.map((dateKey) => (
                      <option key={dateKey} value={dateKey}>
                        {new Date(`${dateKey}T12:00:00`).toLocaleDateString(
                          undefined,
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }
                        )}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="agp-view-mode"
                  className="text-[10px] font-medium text-slate-500"
                >
                  Chart view
                </label>

                <select
                  id="agp-view-mode"
                  value={selectedAgpView}
                  onChange={(e) =>
                    setSelectedAgpView(e.target.value as 'range' | 'day')
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="range">AGP · Date range</option>
                  <option value="day">CGM · Single day</option>
                </select>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[10px] font-medium text-emerald-700">
                  {selectedAgpView === 'day'
                    ? 'Daily mean glucose'
                    : 'Mean glucose'}
                </p>

                <p className="text-lg font-bold text-emerald-800">
                  {agpMetrics.mean === null
                    ? '—'
                    : agpMetrics.mean.toFixed(1)}
                  <span className="ml-1 text-xs font-normal">mg/dL</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {hasCGM && agpHasData ? (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" />
                Target range: 70–180 mg/dL
              </span>

              {selectedAgpView === 'range' ? (
                <>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-blue-200" />
                    25th–75th percentile
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200" />
                    10th–90th percentile
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <span className="w-5 h-0.5 bg-blue-700" />
                    Median glucose
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span className="w-5 h-0.5 bg-blue-600" />
                  Actual CGM glucose readings
                </span>
              )}
            </div>

            {selectedAgpView === 'range' ? (
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full min-w-[620px] h-auto"
                role="img"
                aria-label="Ambulatory glucose profile showing median glucose and glucose percentile bands by time of day"
                onMouseMove={handleChartMouseMove}
                onMouseLeave={() => setHoveredMinute(null)}
              >
                <defs>
                  <clipPath id="agp-plot-clip">
                    <rect
                      x={plotLeft}
                      y={plotTop}
                      width={plotRight - plotLeft}
                      height={plotBottom - plotTop}
                    />
                  </clipPath>
                </defs>

                {/* Target glucose zone */}
                <rect
                  x={plotLeft}
                  y={yForGlucose(180)}
                  width={plotRight - plotLeft}
                  height={yForGlucose(70) - yForGlucose(180)}
                  fill="#d1fae5"
                  opacity="0.7"
                />

                {/* Glucose reference lines and Y-axis labels */}
                {[40, 70, 100, 140, 180, 220, 260, 300, 340].map(
                  (glucose) => (
                    <g key={glucose}>
                      <line
                        x1={plotLeft}
                        x2={plotRight}
                        y1={yForGlucose(glucose)}
                        y2={yForGlucose(glucose)}
                        stroke={
                          glucose === 70 || glucose === 180
                            ? "#10b981"
                            : "#e2e8f0"
                        }
                        strokeWidth={
                          glucose === 70 || glucose === 180
                            ? 1.2
                            : 0.8
                        }
                        strokeDasharray={
                          glucose === 70 || glucose === 180
                            ? "5 4"
                            : "2 3"
                        }
                      />
                      <text
                        x={plotLeft - 9}
                        y={yForGlucose(glucose) + 4}
                        textAnchor="end"
                        fontSize="11"
                        fill={
                          glucose === 70 || glucose === 180
                            ? "#059669"
                            : "#64748b"
                        }
                      >
                        {glucose}
                      </text>
                    </g>
                  ),
                )}

                {/* Percentile ribbons and median */}
                <g clipPath="url(#agp-plot-clip)">
                  {agpSegments.map((segment, index) => (
                    <g key={`agp-segment-${index}`}>
                      {/* Outer band: 10th to 90th percentile */}
                      <path
                        d={makeBandPath(segment, "p10", "p90")}
                        fill="#bfdbfe"
                        fillOpacity="0.8"
                        stroke="none"
                      />

                      {/* Inner band: 25th to 75th percentile */}
                      <path
                        d={makeBandPath(segment, "p25", "p75")}
                        fill="#60a5fa"
                        fillOpacity="0.55"
                        stroke="none"
                      />

                      {/* Median glucose */}
                      <path
                        d={makeMedianPath(segment)}
                        fill="none"
                        stroke="#1d4ed8"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  ))}
                </g>

                {/* Hover crosshair and tooltip */}
                  {hoveredMinute !== null && (
                    <g pointerEvents="none">
                      {(() => {
                        const x = xForMinute(hoveredMinute);
                        const tooltipWidth = 190;
                        const tooltipHeight = 90;

                        // Keep the tooltip inside the chart boundaries.
                        const tooltipX = Math.max(
                          plotLeft,
                          Math.min(plotRight - tooltipWidth, x + 12)
                        );

                        const tooltipY = plotTop + 8;

                        // Avoid displaying a distant percentile bin as the
                        // reading for the hovered time.
                        const hasNearbyBin =
                          hoveredAgpBin !== null &&
                          Math.abs(
                            hoveredAgpBin.minuteOfDay - hoveredMinute
                          ) <= 15;

                        return (
                          <>
                            {/* Vertical crosshair */}
                            <line
                              x1={x}
                              x2={x}
                              y1={plotTop}
                              y2={plotBottom}
                              stroke="#9ca3af"
                              strokeWidth="1"
                              strokeDasharray="4 3"
                            />

                            {/* Time marker */}
                            <circle
                              cx={x}
                              cy={
                                hasNearbyBin
                                  ? yForGlucose(hoveredAgpBin!.median)
                                  : plotTop
                              }
                              r="3.5"
                              fill="#ffffff"
                              stroke="#2563eb"
                              strokeWidth="2"
                            />

                            {/* Tooltip background */}
                            <rect
                              x={tooltipX}
                              y={tooltipY}
                              width={tooltipWidth}
                              height={tooltipHeight}
                              rx="7"
                              fill="#f3f4f6"
                              stroke="#d1d5db"
                              strokeWidth="0.8"
                              opacity="0.97"
                            />

                            {/* Tooltip content */}
                            <text
                              x={tooltipX + 10}
                              y={tooltipY + 17}
                              fontSize="11"
                              fontWeight="700"
                              fill="#111827"
                            >
                              {formatHoverTime(hoveredMinute)}
                            </text>

                            {hasNearbyBin ? (
                              <>
                                <text
                                  x={tooltipX + 10}
                                  y={tooltipY + 36}
                                  fontSize="10"
                                  fill="#374151"
                                >
                                  Median: {hoveredAgpBin!.median.toFixed(1)} mg/dL
                                </text>

                                <text
                                  x={tooltipX + 10}
                                  y={tooltipY + 53}
                                  fontSize="10"
                                  fill="#374151"
                                >
                                  P25–P75: {hoveredAgpBin!.p25.toFixed(1)}
                                  {" – "}
                                  {hoveredAgpBin!.p75.toFixed(1)}
                                </text>

                                <text
                                  x={tooltipX + 10}
                                  y={tooltipY + 70}
                                  fontSize="10"
                                  fill="#374151"
                                >
                                  P10–P90: {hoveredAgpBin!.p10.toFixed(1)}
                                  {" – "}
                                  {hoveredAgpBin!.p90.toFixed(1)}
                                </text>

                                <text
                                  x={tooltipX + 10}
                                  y={tooltipY + 91}
                                  fontSize="9"
                                  fill="#6b7280"
                                >
                                </text>
                              </>
                            ) : (
                              <text
                                x={tooltipX + 10}
                                y={tooltipY + 39}
                                fontSize="10"
                                fill="#6b7280"
                              >
                                No nearby readings
                              </text>
                            )}
                          </>
                        );
                      })()}
                    </g>
                  )}

                {/* X-axis: time of day */}
                {[0, 4, 8, 12, 16, 20, 24].map((hour) => {
                  const x =
                    plotLeft +
                    (hour / 24) * (plotRight - plotLeft);

                  return (
                    <g key={hour}>
                      <line
                        x1={x}
                        x2={x}
                        y1={plotBottom}
                        y2={plotBottom + 5}
                        stroke="#94a3b8"
                      />
                      <text
                        x={x}
                        y={plotBottom + 21}
                        textAnchor={
                          hour === 0
                            ? "start"
                            : hour === 24
                            ? "end"
                            : "middle"
                        }
                        fontSize="11"
                        fill="#64748b"
                      >
                        {hour === 24
                          ? "24:00"
                          : `${String(hour).padStart(2, "0")}:00`}
                      </text>
                    </g>
                  );
                })}

                <text
                  x={(plotLeft + plotRight) / 2}
                  y={chartHeight - 7}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                >
                  Time of day
                </text>

                <text
                  x="13"
                  y={(plotTop + plotBottom) / 2}
                  transform={`rotate(-90 13 ${(plotTop + plotBottom) / 2})`}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                >
                  Glucose (mg/dL)
                </text>
              </svg>
            </div>
            ) : (
            <div className="w-full overflow-x-auto">
              <div className="mb-3 text-xs text-slate-500">
                Actual CGM readings for{' '}
                <span className="font-semibold text-slate-700">
                  {selectedSingleDay
                    ? new Date(
                        `${selectedSingleDay}T12:00:00`
                      ).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'No date selected'}
                </span>
                {' · '}
                {filteredAgpReadings.length.toLocaleString()} readings
              </div>

              {filteredAgpReadings.length > 0 ? (
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full min-w-[620px] h-auto"
                  role="img"
                  aria-label="Continuous glucose monitor readings over the selected day"
                  onMouseMove={handleChartMouseMove}
                  onMouseLeave={() => setHoveredMinute(null)}
                >
                  <defs>
                    <clipPath id="cgm-day-plot-clip">
                      <rect
                        x={plotLeft}
                        y={plotTop}
                        width={plotRight - plotLeft}
                        height={plotBottom - plotTop}
                      />
                    </clipPath>
                  </defs>

                  {/* Target glucose zone */}
                  <rect
                    x={plotLeft}
                    y={yForGlucose(180)}
                    width={plotRight - plotLeft}
                    height={yForGlucose(70) - yForGlucose(180)}
                    fill="#d1fae5"
                    opacity="0.7"
                  />

                  {/* Glucose reference lines */}
                  {[40, 70, 100, 140, 180, 220, 260, 300, 340].map(
                    (glucose) => (
                      <g key={glucose}>
                        <line
                          x1={plotLeft}
                          x2={plotRight}
                          y1={yForGlucose(glucose)}
                          y2={yForGlucose(glucose)}
                          stroke={
                            glucose === 70 || glucose === 180
                              ? '#10b981'
                              : '#e2e8f0'
                          }
                          strokeWidth={
                            glucose === 70 || glucose === 180
                              ? 1.2
                              : 0.8
                          }
                          strokeDasharray={
                            glucose === 70 || glucose === 180
                              ? '5 4'
                              : '2 3'
                          }
                        />

                        <text
                          x={plotLeft - 9}
                          y={yForGlucose(glucose) + 4}
                          textAnchor="end"
                          fontSize="11"
                          fill="#64748b"
                        >
                          {glucose}
                        </text>
                      </g>
                    )
                  )}

                  {/* Actual sensor glucose waveform */}
                  <g clipPath="url(#cgm-day-plot-clip)">
                    <path
                      d={cgmDayPath}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>

                  {/* Single-day CGM hover crosshair and tooltip */}
                    {hoveredMinute !== null && (
                      <g pointerEvents="none">
                        {(() => {
                          const x = xForMinute(hoveredMinute);
                          const tooltipWidth = 170;
                          const tooltipHeight = 58;

                          const tooltipX = Math.max(
                            plotLeft,
                            Math.min(plotRight - tooltipWidth, x + 12)
                          );

                          const tooltipY = plotTop + 8;

                          return (
                            <>
                              <line
                                x1={x}
                                x2={x}
                                y1={plotTop}
                                y2={plotBottom}
                                stroke="#9ca3af"
                                strokeWidth="1"
                                strokeDasharray="4 3"
                              />

                              {hoveredCgmReading && (
                                <circle
                                  cx={xForMinute(
                                    getReadingDate(hoveredCgmReading.timestamp)
                                      .getHours() * 60 +
                                    getReadingDate(hoveredCgmReading.timestamp)
                                      .getMinutes()
                                  )}
                                  cy={yForGlucose(hoveredCgmReading.cgm)}
                                  r="4"
                                  fill="#ffffff"
                                  stroke="#2563eb"
                                  strokeWidth="2"
                                />
                              )}

                              <rect
                                x={tooltipX}
                                y={tooltipY}
                                width={tooltipWidth}
                                height={tooltipHeight}
                                rx="7"
                                fill="#f3f4f6"
                                stroke="#d1d5db"
                                strokeWidth="0.8"
                                opacity="0.97"
                              />

                              <text
                                x={tooltipX + 10}
                                y={tooltipY + 19}
                                fontSize="11"
                                fontWeight="700"
                                fill="#111827"
                              >
                                {formatHoverTime(hoveredMinute)}
                              </text>

                              <text
                                x={tooltipX + 10}
                                y={tooltipY + 39}
                                fontSize="10"
                                fill="#374151"
                              >
                                {hoveredCgmReading
                                  ? `Glucose: ${hoveredCgmReading.cgm.toFixed(1)} mg/dL`
                                  : "No nearby sensor reading"}
                              </text>
                            </>
                          );
                        })()}
                      </g>
                    )}

                  {/* Time-of-day axis */}
                  {[0, 4, 8, 12, 16, 20, 24].map((hour) => {
                    const x =
                      plotLeft +
                      (hour / 24) * (plotRight - plotLeft);

                    return (
                      <g key={hour}>
                        <line
                          x1={x}
                          x2={x}
                          y1={plotBottom}
                          y2={plotBottom + 5}
                          stroke="#94a3b8"
                        />

                        <text
                          x={x}
                          y={plotBottom + 21}
                          textAnchor={
                            hour === 0
                              ? 'start'
                              : hour === 24
                              ? 'end'
                              : 'middle'
                          }
                          fontSize="11"
                          fill="#64748b"
                        >
                          {hour === 24
                            ? '24:00'
                            : `${String(hour).padStart(2, '0')}:00`}
                        </text>
                      </g>
                    );
                  })}

                  <text
                    x={(plotLeft + plotRight) / 2}
                    y={chartHeight - 7}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#64748b"
                  >
                    Time of day
                  </text>

                  <text
                    x="13"
                    y={(plotTop + plotBottom) / 2}
                    transform={`rotate(-90 13 ${(plotTop + plotBottom) / 2})`}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#64748b"
                  >
                    Glucose (mg/dL)
                  </text>
                </svg>
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">
                  No valid CGM readings are available for this date.
                </div>
              )}
            </div>
          )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">
                  Time in Range
                </p>
                <p className="text-xl font-bold text-emerald-600 mt-1">
                  {agpMetrics.tir === null
                  ? '—'
                  : `${agpMetrics.tir.toFixed(1)}%`}
                </p>
                <p className="text-[10px] text-slate-400">
                  70–180 mg/dL
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">
                  Time Above Range
                </p>
                <p className="text-xl font-bold text-rose-600 mt-1">
                  {agpMetrics.tar === null
                  ? '—'
                  : `${agpMetrics.tar.toFixed(1)}%`}
                </p>
                <p className="text-[10px] text-slate-400">
                  Above 180 mg/dL
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">
                  Time Below Range
                </p>
                <p className="text-xl font-bold text-amber-600 mt-1">
                  {agpMetrics.tbr === null
                  ? '—'
                  : `${agpMetrics.tbr.toFixed(1)}%`}
                </p>
                <p className="text-[10px] text-slate-400">
                  Below 70 mg/dL
                </p>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Percentile bands summarize observed glucose readings at each
              time of day. Gaps indicate intervals without readings.
              The display uses the available readings; confirm the intended
              reporting period before clinical interpretation.
            </p>
          </>
        ) : (
          <div className="py-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <Activity className="w-8 h-8 text-slate-400 mx-auto mb-3" />

            <p className="text-sm font-bold text-slate-800">
              {hasCGM
                ? "No valid CGM readings available for the AGP chart"
                : "No Continuous CGM Sensor Telemetry"}
            </p>

            <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
              {hasCGM
                ? "The available sensor data could not be grouped into valid time-of-day intervals."
                : `This patient has no continuous CGM readings. Baseline fasting glucose is ${patient.fastingGlucose} and HbA1c is ${patient.hba1c}%. An AGP cannot be calculated without sensor readings.`}
            </p>

            {!hasCGM && (
              <button
                onClick={() => onNavigate("patients")}
                className="mt-4 px-3 py-2 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold transition"
              >
                Switch to another patient
              </button>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
          <span className="font-semibold text-emerald-700">
            Green:
          </span>{" "}
          target glucose range ·{" "}
          <span className="font-semibold text-blue-700">
            Blue:
          </span>{" "}
          glucose distribution and median
        </div>
      </div>

      {/* 5. Daily Glycemic Distribution Bar Chart (Day 1 - Day 14) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Daily Glycemic Distribution (Day-by-Day Profiles)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasCGM ? 'Daily mean glucose levels and Time-in-Range percentages across each 24-hour cycle' : 'Daily glucose logs'}
            </p>
          </div>

          {hasCGM && (
            <div className="relative">
              <select
                value={selectedDayRange}
                onChange={(e) => setSelectedDayRange(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 pr-6 appearance-none focus:outline-hidden cursor-pointer"
              >
                <option>All 14 days</option>
                <option>First 7 days</option>
                <option>Last 7 days</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
            </div>
          )}
        </div>

        {hasCGM && displayProfiles.length > 0 ? (
          <div className="h-64 flex items-end justify-between gap-2 pt-6 px-2 overflow-x-auto">
            {displayProfiles.map((item) => {
              // Scale bar based on max 250 mg/dL
              const barHeightPct = Math.min(100, Math.max(15, (item.mean / 260) * 100));
              const isOptimal = item.tir >= 70;
              const isModerate = item.tir >= 50 && item.tir < 70;

              return (
                <div key={item.dayLabel} className="flex-1 min-w-[40px] flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-bold text-slate-700">
                    {item.mean}
                  </span>
                  <div className="w-full max-w-[34px] bg-slate-100 rounded-t-lg h-full max-h-40 flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 cursor-pointer ${
                        isOptimal
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : isModerate
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-rose-500 hover:bg-rose-600'
                      }`}
                      style={{ height: `${barHeightPct}%` }}
                      title={`${item.dayLabel}: Mean ${item.mean} mg/dL, TIR ${item.tir}%`}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 font-semibold truncate max-w-[50px] text-center">
                    D{item.dayNumber}
                  </span>
                  <span className={`text-[9px] font-bold ${isOptimal ? 'text-emerald-600' : isModerate ? 'text-blue-600' : 'text-rose-600'}`}>
                    {item.tir}%
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No daily continuous CGM profiles recorded for this patient.
          </div>
        )}

        {hasCGM && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                <span>TIR &ge; 70% (Optimal)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                <span>TIR 50–70% (Moderate)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
                <span>TIR &lt; 50% (High Variance)</span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Values on top of bars: Daily Mean Glucose (mg/dL)</span>
          </div>
        )}
      </div>
    </div>
  );
};
