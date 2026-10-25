// Start npm run dev on port 3000, then run npm run test:navigation.
// Uses headless Chrome; set CHROME_PATH if Chrome is installed elsewhere.
(async () => {
  const fs = require("fs"),
    path = require("path"),
    cp = require("child_process");
  const out = path.resolve(__dirname, "../.ui-check");
  fs.mkdirSync(out, { recursive: true });
  const browser = cp.spawn(
    process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--disable-default-apps",
      "--disable-background-networking",
      "--remote-debugging-port=9334",
      "--user-data-dir=" + path.join(out, "navigation-chrome-profile"),
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  let socket;
  try {
    let target;
    for (let i = 0; i < 60; i++) {
      try {
        target = await (
          await fetch("http://127.0.0.1:9334/json/new?about:blank", {
            method: "PUT",
          })
        ).json();
        break;
      } catch {
        await delay(300);
      }
    }
    if (!target) throw Error("Chrome debugging target did not start");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    });
    let seq = 0;
    const pending = new Map(),
      exceptions = [];
    socket.onmessage = ({ data }) => {
      const m = JSON.parse(data);
      if (m.id) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) p.reject(Error(JSON.stringify(m.error)));
        else p.resolve(m.result);
      } else if (m.method === "Runtime.exceptionThrown")
        exceptions.push(
          m.params.exceptionDetails.exception?.description ||
            m.params.exceptionDetails.text,
        );
    };
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    const assert = (ok, message) => {
      if (!ok) throw Error(message);
    };
    const ready = async (text) => {
      for (let i = 0; i < 90; i++) {
        if (
          await evaluate(
            "document.body.innerText.includes(" + JSON.stringify(text) + ")",
          )
        )
          return;
        await delay(250);
      }
      throw Error("Timed out waiting for " + text);
    };
    const screenshot = async (name) => {
      const metrics = await send("Page.getLayoutMetrics");
      const size = metrics.cssContentSize;
      const shot = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 },
      });
      fs.writeFileSync(path.join(out, name), Buffer.from(shot.data, "base64"));
    };
    const chartScreenshot = async (name) => {
      await evaluate(
        `document.querySelector('[data-testid="prediction-panel"]').scrollIntoView({block:'center'})`,
      );
      await delay(200);
      const shot = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      fs.writeFileSync(path.join(out, name), Buffer.from(shot.data, "base64"));
    };
    await send("Page.enable");
    await send("Page.bringToFront");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false,
    });

    fs.writeFileSync(
      path.join(out, "navigation-fixture.html"),
      '<meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="root"></div><script type="module" src="/.ui-check/navigation-fixture.tsx"></script>',
    );
    fs.writeFileSync(
      path.join(out, "navigation-fixture.tsx"),
      `
 import React from 'react';
 import { createRoot } from 'react-dom/client';
 import { App } from '../src/App';
 import { getSupabaseClient } from '../src/lib/supabase';
 import '../src/index.css';
 const parameters = new URLSearchParams(location.search);
 const empty = parameters.has('empty');
 const denied = parameters.has('denied');
 const patientLogin = parameters.has('patient');
 const summaries = empty ? [] : [
   {'Patient Number':'test-a','Age (years)':55,'HbA1c (mmol/mol)':66,'Weight (kg)':70,'Fasting Plasma Glucose (mg/dl)':130,'Type of Diabetes':'T2D'},
   {'Patient Number':'test-b','Age (years)':null,'HbA1c (mmol/mol)':null},
 ];
 const details = empty ? [] : Array.from({length:96}, (_,i) => ({id:i,'Patient Number':'test-a',Date:new Date(Date.UTC(2020,0,1+Math.floor(i/48),0,(i%48)*15)).toISOString(),'CGM (mg / dl)':140+100*Math.sin((i%48)/6)+20*Math.floor(i/48)}));
 if(parameters.has('repo')) { summaries[0]['Patient Number']='2000_0_20201230'; details.forEach(row=>row['Patient Number']='2000_0_20201230'); }
 const client = getSupabaseClient()!;
 const user = {id:'browser-patient',email:'patient@example.test',email_confirmed_at:'2026-10-24',app_metadata:{role:'patient'}};
 client.auth.getUser = async () => ({data:{user},error:null}) as any;
 client.auth.getSession = async () => ({data:{session:null},error:null}) as any;
 client.auth.onAuthStateChange = (callback:any) => {setTimeout(()=>callback('INITIAL_SESSION',patientLogin ? {user} : null),0);return {data:{subscription:{unsubscribe(){}}}};};
 client.rpc = async () => ({data:{profile:{id:user.id,full_name:'Test Patient',patient_id:'test-a'},summary:summaries[0],readings:[]},error:null}) as any;
 client.from = (table:string) => {
   let selected:string|undefined;
   const query:any={select:()=>query,order:()=>query,eq:(_key:string,value:string)=>{selected=value;return query;},range:async(start:number,end:number)=>{
     if(denied) return {data:null,count:null,error:{message:'Database access denied'}};
     const rows=(table==='patient_summary'?summaries:details).filter(row=>selected===undefined||row['Patient Number']===selected);
     return {data:rows.slice(start,Math.min(end+1,start+17)),count:rows.length,error:null};
   }};return query;
 };
 createRoot(document.getElementById('root')!).render(<App/>);
 `,
    );
    const click = async (label, scope = "document") => {
      const position = await evaluate(
        `(()=>{const b=[...${scope}.querySelectorAll('button')].find(b=>b.textContent.replaceAll(String.fromCharCode(0x25aa),'').trim()===${JSON.stringify(label)});if(!b)throw Error('Missing '+${JSON.stringify(label)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
      );
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        ...position,
        button: "left",
        clickCount: 1,
      });
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        ...position,
        button: "left",
        clickCount: 1,
      });
      await delay(200);
    };
    const addScenarioEvent = async (kind, fields) => {
      await evaluate(
        `(() => { const select = document.querySelector('[aria-label="Add scenario event"]'); select.value = ${JSON.stringify(kind)}; select.dispatchEvent(new Event('change', {bubbles:true})); })()`,
      );
      await delay(100);
      const index = await evaluate(
        `document.querySelectorAll('[data-testid="scenario-event"]').length`,
      );
      for (const [field, value] of Object.entries(fields)) {
        await evaluate(
          `(() => { const input = document.querySelector('[aria-label="Event ${index} ${field}"]'); if (!input) throw Error('Missing event field'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true})); })()`,
        );
      }
      await delay(100);
    };
    const eventClock = async (minutes) =>
      evaluate(
        `(() => { const min = document.querySelector('input[type="datetime-local"]').min; return new Date(Date.parse(min + 'Z') + (${minutes} - 1) * 60000).toISOString().slice(0,16); })()`,
      );
    const expectPage = async (label, text) => {
      await click(label, "document.querySelector('aside')");
      await ready(text);
      assert(!exceptions.length, exceptions.join("\n"));
      console.log("PASS: " + label);
    };
    const open = async (query) => {
      await send("Page.navigate", {
        url: "http://127.0.0.1:3000/.ui-check/navigation-fixture.html" + query,
      });
      if (!query.includes("patient")) {
        await ready("Welcome back");
        await click("Explore database records");
      }
    };
    await open("");
    await ready("2 accessible records");
    for (const [label, text] of [
      ["Patient management", "Patient List & Clinical Profiles"],
      ["Health monitoring", "Ambulatory Glucose Profile (AGP)"],
      ["Digital twin", "Physiological evidence map"],
      ["Knowledge graph", "Patient and medical concept map"],
      ["Reports", "Complete recorded summary"],
      ["Settings", "Workspace settings"],
    ])
      await expectPage(label, text);
    await expectPage("Health monitoring", "Ambulatory Glucose Profile (AGP)");
    const assertMonitoringColors = async () => {
      assert(
        await evaluate(`(() => {
        const svg = document.querySelector('svg[aria-label="Ambulatory glucose profile showing median glucose and glucose percentile bands by time of day"]');
        return svg && ['#86EFAC','#15803D','#F97316','#DC2626'].every(color => [...svg.querySelectorAll('path')].some(path => path.getAttribute('fill') === color && !!path.getAttribute('d')));
      })()`),
        "Monitoring lost its green/orange/red percentile zones",
      );
      assert(
        !(await evaluate(
          "document.querySelector('main').innerText.includes('NaN')",
        )),
        "Missing measurements rendered NaN",
      );
    };
    await assertMonitoringColors();
    await screenshot("restored-monitoring-risk-zones.png");
    await evaluate(
      `(() => { const select = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'day')); select.value = 'day'; select.dispatchEvent(new Event('change', {bubbles:true})); })()`,
    );
    await ready("Continuous Glucose Monitoring (CGM)");
    await evaluate(
      `document.querySelector('[aria-label="Choose CGM date"]').click()`,
    );
    assert(
      await evaluate("document.querySelector('.rdp-root') !== null"),
      "Original monitoring date picker is missing",
    );
    await expectPage("Knowledge graph", "Patient and medical concept map");
    assert(
      await evaluate("document.querySelectorAll('canvas').length > 0"),
      "KnowledgeGraph branch canvas did not render",
    );
    await screenshot("restored-knowledge-graph-desktop.png");
    await evaluate(
      `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Recommendation review')).click()`,
    );
    await ready("AI recommendation interface preview");
    await click("Approve");
    await click("Share with patient");
    await ready("Visible in patient view");
    await click("Preview patient view");
    await ready("Continuous CGM Waveform");
    assert(
      await evaluate(
        `document.querySelector('[aria-label="Compact ambulatory glucose profile with percentile bands and median glucose"]') !== null`,
      ),
      "Jody compact AGP did not render",
    );
    await screenshot("restored-jody-patient-home.png");
    await expectPage(
      "My recommendations",
      "Review the glucose monitoring plan",
    );
    await click("Doctor dashboard", "document.querySelector('aside')");
    await expectPage("Patient management", "Patient List & Clinical Profiles");
    await evaluate(
      `Array.from(document.querySelectorAll('tbody button')).find(b => b.textContent.includes('Patient test-b')).click()`,
    );
    await expectPage("Knowledge graph", "Patient and medical concept map");
    await click("Preview patient view");
    await expectPage("My recommendations", "No recommendations shared yet");
    // A newly opened workspace starts a new prototype recommendation session.
    await open("");
    await ready("2 accessible records");
    await expectPage("Prediction lab", "CGM forecast");
    assert(
      await evaluate(
        `document.querySelector('[aria-label="Data source"]').value==='browser'`,
      ),
      "Temporary default did not use the actual browser GRU",
    );
    await click("Physiology lab");
    await ready("Glucose response and recovery");
    await addScenarioEvent("meal", {
      description: "Mixed meal",
      amount: "250",
      carbohydrate: "45",
    });
    const physiologyTime = await eventClock(30);
    await evaluate(
      `(() => { const input=document.querySelector('[aria-label="Event 1 time"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(physiologyTime)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
    );
    await click("Run what-if simulation");
    await ready("Applied schedule (UTC)");
    assert(
      await evaluate(
        `document.querySelectorAll('.recharts-line-curve').length>=4`,
      ),
      "Physiology traces missing",
    );
    await evaluate(
      `document.querySelector('[aria-label="Doctor workspace menu"]').click()`,
    );
    await click("Switch to Patient workspace");
    for (const [label, text] of [
      ["Home", "Continuous CGM Waveform"],
      ["My profile", "Complete recorded summary"],
      ["My health", "Ambulatory Glucose Profile (AGP)"],
      ["My digital twin", "Physiological evidence map"],
      ["Risk prediction & what-if", "CGM forecast"],
      ["My recommendations", "No recommendations shared yet"],
      ["Reports", "Complete recorded summary"],
    ])
      await expectPage(label, text);
    await click("Doctor dashboard", "document.querySelector('aside')");
    await ready("A clearer view of your cohort.");
    await open("?empty");
    await ready("0 accessible records");
    for (const label of [
      "Patient management",
      "Health monitoring",
      "Digital twin",
      "Knowledge graph",
      "Reports",
      "Prediction lab",
    ])
      await expectPage(label, "No patient records available");
    await expectPage("Settings", "Workspace settings");
    await open("?denied");
    await ready("Database access denied");
    assert(
      !(await evaluate(`document.body.innerText.includes('test-a')`)),
      "Failed query substituted records",
    );
    await open("?patient");
    await ready("Test Patient");
    await ready("Continuous CGM Waveform");
    for (const [label, text] of [
      ["My health", "Ambulatory Glucose Profile (AGP)"],
      ["My digital twin", "Physiological evidence map"],
      ["Reports", "Complete recorded summary"],
      ["Risk prediction & what-if", "CGM forecast"],
    ])
      await expectPage(label, text);
    assert(
      !(await evaluate(
        `document.body.innerText.includes('test-b') || document.body.innerText.includes('Doctor dashboard')`,
      )),
      "Patient login leaked cohort navigation",
    );
    await expectPage("My health", "Ambulatory Glucose Profile (AGP)");
    await assertMonitoringColors();
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await delay(400);
    assert(
      await evaluate(
        "document.documentElement.scrollWidth<=window.innerWidth+2",
      ),
      "Mobile My health horizontal overflow",
    );
    await screenshot("restored-my-health-mobile.png");
    await expectPage("Risk prediction & what-if", "CGM forecast");
    await click("Physiology lab");
    await ready("Glucose response and recovery");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await delay(500);
    assert(
      await evaluate(
        "document.documentElement.scrollWidth<=window.innerWidth+2",
      ),
      "Mobile horizontal overflow",
    );
    assert(!exceptions.length, exceptions.join("\n"));
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await open("?repo");
    await ready("2 accessible records");
    await expectPage("Prediction lab", "Repository GRU");
    await ready("Browser GRU computed successfully");
    assert(
      await evaluate(
        `document.querySelector('[aria-label="Baseline and what-if glucose prediction comparison"]').dataset.display === 'range' && document.querySelectorAll('[data-testid="prediction-panel"] .recharts-area-area').length >= 2`,
      ),
      "GRU range bands must be the initial view",
    );
    assert(
      await evaluate(
        `document.querySelector('[data-testid="range-explanation"]').innerText.includes('not a calibrated prediction interval')`,
      ),
      "Historical reference must not claim calibrated coverage",
    );
    await chartScreenshot("range-gru-desktop.png");
    assert(
      await evaluate(
        `(() => { const horizon = document.querySelector('[aria-label="Forecast horizon"]'); return horizon.value === '6' && [...horizon.options].map(o => o.value).join(',') === '6,12'; })()`,
      ),
      "Prediction lab must default to 6h and offer only 6/12h",
    );
    assert(
      await evaluate(
        `(() => { const history = document.querySelector('[data-testid="history-panel"]'); const simulator = document.querySelector('[data-testid="simulator-panel"]'); return history.tagName === 'DETAILS' && !history.open && !document.querySelector('[data-testid="history-content"]') && !!(simulator.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING); })()`,
      ),
      "Historical diagnostics must be collapsed after the simulator",
    );
    await click("Show all 24 forecast rows");
    assert(
      await evaluate(
        `document.querySelectorAll('[data-testid="forecast-values-panel"] tbody tr').length === 24`,
      ),
      "Default 6h forecast is incomplete",
    );
    await click("Show first 12 rows");
    assert(
      await evaluate(
        `document.querySelectorAll('[data-testid="forecast-values-panel"] tbody tr').length === 12`,
      ),
      "Initial six-hour forecast rows were not rendered",
    );
    assert(
      await evaluate(
        `document.querySelector('[data-testid="browser-model-notice"]').textContent.includes('not refreshed Supabase')`,
      ),
      "Repository history was not distinguished from cloud readings",
    );
    assert(
      await evaluate(
        `!document.querySelector('[data-testid="simulator-panel"] input[type="checkbox"]')`,
      ),
      "Checkbox events must be replaced by the schedule builder",
    );
    await addScenarioEvent("meal", {
      description: "Rice and vegetables",
      amount: "250",
      carbohydrate: "45",
    });
    const firstMealTime = await eventClock(60);
    await evaluate(
      `(() => { const input=document.querySelector('[aria-label="Event 1 time"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(firstMealTime)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
    );
    await click("Run what-if simulation");
    await ready("Largest curve difference");
    await ready("Physiology scenario computed");
    assert(
      await evaluate(
        `document.querySelector('[data-testid="prediction-panel"]').innerText.includes('No added events (physiology)')`,
      ),
      "Event simulation was not distinguished from the GRU",
    );
    await addScenarioEvent("insulin", {
      description: "Hypothetical rapid insulin",
      amount: "1",
      time: firstMealTime,
    });
    await addScenarioEvent("meal", {
      description: "Later snack",
      amount: "100",
      carbohydrate: "15",
      time: await eventClock(180),
    });
    await click("Run what-if simulation");
    await ready("Later snack");
    assert(
      await evaluate(
        `document.querySelector('[data-testid="scenario-result"]').innerText.includes('Hypothetical rapid insulin')`,
      ),
      "Multiple applied events were lost",
    );
    const forecastValues = await evaluate(
      `document.querySelector('[data-testid="forecast-values-panel"]').innerText`,
    );
    assert(
      await evaluate(
        `document.querySelector('[data-testid="range-explanation"]').textContent.includes('27 settings') && document.querySelectorAll('[data-testid="prediction-panel"] .recharts-area-area').length >= 4`,
      ),
      "Physiology sensitivity bands were not generated",
    );
    await click("Show centre estimates");
    assert(
      await evaluate(
        `document.querySelector('[aria-label="Baseline and what-if glucose prediction comparison"]').dataset.display === 'point'`,
      ),
      "Centre estimate view did not activate",
    );
    await click("Show range bands");
    assert(
      (await evaluate(
        `document.querySelector('[data-testid="forecast-values-panel"]').innerText`,
      )) === forecastValues,
      "Switching chart view altered values or bounds",
    );
    await chartScreenshot("range-physiology-desktop.png");
    await click("Show reference range");
    assert(
      await evaluate(
        `document.querySelector('[aria-label="Baseline and what-if glucose prediction comparison"]').dataset.scale === 'reference'`,
      ),
      "Reference-scale view did not activate",
    );
    await click("Fit forecast range");
    assert(
      await evaluate(
        `document.querySelector('[aria-label="Baseline and what-if glucose prediction comparison"]').dataset.scale === 'fit'`,
      ),
      "Focused forecast scale did not activate",
    );
    assert(
      (await evaluate(
        `document.querySelector('[data-testid="forecast-values-panel"]').innerText`,
      )) === forecastValues,
      "Axis zoom changed model values",
    );
    await evaluate(
      `document.querySelector('[data-testid="history-panel"] summary').click()`,
    );
    await ready("Model evaluation and timeline coverage");
    // The chart mounts lazily, then measures its container with ResizeObserver.
    for (let i = 0; i < 60; i++) {
      if (
        await evaluate(
          `document.querySelectorAll('[data-testid="history-content"] .recharts-line-curve').length > 0`,
        )
      )
        break;
      await delay(100);
    }
    assert(
      await evaluate(
        `document.querySelectorAll('[data-testid="history-content"] .recharts-line-curve').length > 0`,
      ),
      "Expanded historical diagnostics did not render",
    );
    await evaluate(
      `document.querySelector('[data-testid="history-panel"] summary').click()`,
    );
    assert(
      !(await evaluate(
        `document.querySelector('[data-testid="history-panel"]').open`,
      )),
      "Historical diagnostics did not collapse",
    );
    await screenshot("browser-gru-what-if.png");
    // Medicine is retained in the schedule, never converted to an invented curve.
    await addScenarioEvent("medication", {
      description: "Metformin immediate-release",
      amount: "500",
      time: await eventClock(120),
    });
    await click("Run what-if simulation");
    await ready("Incomplete scenario");
    assert(
      await evaluate(
        `document.querySelector('[data-testid="prediction-panel"]').innerText.includes('context only')`,
      ),
      "Missing visible incomplete-scenario warning",
    );
    assert(
      (await evaluate(
        `document.querySelector('[data-testid="forecast-values-panel"]').innerText`,
      )) === forecastValues,
      "Context-only medication changed the numeric curve",
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await delay(400);
    assert(
      await evaluate(
        `window.innerWidth === 390 && document.documentElement.scrollWidth <= window.innerWidth + 2`,
      ),
      "Scheduled event cards overflow the real mobile viewport",
    );
    await screenshot("scheduled-what-if-mobile.png");
    await chartScreenshot("range-physiology-mobile.png");
    await evaluate(
      `document.querySelector('[aria-label="Remove event 4"]').click()`,
    );
    await ready("Draft changes are not applied");
    await click("Run what-if simulation");
    assert(
      !(await evaluate(
        `document.querySelector('[data-testid="prediction-panel"]').innerText.includes('Incomplete scenario')`,
      )),
      "Removing a context event did not update scenario completeness",
    );
    await evaluate(
      `(() => {const select=document.querySelector('[aria-label="Forecast horizon"]');select.value='12';select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await ready("Browser GRU computed successfully");
    assert(
      await evaluate(
        `!document.querySelector('[data-testid="scenario-result"]') && !document.querySelector('[data-testid="scenario-event"]')`,
      ),
      "Changing horizon retained an obsolete scenario",
    );
    await click("Show all 48 forecast rows");
    assert(
      await evaluate(
        `document.querySelectorAll('[data-testid="forecast-values-panel"] tbody tr').length === 48`,
      ),
      "12-hour browser predictions are incomplete",
    );
    assert(
      !(await evaluate(
        `document.querySelector('main').innerText.includes('NaN') || document.querySelector('main').innerText.includes('Infinity')`,
      )),
      "Invalid browser model results",
    );
    assert(!exceptions.length, exceptions.join("\n"));
    console.log(
      "PASS: browser GRU 6/12h forecasts, collapsed diagnostics, clock-time multi-event physiology, context-only medicines, draft/reset behaviour, mobile event layout and unchanged axis values",
    );
    console.log(
      "PASS: complete paging, database failures, all navigation, Patient isolation, physiology events, and mobile layout",
    );
    await send("Browser.close");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (socket) socket.close();
    browser.kill();
    for (const file of ["navigation-fixture.html", "navigation-fixture.tsx"]) {
      const target = path.join(out, file);
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
