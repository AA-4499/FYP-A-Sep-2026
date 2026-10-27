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
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clinicalValue } from '../lib/clinicalData';
import type { Patient, AGPProfileBin, NavigationModule } from '../types';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

interface LongitudinalMonitoringViewProps {
  patient: Patient;
  onNavigate: (module: NavigationModule) => void;
  allowPatientSelection?: boolean;
}

export const LongitudinalMonitoringView: React.FC<LongitudinalMonitoringViewProps> = ({
  patient,
  onNavigate,
  allowPatientSelection = true,
}) => {
  const [selectedDayRange, setSelectedDayRange] = useState('All available days');
  const hasCGM = Boolean(patient.hasContinuousCGM && patient.cgmReadings && patient.cgmReadings.length > 0);
  const cgmSummary = patient.cgmSummary;
  const [selectedAgpRange, setSelectedAgpRange] = useState('14');
  const [selectedAgpView, setSelectedAgpView] = useState<'range' | 'day'>('range');
  const [selectedSingleDay, setSelectedSingleDay] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    () => new Date()
  );

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
      const latestDate = availableDateKeys[availableDateKeys.length - 1];

      setSelectedSingleDay(latestDate);
      setCalendarMonth(new Date(`${latestDate}T12:00:00`));
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

  // Calculate the three metrics from exactly the readings used by the selected AGP reporting period.
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
  type AgpInteractiveRegion =
  | 'target'
  | 'p10-p90'
  | 'p25-p75'
  | 'median'
  | 'below'
  | 'above'
  | null;

  const [selectedAgpRegion, setSelectedAgpRegion] =
    useState<AgpInteractiveRegion>(null);

  const [hoveredAgpRegion, setHoveredAgpRegion] =
    useState<AgpInteractiveRegion>(null);

  const toggleAgpRegion = (region: Exclude<AgpInteractiveRegion, null>) => {
    setSelectedAgpRegion((current) =>
      current === region ? null : region
    );
  };

  const getAgpRegionFromEvent = (
    event: React.MouseEvent<SVGSVGElement>
  ): Exclude<AgpInteractiveRegion, null> | null => {
    const target = event.target as Element;

    const regionElement = target.closest("[data-agp-region]");

    if (!regionElement) return null;

    const region = regionElement.getAttribute("data-agp-region");

    const validRegions: Exclude<AgpInteractiveRegion, null>[] = [
      "target",
      "p10-p90",
      "p25-p75",
      "median",
      "below",
      "above",
    ];

    if (
      !validRegions.includes(
        region as Exclude<AgpInteractiveRegion, null>
      )
    ) {
      return null;
    }

    return region as Exclude<AgpInteractiveRegion, null>;
  };

  const handleChartMouseMove = (
    event: React.MouseEvent<SVGSVGElement>
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();

    const svgX =
      ((event.clientX - rect.left) / rect.width) * chartWidth;

    const svgY =
      ((event.clientY - rect.top) / rect.height) * chartHeight;

    const clampedX = Math.max(
      plotLeft,
      Math.min(plotRight, svgX)
    );

    const minute = Math.round(
      ((clampedX - plotLeft) / (plotRight - plotLeft)) * 1440
    );

    setHoveredMinute(Math.min(1439, Math.max(0, minute)));

    // Only highlight an actual SVG region under the pointer.
    setHoveredAgpRegion(getAgpRegionFromEvent(event));
  };

  const handleAgpChartClick = (
    event: React.MouseEvent<SVGSVGElement>
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();

    // Convert screen coordinates into SVG viewBox coordinates.
    const svgX =
      ((event.clientX - rect.left) / rect.width) * chartWidth;

    const svgY =
      ((event.clientY - rect.top) / rect.height) * chartHeight;

    // Ignore clicks outside the actual plotting area.
    if (
      svgX < plotLeft ||
      svgX > plotRight ||
      svgY < plotTop ||
      svgY > plotBottom
    ) {
      setSelectedAgpRegion(null);
      return;
    }

    const minute = Math.max(
      0,
      Math.min(
        1439,
        Math.round(
          ((svgX - plotLeft) / (plotRight - plotLeft)) * 1440
        )
      )
    );

    // Convert the clicked Y position back to glucose (mg/dL).
    const glucose =
      glucoseMin +
      ((plotBottom - svgY) / (plotBottom - plotTop)) *
        (glucoseMax - glucoseMin);

    // Find the nearest populated 15-minute bin.
    const nearestBin = agpBins.reduce<AGPProfileBin | null>(
      (nearest, bin) => {
        if (!nearest) return bin;

        return Math.abs(bin.minuteOfDay - minute) <
          Math.abs(nearest.minuteOfDay - minute)
          ? bin
          : nearest;
      },
      null
    );

    const clickedRegion = getAgpRegionFromEvent(event);

    // Clicking empty chart space clears the current selection.
    if (!clickedRegion) {
      setSelectedAgpRegion(null);
      return;
    }

    toggleAgpRegion(clickedRegion);
  };

  const getAgpRegionAtPosition = (
    svgX: number,
    svgY: number,
  ): Exclude<AgpInteractiveRegion, null> | null => {
    if (
      svgX < plotLeft ||
      svgX > plotRight ||
      svgY < plotTop ||
      svgY > plotBottom
    ) {
      return null;
    }

    const minute = Math.max(
      0,
      Math.min(
        1439,
        Math.round(
          ((svgX - plotLeft) / (plotRight - plotLeft)) * 1440
        )
      )
    );

    const glucose =
      glucoseMin +
      ((plotBottom - svgY) / (plotBottom - plotTop)) *
        (glucoseMax - glucoseMin);

    const nearestBin = agpBins.reduce<AGPProfileBin | null>(
      (nearest, bin) => {
        if (!nearest) return bin;

        return Math.abs(bin.minuteOfDay - minute) <
          Math.abs(nearest.minuteOfDay - minute)
          ? bin
          : nearest;
      },
      null
    );

    // Resolve the most specific region first.
    if (glucose < 70) return 'below';
    if (glucose > 180) return 'above';

    if (
      nearestBin &&
      Math.abs(nearestBin.minuteOfDay - minute) <= 15 &&
      Math.abs(glucose - nearestBin.median) <= 5
    ) {
      return 'median';
    }

    if (
      nearestBin &&
      Math.abs(nearestBin.minuteOfDay - minute) <= 15 &&
      glucose >= nearestBin.p25 &&
      glucose <= nearestBin.p75
    ) {
      return 'p25-p75';
    }

    if (
      nearestBin &&
      Math.abs(nearestBin.minuteOfDay - minute) <= 15 &&
      glucose >= nearestBin.p10 &&
      glucose <= nearestBin.p90
    ) {
      return 'p10-p90';
    }

    return 'target';
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

  const isAgpRegionActive = (
    region: Exclude<AgpInteractiveRegion, null>
  ) => {
    return (
      hoveredAgpRegion === region ||
      (hoveredAgpRegion === null &&
        selectedAgpRegion === region)
    );
  };

  const isAgpRegionDimmed = (
    region: Exclude<AgpInteractiveRegion, null>
  ) => {
    const activeRegion =
      hoveredAgpRegion ?? selectedAgpRegion;

    return activeRegion !== null && activeRegion !== region;
  };

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
            {clinicalValue(patient.hba1c, '%')}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Fasting glucose</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {clinicalValue(patient.fastingGlucose)} <span className="text-xs font-normal text-slate-500">mmol/L</span>
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">BMI</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {clinicalValue(patient.bmi)}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Risk assessment</p>
          <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${Number.isFinite(patient.currentRiskPct) ? 'text-[#b91c1c]' : 'text-slate-500'}`}>
            {Number.isFinite(patient.currentRiskPct) ? clinicalValue(patient.currentRiskPct, '%') : 'Not assessed'}
          </p>
        </div>
      </div>

      {/* 3. AGP Metrics Strip (If continuous CGM telemetry exists) */}
      {hasCGM && cgmSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4">
          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Time In Range (TIR)</span>
            <p className="text-xl font-bold text-emerald-600">{clinicalValue(cgmSummary.timeInRangePct, '%')}</p>
            <span className="text-[10px] text-slate-400">70–180 mg/dL target</span>
          </div>

          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Time Above Range</span>
            <p className="text-xl font-bold text-rose-600">{clinicalValue(cgmSummary.timeAboveRangePct, '%')}</p>
            <span className="text-[10px] text-slate-400">&gt; 180 mg/dL</span>
          </div>

          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Time Below Range</span>
            <p className="text-xl font-bold text-amber-600">{clinicalValue(cgmSummary.timeBelowRangePct, '%')}</p>
            <span className="text-[10px] text-slate-400">&lt; 70 mg/dL</span>
          </div>

          <div className="space-y-0.5 border-r border-slate-100 pr-3">
            <span className="text-[11px] text-slate-500 font-medium">Mean CGM Glucose</span>
            <p className="text-xl font-bold text-slate-900">{clinicalValue(cgmSummary.meanGlucose)} <span className="text-xs font-normal text-slate-500">mg/dL</span></p>
            <span className="text-[10px] text-slate-400">{(cgmSummary.meanGlucose / 18.0182).toFixed(1)} mmol/L</span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-500 font-medium">Glycemic Variability</span>
            <p className="text-xl font-bold text-slate-800">{clinicalValue(cgmSummary.cvPct, '%')} <span className="text-xs font-normal text-slate-500">CV</span></p>
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
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {agpRangeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="relative flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-slate-500">
                    Select CGM date
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSingleDay) {
                        setCalendarMonth(
                          new Date(`${selectedSingleDay}T12:00:00`)
                        );
                      }
                      setIsCalendarOpen((open) => !open);
                    }}
                    disabled={availableDateKeys.length === 0}
                    aria-label="Choose CGM date"
                    aria-expanded={isCalendarOpen}
                    className="flex min-w-[190px] items-center justify-between gap-3
                      rounded-lg border border-slate-200 bg-white px-3 py-2.5
                      text-left text-xs font-semibold text-slate-700 shadow-sm
                      transition hover:border-blue-300 hover:bg-blue-50/30
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" />

                      <span>
                        {selectedSingleDay
                          ? new Date(
                              `${selectedSingleDay}T12:00:00`
                            ).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Choose a date'}
                      </span>
                    </span>

                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-slate-400
                        transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isCalendarOpen && (
                    <div
                      className="absolute right-0 top-full z-[100] mt-2
                        w-[300px] rounded-xl border border-slate-200
                        bg-white p-3 shadow-xl"
                    >
                      {/* Custom month navigation */}
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          aria-label="Previous month"
                          onClick={() => {
                            setCalendarMonth((current) =>
                              new Date(
                                current.getFullYear(),
                                current.getMonth() - 1,
                                1,
                                12
                              )
                            );
                          }}
                          className="flex h-8 w-8 items-center justify-center
                            rounded-lg border border-slate-200 text-slate-600
                            transition hover:bg-blue-50 hover:text-blue-600
                            focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        <span className="text-sm font-semibold text-slate-800">
                          {calendarMonth.toLocaleDateString(undefined, {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>

                        <button
                          type="button"
                          aria-label="Next month"
                          onClick={() => {
                            setCalendarMonth((current) =>
                              new Date(
                                current.getFullYear(),
                                current.getMonth() + 1,
                                1,
                                12
                              )
                            );
                          }}
                          className="flex h-8 w-8 items-center justify-center
                            rounded-lg border border-slate-200 text-slate-600
                            transition hover:bg-blue-50 hover:text-blue-600
                            focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      <DayPicker
                        mode="single"
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        selected={
                          selectedSingleDay
                            ? new Date(`${selectedSingleDay}T12:00:00`)
                            : undefined
                        }
                        onSelect={(date) => {
                          if (!date) return;

                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const dateKey = `${year}-${month}-${day}`;

                          // Only select dates that have actual CGM readings.
                          if (!availableDateKeys.includes(dateKey)) return;

                          setSelectedSingleDay(dateKey);
                          setCalendarMonth(
                            new Date(`${dateKey}T12:00:00`)
                          );
                          setIsCalendarOpen(false);
                          setHoveredMinute(null);
                        }}
                        disabled={(date) => {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const dateKey = `${year}-${month}-${day}`;

                          // Keep invalid dates visible, but make them unclickable.
                          return !availableDateKeys.includes(dateKey);
                        }}
                        showOutsideDays
                        fixedWeeks
                        hideNavigation
                        className="mx-auto"
                        classNames={{
                          month_caption:
                            'hidden',
                          weekdays:
                            'flex',
                          weekday:
                            'w-9 text-center text-[11px] font-medium text-slate-400',
                          week:
                            'mt-1 flex w-full',
                          day:
                            'flex h-9 w-9 items-center justify-center text-xs',
                          day_button:
                            'h-8 w-8 rounded-lg text-xs transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
                          selected:
                            '[&>button]:bg-blue-600 [&>button]:font-bold [&>button]:text-white [&>button]:hover:bg-blue-700',
                          disabled:
                            'text-slate-300 [&>button]:cursor-not-allowed [&>button]:text-slate-300 [&>button]:opacity-50 [&>button]:hover:bg-transparent',
                          outside:
                            'text-slate-300',
                          today:
                            'font-bold [&>button]:ring-1 [&>button]:ring-blue-300',
                        }}
                      />

                      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                        <span className="h-2 w-2 rounded-full bg-blue-600" />
                        <p className="text-[10px] text-slate-500">
                          Selected date
                        </p>

                        <span className="ml-auto h-2 w-2 rounded-full bg-slate-300" />
                        <p className="text-[10px] text-slate-500">
                          No CGM data
                        </p>
                      </div>
                    </div>
                  )}
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
                  onChange={(e) => {
                    const nextView = e.target.value as 'range' | 'day';

                    setSelectedAgpView(nextView);
                    setIsCalendarOpen(false);
                    setHoveredMinute(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {selectedAgpView === 'range' ? (
                <>
                  {(
                    [
                      {
                        id: 'target',
                        label: 'Target range: 70–180 mg/dL',
                        swatch: 'bg-emerald-100 border border-emerald-400',
                      },
                      {
                        id: 'p10-p90',
                        label: '10th–90th percentile',
                        swatch: 'bg-green-300 border border-green-400',
                      },
                      {
                        id: 'p25-p75',
                        label: '25th–75th percentile',
                        swatch: 'bg-green-700',
                      },
                      {
                        id: 'median',
                        label: 'Median glucose',
                        swatch: 'h-0.5 bg-blue-700',
                      },
                      {
                        id: 'below',
                        label: 'Below target (<70 mg/dL)',
                        swatch: 'bg-orange-500',
                      },
                      {
                        id: 'above',
                        label: 'Above target (>180 mg/dL)',
                        swatch: 'bg-red-500',
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selectedAgpRegion === item.id}
                      onClick={() => toggleAgpRegion(item.id)}
                      className={`inline-flex items-center gap-2 rounded-md px-1 py-1
                      text-left transition-colors duration-150
                      focus:outline-none focus-visible:outline-none focus-visible:ring-0
                      ${
                        selectedAgpRegion === item.id
                          ? 'font-bold text-slate-900'
                          : 'font-normal text-slate-600 hover:font-bold hover:text-slate-900'
                      }`}
                    >
                      <span
                        className={`w-3 h-3 shrink-0 rounded-sm ${item.swatch}`}
                      />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" />
                    Target range: 70–180 mg/dL
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <span className="w-5 h-0.5 bg-blue-600" />
                    Actual CGM glucose readings
                  </span>
                </>
              )}
            </div>

            {selectedAgpView === 'range' ? (
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                role="img"
                aria-label="Ambulatory glucose profile showing median glucose and glucose percentile bands by time of day"
                onMouseMove={handleChartMouseMove}
                onMouseLeave={() => {
                  setHoveredMinute(null);
                  setHoveredAgpRegion(null);
                }}
                onClick={handleAgpChartClick}
                className="w-full min-w-[620px] h-auto cursor-pointer"
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

                  <clipPath id="below-target-clip">
                    <rect
                      x={plotLeft}
                      y={yForGlucose(70)}
                      width={plotRight - plotLeft}
                      height={plotBottom - yForGlucose(70)}
                    />
                  </clipPath>

                  <clipPath id="above-target-clip">
                    <rect
                      x={plotLeft}
                      y={plotTop}
                      width={plotRight - plotLeft}
                      height={yForGlucose(180) - plotTop}
                    />
                  </clipPath>
                </defs>

                {/* Interactive target range: 70–180 mg/dL */}
                <g
                  clipPath="url(#agp-plot-clip)"
                  pointerEvents="all"
                >
                  {(() => {
                    const active = isAgpRegionActive('target');
                    const dimmed = isAgpRegionDimmed('target');

                    return (
                      <rect
                        x={plotLeft}
                        y={yForGlucose(180)}
                        width={plotRight - plotLeft}
                        height={yForGlucose(70) - yForGlucose(180)}
                        fill="#34D399"
                        fillOpacity={active ? 0.42 : 0.12}
                        stroke={active ? '#047857' : 'none'}
                        strokeWidth={active ? 2 : 0}
                        opacity={dimmed ? 0.5 : 1}
                        pointerEvents="none"
                      />
                    );
                  })()}
                </g>

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
                  {agpSegments.map((segment, index) => {
                    const makeBandPolygon = (
                      lowerKey: 'p10' | 'p25',
                      upperKey: 'p75' | 'p90'
                    ) => {
                      if (segment.length < 2) return '';

                      const upper = segment.map(
                        (bin) =>
                          `${xForMinute(bin.minuteOfDay)},${yForGlucose(bin[upperKey])}`
                      );

                      const lower = [...segment].reverse().map(
                        (bin) =>
                          `${xForMinute(bin.minuteOfDay)},${yForGlucose(bin[lowerKey])}`
                      );

                      return `M ${upper.join(' L ')} L ${lower.join(' L ')} Z`;
                    };

                    const outerPath = makeBandPolygon('p10', 'p90');
                    const innerPath = makeBandPolygon('p25', 'p75');

                    const medianPath = segment
                      .map((bin, i) => {
                        const command = i === 0 ? 'M' : 'L';

                        return (
                          `${command} ${xForMinute(bin.minuteOfDay)} ` +
                          `${yForGlucose(bin.median)}`
                        );
                      })
                      .join(' ');

                    return (
                      <g key={`agp-segment-${index}`}>
                        <path
                          data-agp-region="p10-p90"
                          d={outerPath}
                          fill="#86EFAC"
                          fillOpacity={isAgpRegionActive("p10-p90") ? 0.9 : 0.65}
                          opacity={isAgpRegionDimmed("p10-p90") ? 0.2 : 1}
                          stroke={isAgpRegionActive("p10-p90") ? "#15803D" : "none"}
                          strokeWidth={isAgpRegionActive("p10-p90") ? 2.5 : 0}
                          style={{
                            transition:
                              "stroke 500ms ease, stroke-width 500ms ease, opacity 500ms ease, fill-opacity 500ms ease",
                          }}
                        />

                        <path
                          data-agp-region="below"
                          d={outerPath}
                          fill="#FED7AA"
                          clipPath="url(#below-target-clip)"
                          fillOpacity={
                            isAgpRegionActive('below') ? 1 : 0.9
                          }
                          opacity={
                            isAgpRegionDimmed('below') ? 0.2 : 1
                          }
                          stroke={
                            isAgpRegionActive('below') ? '#9A3412' : 'none'
                          }
                          strokeWidth={
                            isAgpRegionActive('below') ? 2 : 0
                          }
                          style={{
                            transition:
                              "stroke 500ms ease, stroke-width 500ms ease, opacity 500ms ease, fill-opacity 500ms ease",
                          }}
                        />

                        <path
                          data-agp-region="above"
                          d={outerPath}
                          fill="#FECACA"
                          clipPath="url(#above-target-clip)"
                          fillOpacity={
                            isAgpRegionActive('above') ? 1 : 0.9
                          }
                          opacity={
                            isAgpRegionDimmed('above') ? 0.15 : 1
                          }
                          stroke={
                            isAgpRegionActive('above') ? '#991B1B' : 'none'
                          }
                          strokeWidth={
                            isAgpRegionActive('above') ? 2 : 0
                          }
                          style={{
                            transition:
                              "stroke 500ms ease, stroke-width 500ms ease, opacity 500ms ease, fill-opacity 500ms ease",
                          }}
                        />

                        <path
                          data-agp-region="p25-p75"
                          d={innerPath}
                          fill="#15803D"
                          fillOpacity={
                            isAgpRegionActive('p25-p75') ? 0.85 : 0.45
                          }
                          opacity={
                            isAgpRegionDimmed('p25-p75') ? 0.2 : 1
                          }
                          stroke={
                            isAgpRegionActive('p25-p75') ? '#14532D' : 'none'
                          }
                          strokeWidth={
                            isAgpRegionActive('p25-p75') ? 2.5 : 0
                          }
                          style={{
                            transition:
                              "stroke 500ms ease, stroke-width 500ms ease, opacity 500ms ease, fill-opacity 500ms ease",
                          }}
                        />

                        <path
                          data-agp-region="below"
                          d={innerPath}
                          fill="#F97316"
                          clipPath="url(#below-target-clip)"
                          fillOpacity={
                            isAgpRegionActive('below') ? 1 : 0.9
                          }
                          opacity={
                            isAgpRegionDimmed('below') ? 0.2 : 1
                          }
                          stroke={
                            isAgpRegionActive('below') ? '#9A3412' : 'none'
                          }
                          strokeWidth={
                            isAgpRegionActive('below') ? 2 : 0
                          }
                          style={{
                            transition:
                              "stroke 500ms ease, stroke-width 500ms ease, opacity 500ms ease, fill-opacity 500ms ease",
                          }}
                        />

                        <path
                          data-agp-region="above"
                          d={innerPath}
                          fill="#DC2626"
                          clipPath="url(#above-target-clip)"
                          fillOpacity={
                            isAgpRegionActive('above') ? 1 : 0.9
                          }
                          opacity={
                            isAgpRegionDimmed('above') ? 0.15 : 1
                          }
                          stroke={
                            isAgpRegionActive('above') ? '#991B1B' : 'none'
                          }
                          strokeWidth={
                            isAgpRegionActive('above') ? 2 : 0
                          }
                          style={{
                            transition:
                              "stroke 500ms ease, stroke-width 500ms ease, opacity 500ms ease, fill-opacity 500ms ease",
                          }}
                        />

                        <path
                          data-agp-region="median"
                          d={medianPath}
                          fill="none"
                          stroke="#1D4ED8"
                          strokeWidth={
                            isAgpRegionActive('median') ? 4.5 : 2.4
                          }
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={
                            isAgpRegionDimmed('median') ? 0.2 : 1
                          }
                          style={{
                            transition:
                              "stroke 500ms ease, stroke-width 500ms ease, opacity 500ms ease, fill-opacity 500ms ease",
                          }}
                        />
                      </g>
                    );
                  })}
                </g>

                {/* Hover crosshair and tooltip */}
                  {hoveredMinute !== null && (
                    <g pointerEvents="none">
                      {(() => {
                        const x = xForMinute(hoveredMinute);
                        const tooltipWidth = 218;
                        const tooltipHeight = selectedAgpRegion === null ? 116 : 88;

                        // Keep the tooltip inside the chart boundaries.
                        const tooltipX = Math.max(
                          plotLeft,
                          Math.min(plotRight - tooltipWidth, x + 12)
                        );

                        const tooltipY = plotTop + 8;

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
                            
                            {/* Region-aware tooltip content */}
                            <text
                              x={tooltipX + 12}
                              y={tooltipY + 19}
                              fontSize="11"
                              fontWeight="700"
                              fill="#111827"
                            >
                              {formatHoverTime(hoveredMinute)}
                            </text>

                            {hasNearbyBin ? (
                              <>
                                {selectedAgpRegion === null ? (
                                  <>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 39}
                                      fontSize="10"
                                      fill="#374151"
                                    >
                                      Median: {hoveredAgpBin!.median.toFixed(1)} mg/dL
                                    </text>

                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 57}
                                      fontSize="10"
                                      fill="#374151"
                                    >
                                      P25–P75: {hoveredAgpBin!.p25.toFixed(1)}
                                      {' – '}
                                      {hoveredAgpBin!.p75.toFixed(1)} mg/dL
                                    </text>

                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 75}
                                      fontSize="10"
                                      fill="#374151"
                                    >
                                      P10–P90: {hoveredAgpBin!.p10.toFixed(1)}
                                      {' – '}
                                      {hoveredAgpBin!.p90.toFixed(1)} mg/dL
                                    </text>

                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 96}
                                      fontSize="10"
                                      fontWeight="600"
                                      fill={
                                        hoveredAgpBin!.median < 70
                                          ? '#C2410C'
                                          : hoveredAgpBin!.median > 180
                                          ? '#B91C1C'
                                          : '#047857'
                                      }
                                    >
                                      {hoveredAgpBin!.median < 70
                                        ? 'Median below target'
                                        : hoveredAgpBin!.median > 180
                                        ? 'Median above target'
                                        : 'Median within target'}
                                    </text>
                                  </>
                                ) : selectedAgpRegion === 'p10-p90' ? (
                                  <>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 41}
                                      fontSize="10"
                                      fill="#166534"
                                    >
                                      P10: {hoveredAgpBin!.p10.toFixed(1)} mg/dL
                                    </text>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 60}
                                      fontSize="10"
                                      fill="#166534"
                                    >
                                      P90: {hoveredAgpBin!.p90.toFixed(1)} mg/dL
                                    </text>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 77}
                                      fontSize="9"
                                      fill="#6B7280"
                                    >
                                      Central 80% of readings
                                    </text>
                                  </>
                                ) : selectedAgpRegion === 'p25-p75' ? (
                                  <>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 41}
                                      fontSize="10"
                                      fill="#166534"
                                    >
                                      P25: {hoveredAgpBin!.p25.toFixed(1)} mg/dL
                                    </text>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 60}
                                      fontSize="10"
                                      fill="#166534"
                                    >
                                      P75: {hoveredAgpBin!.p75.toFixed(1)} mg/dL
                                    </text>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 77}
                                      fontSize="9"
                                      fill="#6B7280"
                                    >
                                      Central 50% of readings
                                    </text>
                                  </>
                                ) : selectedAgpRegion === 'median' ? (
                                  <>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 45}
                                      fontSize="14"
                                      fontWeight="700"
                                      fill="#1D4ED8"
                                    >
                                      {hoveredAgpBin!.median.toFixed(1)} mg/dL
                                    </text>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 65}
                                      fontSize="9"
                                      fill="#6B7280"
                                    >
                                      Median glucose
                                    </text>
                                  </>
                                ) : selectedAgpRegion === 'target' ? (
                                  <>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 42}
                                      fontSize="10"
                                      fontWeight="600"
                                      fill="#047857"
                                    >
                                      Target: 70–180 mg/dL
                                    </text>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 61}
                                      fontSize="10"
                                      fill="#374151"
                                    >
                                      Median: {hoveredAgpBin!.median.toFixed(1)} mg/dL
                                    </text>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 78}
                                      fontSize="9"
                                      fill="#6B7280"
                                    >
                                      {hoveredAgpBin!.median >= 70 &&
                                      hoveredAgpBin!.median <= 180
                                        ? 'Median within target'
                                        : 'Median outside target'}
                                    </text>
                                  </>
                                ) : (
                                  <>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 43}
                                      fontSize="11"
                                      fontWeight="600"
                                      fill={selectedAgpRegion === 'above' ? '#B91C1C' : '#C2410C'}
                                    >
                                      {selectedAgpRegion === 'above'
                                        ? 'Above 180 mg/dL'
                                        : 'Below 70 mg/dL'}
                                    </text>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 62}
                                      fontSize="10"
                                      fill="#374151"
                                    >
                                      P10–P90: {hoveredAgpBin!.p10.toFixed(1)}
                                      {' – '}
                                      {hoveredAgpBin!.p90.toFixed(1)}
                                    </text>
                                    <text
                                      x={tooltipX + 12}
                                      y={tooltipY + 78}
                                      fontSize="9"
                                      fill="#6B7280"
                                    >
                                      Threshold: {selectedAgpRegion === 'above' ? '>180' : '<70'} mg/dL
                                    </text>
                                  </>
                                )}
                              </>
                            ) : (
                              <text
                                x={tooltipX + 12}
                                y={tooltipY + 45}
                                fontSize="10"
                                fill="#6B7280"
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
                : `This patient has no continuous CGM readings. Recorded fasting glucose: ${clinicalValue(patient.fastingGlucose, 'mmol/L')}; HbA1c: ${clinicalValue(patient.hba1c, '%')}. An AGP cannot be calculated without sensor readings.`}
            </p>

            {!hasCGM && allowPatientSelection && (
              <button
                onClick={() => onNavigate("doctor_patients")}
                className="mt-4 px-3 py-2 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold transition"
              >
                Switch to another patient
              </button>
            )}
          </div>
        )}
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
                <option>All available days</option>
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
                    {clinicalValue(item.mean)}
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
                      title={`${item.dayLabel}: Mean ${item.mean} mg/dL, TIR ${clinicalValue(item.tir, '%')}`}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 font-semibold truncate max-w-[50px] text-center">
                    D{item.dayNumber}
                  </span>
                  <span className={`text-[9px] font-bold ${isOptimal ? 'text-emerald-600' : isModerate ? 'text-blue-600' : 'text-rose-600'}`}>
                    {clinicalValue(item.tir, '%')}
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
          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-between text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-4">
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
