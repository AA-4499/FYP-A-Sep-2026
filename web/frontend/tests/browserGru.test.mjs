import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('retired model UI and browser inference entry points are removed',()=>{
 const ui=readFileSync(new URL('../src/components/RiskSimulationView.tsx',import.meta.url),'utf8');
 assert.ok(ui.includes('ConditionalSimulatorPanel'));
 assert.equal(/ConditionalForecastPanel|PhysiologyLab|Previous GRU|setTab|ForecastPanel/.test(ui),false);
 const transport=readFileSync(new URL('../src/lib/forecast.ts',import.meta.url),'utf8');
 assert.equal(transport.includes('import("./browserForecast")'),false);
 assert.ok(transport.includes('previous model is retired'));
});
