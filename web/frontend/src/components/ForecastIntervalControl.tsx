import React from 'react';
import type { ForecastInterval } from '../lib/forecastSampling';

export function ForecastIntervalControl({value,onChange}:{value:ForecastInterval;onChange:(value:ForecastInterval)=>void}) {
  return <label className="flex items-center gap-2 text-xs text-slate-600">Show every<select aria-label="Forecast display interval" value={value} onChange={e=>onChange(Number(e.target.value) as ForecastInterval)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">{[15,30,60].map(v=><option key={v} value={v}>{v} minutes</option>)}</select><span>up to 6 hours</span></label>;
}
