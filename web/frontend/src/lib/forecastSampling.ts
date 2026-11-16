import type { ForecastPoint } from './forecast';

export type ForecastInterval = 15 | 30 | 60;
export function sampleForecast(points: ForecastPoint[], origin: string, interval: ForecastInterval): ForecastPoint[] {
  const start=Date.parse(origin);
  if(!Number.isFinite(start)||![15,30,60].includes(interval)) throw Error('Invalid forecast time or display interval.');
  return points.filter(p=>{const offset=(Date.parse(p.timestamp)-start)/60000;return offset>=0&&offset<=360&&offset%interval===0;});
}
