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
    const chartScreenshot = async (name, scrollToChart = true) => {
      await evaluate(
        scrollToChart
          ? `document.querySelector('[data-testid="prediction-panel"]').scrollIntoView({block:'center'})`
          : `window.scrollTo(0,0)`,
      );
      await delay(200);
      const shot = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      fs.writeFileSync(path.join(out, name), Buffer.from(shot.data, "base64"));
    };
    const assertSidebarPinned = async () => {
      await evaluate(`window.scrollTo(0,0)`);
      await delay(100);
      const before = await evaluate(
        `document.querySelector('[data-testid="workspace-sidebar"]').getBoundingClientRect().top`,
      );
      await evaluate(`window.scrollTo(0,650)`);
      await delay(150);
      assert(
        await evaluate(
          `(() => {const sidebar=document.querySelector('[data-testid="workspace-sidebar"]');const r=sidebar.getBoundingClientRect();return window.scrollY>100 && Math.abs(r.top-${before})<2 && r.top>=0 && r.bottom<=window.innerHeight;})()`,
        ),
        "Workspace navigation must remain inside the viewport while the page scrolls",
      );
      await evaluate(`window.scrollTo(0,0)`);
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
 const anonymous = parameters.has('anonymous') || empty;
 const recovering = parameters.has('recovery');
 const summaries = empty ? [] : [
   {'Patient Number':'test-a','Age (years)':55,'HbA1c (mmol/mol)':66,'Weight (kg)':70,'Fasting Plasma Glucose (mg/dl)':130,'Type of Diabetes':'T2D'},
   {'Patient Number':'test-b','Age (years)':null,'HbA1c (mmol/mol)':null},
 ];
 const details = empty ? [] : Array.from({length:96}, (_,i) => ({id:i,'Patient Number':'test-a',Date:new Date(Date.UTC(2020,0,1+Math.floor(i/48),0,(i%48)*15)).toISOString(),'CGM (mg / dl)':140+100*Math.sin((i%48)/6)+20*Math.floor(i/48)}));
 if(parameters.has('repo')) { summaries[0]['Patient Number']='2000_0_20201230'; details.forEach(row=>row['Patient Number']='2000_0_20201230'); }
 if(parameters.has('edge')) { summaries[0]['Patient Number']='2097_0_20201116'; details.forEach(row=>row['Patient Number']='2097_0_20201116'); }
 const client = getSupabaseClient()!;
 (window as any).__clinicalReads = 0;
 let authCallback:any;
 const user = {id:patientLogin?'browser-patient':'browser-doctor',email:patientLogin?'patient@example.test':'doctor@example.test',email_confirmed_at:'2026-10-24',app_metadata:{role:patientLogin?'patient':'doctor'},user_metadata:{role:'doctor'}};
 client.auth.getUser = async () => ({data:{user},error:null}) as any;
 client.auth.getSession = async () => ({data:{session:anonymous?null:{user,access_token:'fixture-token'}},error:null}) as any;
 client.auth.onAuthStateChange = (callback:any) => {authCallback=callback;setTimeout(()=>callback(recovering?'PASSWORD_RECOVERY':'INITIAL_SESSION',anonymous ? null : {user}),0);return {data:{subscription:{unsubscribe(){}}}};};
 client.auth.signInWithPassword = async ({password}:any) => {if(password!=='fixture-password') return {data:{session:null},error:{message:'Invalid login credentials'}} as any;const session={user,access_token:'fixture-token'};authCallback('SIGNED_IN',session);return {data:{session,user},error:null} as any;};
 (window as any).__backgroundSignIn = () => authCallback('SIGNED_IN',{user});
 client.auth.updateUser = async () => ({data:{user},error:null}) as any;
 client.auth.signOut = async () => {authCallback('SIGNED_OUT',null);return {error:null};};
 client.rpc = async () => ((window as any).__clinicalReads++, {data:{profile:{id:user.id,full_name:'Test Patient',patient_id:'test-a'},summary:summaries[0],readings:[]},error:null}) as any;
 client.from = (table:string) => {
   (window as any).__clinicalReads++;
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
      if (await evaluate(`window.innerWidth<1024 && getComputedStyle(document.querySelector('aside')).visibility==='hidden'`)) {
        await evaluate(`window.scrollTo(0,0);document.querySelector('[aria-label="Toggle sidebar"]').click()`);
        await delay(250);
      }
      await click(label, "document.querySelector('aside')");
      await ready(text);
      assert(!exceptions.length, exceptions.join("\n"));
      console.log("PASS: " + label);
    };
    const open = async (query) => {
      await send("Page.navigate", {
        url: "http://127.0.0.1:3000/.ui-check/navigation-fixture.html" + query,
      });
      await ready("Welcome back");
      await evaluate(`window.__backgroundSignIn()`);
      await delay(100);
      assert(
        await evaluate(
          `!document.querySelector('aside') && window.__clinicalReads===0`,
        ),
        "Restored account skipped the login page or loaded patient data before sign-in",
      );
      if (query.includes("empty") || query.includes("anonymous")) {
        await click("Preview workspace");
      } else {
        await evaluate(
          `(() => {for(const [selector,value] of [['input[type="email"]','fixture@example.test'],['input[type="password"]','fixture-password']]) {const input=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
        );
        if (query.includes("logincheck")) {
          await evaluate(
            `(() => {const input=document.querySelector('input[type="password"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'wrong-fixture-password');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
          );
          await click("Sign in");
          await ready("Invalid login credentials");
          assert(
            await evaluate(
              `!document.querySelector('aside') && window.__clinicalReads===0`,
            ),
            "Failed login opened a restored account",
          );
          await evaluate(
            `(() => {const input=document.querySelector('input[type="password"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'fixture-password');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
          );
        }
        await click("Sign in");
      }
    };
    await open("?logincheck");
    await ready("2 accessible records");
    await screenshot("clean-doctor-overview.png");
    assert(await evaluate(`document.querySelectorAll('[data-testid="dashboard-review-list"] > button').length===1`), 'Review queue must show the low-glucose record');
    await click('Missing results');
    assert(await evaluate(`document.querySelector('[data-testid="dashboard-review-list"]').innerText.includes('test-b') && !document.querySelector('[data-testid="dashboard-review-list"]').innerText.includes('test-a')`), 'Missing HbA1c filter failed');
    await evaluate(`(() => {const input=document.querySelector('[aria-label="Search dashboard patients"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'test-a');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await ready('No matching records');
    await evaluate(`(() => {const input=document.querySelector('[aria-label="Search dashboard patients"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await evaluate(`document.querySelector('[data-testid="dashboard-review-list"] > button').click()`);
    await ready('No CGM readings available');
    assert(await evaluate(`!document.querySelector('main').innerText.includes('NaN') && document.querySelector('main').innerText.includes('Not recorded')`), 'Missing-data dashboard must stay factual');
    await screenshot('patient-dashboard-no-cgm.png');
    await click('Doctor dashboard', "document.querySelector('aside')");
    await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
    await delay(300);
    assert(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth+2`), 'Doctor dashboard mobile overflow');
    await screenshot('doctor-dashboard-mobile.png');
    await send('Emulation.setDeviceMetricsOverride', {width:1440,height:1050,deviceScaleFactor:1,mobile:false});
    await delay(300);
    console.log('PASS: doctor dashboard review filters, search, patient drill-down and mobile layout');
    await open('');
    await ready('2 accessible records');
    for (const [label, text] of [
      ["Patient management", "Patient list"],
      ["Reports", "Complete recorded summary"],
      ["Settings", "Workspace settings"],
    ])
      await expectPage(label, text);
    assert(await evaluate(`![...document.querySelectorAll('aside button')].some(b=>['Health monitoring','Knowledge graph'].includes(b.textContent.trim()))`), 'Removed Doctor modules are still visible');
    await evaluate(`document.querySelector('[aria-label="Doctor workspace menu"]').click()`);
    await click("Switch to Patient workspace");
    await expectPage("My health", "Ambulatory Glucose Profile (AGP)");
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
    await ready("Glucose trend");
    assert(
      await evaluate(
        `document.querySelector('[aria-label="Recorded glucose trend with 70 to 180 mg/dL reference range"]') !== null`,
      ),
      "Jody compact AGP did not render",
    );
    await screenshot("restored-jody-patient-home.png");
    const firstRange = await evaluate(`document.querySelector('[data-testid="patient-health-dashboard"]').innerText`);
    await click('All readings');
    assert(await evaluate(`document.querySelector('[aria-label="Glucose chart period"] button[aria-pressed="true"]').textContent==='All readings'`), 'Chart period did not change');
    await click('Last recorded day');
    assert((await evaluate(`document.querySelector('[data-testid="patient-health-dashboard"]').innerText`))===firstRange, 'Period switching changed record metrics');
    await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
    await delay(300);
    assert(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth+2`), 'Patient dashboard mobile overflow');
    await screenshot('patient-dashboard-mobile.png');
    await send('Emulation.setDeviceMetricsOverride', {width:1440,height:1050,deviceScaleFactor:1,mobile:false});
    await delay(300);
    await expectPage(
      "My recommendations",
      "Review the glucose monitoring plan",
    );
    await click("Doctor dashboard", "document.querySelector('aside')");
    await expectPage("Patient management", "Patient list");
    await evaluate(
      `Array.from(document.querySelectorAll('tbody button')).find(b => b.textContent.includes('Patient test-b')).click()`,
    );
    await evaluate(`Array.from(document.querySelectorAll("tbody tr")).find(row => row.textContent.includes("Patient test-b")).querySelector("td:last-child button").click()`);
    await expectPage("Knowledge graph", "Patient and medical concept map");
    await click("Preview patient view");
    await expectPage("My recommendations", "No recommendations shared yet");
    // A newly opened workspace starts a new prototype recommendation session.
    await open("");
    await ready("2 accessible records");
    await expectPage("Digital twin", "CGM forecast");
    assert(
      await evaluate(
        `document.querySelector('[aria-label="Data source"]').value==='browser'`,
      ),
      "Temporary default did not use the actual browser GRU",
    );
    assert(
      await evaluate(
        `document.querySelector('[aria-label="Prediction patient"]').options.length===2`,
      ),
      "Doctor prediction patient list is missing",
    );
    await evaluate(
      `(() => {const select=document.querySelector('[aria-label="Prediction patient"]');select.value='test-b';select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await ready("Patient record test-b");
    assert(
      await evaluate(
        `!document.querySelector('[data-testid="scenario-result"]') && !document.querySelector('[data-testid="scenario-event"]')`,
      ),
      "Switching patients retained another patient's scenario",
    );
    await evaluate(
      `(() => {const select=document.querySelector('[aria-label="Prediction patient"]');select.value='test-a';select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await ready("Patient record test-a");
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
      ["Home", "Glucose trend"],
      ["My profile", "Complete recorded summary"],
      ["My health", "Ambulatory Glucose Profile (AGP)"],
      ["My digital twin", "Physiological evidence map"],
      ["Risk prediction & what-if", "CGM forecast"],
      ["My recommendations", "No recommendations shared yet"],
      ["Reports", "Complete recorded summary"],
    ])
      await expectPage(label, text);
    await click("Doctor dashboard", "document.querySelector('aside')");
    await ready("Care overview");
    await open("?empty");
    await ready("0 accessible records");
    await ready("Patient data requires sign-in");
    assert(
      await evaluate(
        `document.querySelector('[data-testid="preview-signin-required"]').innerText.includes('does not mean that the database has no patient data')`,
      ),
      "Anonymous empty response was presented as deleted data",
    );
    for (const label of [
      "Patient management",
      "Reports",
    ])
      await expectPage(label, "No patient records available");
    assert(
      await evaluate(
        `![...document.querySelectorAll('aside button')].some(b=>b.textContent.includes('Digital twin'))`,
      ),
      "Anonymous preview exposes Doctor-only prediction tools",
    );
    await expectPage("Settings", "Workspace settings");
    await click("Sign in to view patient data");
    await ready("Welcome back");
    await open("?denied");
    await ready("Database access denied");
    assert(
      !(await evaluate(`document.body.innerText.includes('test-a')`)),
      "Failed query substituted records",
    );
    await open("?patient");
    await ready("Test Patient");
    await ready("Glucose trend");
    for (const [label, text] of [
      ["My health", "Ambulatory Glucose Profile (AGP)"],
      ["My digital twin", "Physiological evidence map"],
      ["Reports", "Complete recorded summary"],
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
    await assertSidebarPinned();
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await delay(400);
    assert(
      await evaluate(
        `getComputedStyle(document.querySelector('[data-testid="workspace-sidebar"]')).position==='fixed' && getComputedStyle(document.querySelector('[data-testid="workspace-sidebar"]')).visibility==='hidden'`,
      ),
      "Mobile sidebar must start hidden",
    );
    assert(
      await evaluate(
        "document.documentElement.scrollWidth<=window.innerWidth+2",
      ),
      "Mobile My health horizontal overflow",
    );
    assert(await evaluate(`!document.querySelector('aside').textContent.includes('Knowledge graph')`), 'Patient account exposes knowledge graph');
    await evaluate(`window.scrollTo(0,0);document.querySelector('[aria-label="Toggle sidebar"]').click()`);
    await delay(300);
    assert(await evaluate(`document.querySelector('aside').getBoundingClientRect().left===0 && document.body.style.overflow==='hidden'`), 'Mobile drawer did not open');
    await screenshot("sidebar-mobile-open.png");
    await send('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await delay(300);
    assert(await evaluate(`getComputedStyle(document.querySelector('aside')).visibility==='hidden' && document.activeElement.getAttribute('aria-label')==='Toggle sidebar'`), 'Escape must close drawer and restore focus');
    await evaluate(`document.querySelector('[aria-label="Toggle sidebar"]').click()`);
    await delay(250);
    await evaluate(`document.querySelector('[aria-label="Toggle sidebar"]').click()`);
    await delay(250);
    assert(await evaluate(`getComputedStyle(document.querySelector('aside')).visibility==='hidden'`), 'Toggle must close drawer');
    await evaluate(`document.querySelector('[aria-label="Toggle sidebar"]').click()`);
    await delay(250);
    await evaluate(`document.querySelector('aside button[aria-current="page"]').click()`);
    await delay(250);
    assert(await evaluate(`getComputedStyle(document.querySelector('aside')).visibility==='hidden'`), 'Selecting a page must close drawer');
    await screenshot("restored-my-health-mobile.png");
    assert(
      await evaluate(
        `!document.body.innerText.includes('Risk prediction & what-if') && !document.body.innerText.includes('Explore prediction and what-if') && !document.body.innerText.includes('Open prediction and what-if lab')`,
      ),
      "Patient account can see Doctor-only prediction entry points",
    );
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
    await evaluate(`document.querySelector('[aria-label="Hide sidebar"]').click()`);
    await delay(300);
    assert(await evaluate(`getComputedStyle(document.querySelector('aside')).visibility==='hidden'`), 'Desktop sidebar failed to collapse');
    await evaluate(`document.querySelector('[aria-label="Toggle desktop sidebar"]').click()`);
    await delay(300);
    assert(await evaluate(`getComputedStyle(document.querySelector('aside')).visibility==='visible'`), 'Desktop sidebar failed to reopen');
    await ready("2 accessible records");
    await expectPage("Digital twin", "Repository GRU");
    await ready("Browser GRU computed successfully");
    await assertSidebarPinned();
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 560,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await delay(200);
    await assertSidebarPinned();
    await evaluate(
      `(() => {const sidebar=document.querySelector('[data-testid="workspace-sidebar"]');sidebar.scrollTop=sidebar.scrollHeight;})()`,
    );
    assert(
      await evaluate(
        `(() => {const sidebar=document.querySelector('[data-testid="workspace-sidebar"]');const footer=sidebar.lastElementChild.getBoundingClientRect();return footer.bottom<=window.innerHeight && footer.top>=0;})()`,
      ),
      "Short screens must allow scrolling the navigation to its footer",
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await evaluate(
      `document.querySelector('[data-testid="workspace-sidebar"]').scrollTop=0`,
    );
    assert(
      await evaluate(
        `document.querySelector('[aria-label="Baseline and what-if glucose prediction comparison"]').dataset.display === 'range' && document.querySelectorAll('[data-testid="prediction-panel"] .recharts-area-area').length === 1`,
      ),
      "GRU range bands must be the initial view",
    );
    assert(
      await evaluate(
        `document.querySelector('[data-testid="range-explanation"]').innerText.includes('not a calibrated prediction interval')`,
      ),
      "Historical reference must not claim calibrated coverage",
    );
    assert(
      await evaluate(
        `document.querySelector('[data-testid="prediction-layer-legend"]').innerText.includes('Baseline average') && document.querySelectorAll('[data-testid="prediction-panel"] .recharts-line-curve').length >= 1`,
      ),
      "Range view must include its middle average line",
    );
    assert(
      await evaluate(
        `(() => {const panel=document.querySelector('[data-testid="prediction-panel"]');const colours=[...panel.querySelectorAll('linearGradient stop')].map(stop=>stop.getAttribute('stop-color'));return ['#86EFAC','#15803D','#F97316'].every(colour=>colours.includes(colour));})()`,
      ),
      "Prediction range lost its Health monitoring zone colours",
    );
    await click("Show reference range");
    assert(
      await evaluate(`(() => {
        const chart=document.querySelector('[data-testid="forecast-chart-design"]');
        const axes=[...chart.querySelectorAll('.recharts-cartesian-axis-line')];
        const thresholds=[...chart.querySelectorAll('.recharts-reference-line-line')];
        const labels=[...chart.querySelectorAll('.recharts-cartesian-axis-tick-value')];
        return axes.length===2 && axes.every(axis=>axis.getAttribute('stroke')==='#000000') &&
          thresholds.length===4 && new Set(thresholds.map(line=>line.getAttribute('stroke'))).size===4 &&
          thresholds.every(line=>line.getAttribute('stroke-dasharray')==='1 6' && Number(line.getAttribute('stroke-width'))>=2) &&
          labels.every(label=>getComputedStyle(label).fill==='rgb(0, 0, 0)') &&
          [...chart.querySelectorAll('p,button,span')].filter(el=>el.innerText?.trim()).every(el=>getComputedStyle(el).color==='rgb(0, 0, 0)');
      })()`),
      "Chart needs pure-black labels, visible axes, and four distinct coloured dotted thresholds",
    );
    assert(
      await evaluate(
        `(() => {const chart=document.querySelector('[aria-label="Baseline and what-if glucose prediction comparison"]');const ticks=[...chart.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')];const left=chart.getBoundingClientRect().left;return ticks.length>=3 && ticks.every(tick=>/^-?\\d{1,4}$/.test(tick.textContent) && tick.getBoundingClientRect().left>=left);})()`,
      ),
      "Blood-glucose axis shows clipped labels or long decimal strings in reference-range view",
    );
    await chartScreenshot("prediction-reference-axis-readable.png");
    await click("Fit forecast range");
    await evaluate(
      `document.querySelector('[aria-label="Baseline and what-if glucose prediction comparison"]').scrollIntoView({block:'center'})`,
    );
    const inspectionPoint = await evaluate(
      `(() => {const r=document.querySelector('[data-testid="forecast-chart-design"] .recharts-wrapper').getBoundingClientRect();return {x:r.left+r.width*0.55,y:r.top+r.height*0.45};})()`,
    );
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      ...inspectionPoint,
    });
    await delay(250);
    assert(
      await evaluate(
        `document.querySelector('[data-testid="prediction-chart-readout"]').innerText.includes('INSPECTING') && !document.querySelector('[data-testid="forecast-chart-design"] .recharts-tooltip-wrapper')?.innerText`,
      ),
      "Chart inspection must update the readout without covering the plot",
    );
    await chartScreenshot("range-gru-desktop.png");
    assert(
      await evaluate(
        `(() => {const legend=document.querySelector('[data-testid="prediction-layer-legend"]').innerText;return legend.includes('Outer range') && !document.querySelector('[data-testid="inner-band-note"]') && !document.querySelector('[data-testid="prediction-method-details"]').open;})()`,
      ),
      "Default chart must show one outer band while technical notes stay collapsed",
    );
    assert(
      await evaluate(
        `!!(document.querySelector('[data-testid="simulator-panel"]').compareDocumentPosition(document.querySelector('[data-testid="forecast-values-panel"]')) & Node.DOCUMENT_POSITION_FOLLOWING)`,
      ),
      "Full-width forecast table must follow the scenario builder",
    );
    await click("Show inner spread");
    assert(
      await evaluate(
        `document.querySelectorAll('[data-testid="prediction-panel"] .recharts-area-area').length === 2 && document.querySelector('[data-testid="inner-band-note"]').innerText.includes('darker fill')`,
      ),
      "Optional inner spread needs a visible explanation",
    );
    await click("Hide inner spread");
    assert(
      await evaluate(
        `document.querySelectorAll('[data-testid="prediction-panel"] .recharts-area-area').length === 1`,
      ),
      "Hiding inner spread must restore the simple chart",
    );
    await chartScreenshot("prediction-redesigned-desktop.png", false);
    assert(
      await evaluate(
        `(() => { const horizon = document.querySelector('[aria-label="Forecast horizon"]'); return horizon.value === '6' && [...horizon.options].map(o => o.value).join(',') === '6,12'; })()`,
      ),
      "Digital twin must default to 6h and offer only 6/12h",
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
        `document.querySelector('[data-testid="prediction-panel"]').innerText.includes('unvalidated physiology comparison')`,
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
    await ready("Physiology scenario computed");
    assert(
      await evaluate(
        `document.querySelector('[data-testid="scenario-result"]').textContent.includes('Hypothetical rapid insulin') && document.querySelector('[data-testid="scenario-result"]').textContent.includes('Later snack')`,
      ),
      "Multiple applied events were lost",
    );
    assert(
      await evaluate(
        `document.querySelector('[data-testid="scenario-result"]').tagName==='DETAILS' && !document.querySelector('[data-testid="scenario-result"]').open`,
      ),
      "Detailed applied-event receipt should be collapsible",
    );
    await evaluate(
      `document.querySelector('[data-testid="scenario-result"] summary').click()`,
    );
    await ready("Applied schedule (UTC)");
    await evaluate(
      `document.querySelector('[data-testid="scenario-result"] summary').click()`,
    );
    const forecastValues = await evaluate(
      `document.querySelector('[data-testid="forecast-values-panel"]').innerText`,
    );
    assert(
      await evaluate(
        `document.querySelector('[data-testid="range-explanation"]').textContent.includes('27 settings') && document.querySelectorAll('[data-testid="prediction-panel"] .recharts-area-area').length === 2`,
      ),
      "Physiology sensitivity bands were not generated",
    );
    await click("Show model estimates only");
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
    assert(
      await evaluate(
        `document.querySelectorAll('[data-testid="prediction-panel"] .recharts-line-curve').length >= 2`,
      ),
      "Baseline and what-if average lines must remain visible with bands",
    );
    await chartScreenshot("range-physiology-desktop.png");
    assert(
      await evaluate(`(async () => {
      const originalCreate=URL.createObjectURL, originalRevoke=URL.revokeObjectURL, originalClick=HTMLAnchorElement.prototype.click;
      let csv;
      try {
        URL.createObjectURL=blob=>{csv=blob;return 'blob:range-export-test';}; URL.revokeObjectURL=()=>{}; HTMLAnchorElement.prototype.click=()=>{};
        document.querySelector('[data-testid="forecast-values-panel"] button').click();
        const rows=(await csv.text()).trim().split('\\n').map(row=>row.split(','));const header=rows.shift();
        for(const prefix of ['baseline','scenario']) {
          const low=header.indexOf(prefix+'_reference_low'),high=header.indexOf(prefix+'_reference_high'),average=header.indexOf(prefix+'_range_average');
          if(low<0||high<0||average<0||!rows.every(row=>Math.abs(Number(row[average])-(Number(row[low])/2+Number(row[high])/2))<1e-9)) return false;
        }
        return true;
      } finally {URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;HTMLAnchorElement.prototype.click=originalClick;}
    })()`),
      "CSV range averages do not match the plotted bounds midpoints",
    );
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
    await chartScreenshot("prediction-redesigned-mobile.png", false);
    const mobileLayout = await evaluate(
      `({viewport:window.innerWidth,page:document.documentElement.scrollWidth,overlays:[...document.querySelectorAll('[data-testid="prediction-panel"] .recharts-tooltip-wrapper')].map(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width}))})`,
    );
    if (mobileLayout.viewport !== 390 || mobileLayout.page > 392)
      console.log("Mobile overflow", mobileLayout);
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
    await open("?edge");
    await ready("2 accessible records");
    await expectPage("Digital twin", "Repository GRU");
    await ready("Browser GRU computed successfully");
    assert(
      await evaluate(`document.body.innerText.includes('217.8 mg/dL')`),
      "Screenshot record did not use its actual repository seed",
    );
    await addScenarioEvent("meal", {
      description: "rice",
      amount: "200",
      carbohydrate: "200",
    });
    const riceTime = await eventClock(120);
    await evaluate(
      `(() => {const input=document.querySelector('[aria-label="Event 1 time"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(riceTime)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await click("Run what-if simulation");
    await ready("What-if scenario was not calculated");
    assert(
      await evaluate(
        `document.querySelector('[data-testid="simulation-failure"]').innerText.includes('200.0 g carbohydrate') && document.querySelector('[data-testid="simulation-failure"]').innerText.includes('only the baseline GRU') && !document.querySelector('[data-testid="scenario-result"]')`,
      ),
      "Failed scenario was presented as an applied result",
    );
    await chartScreenshot("what-if-invalid-carbohydrate.png");
    await evaluate(
      `(() => {const select=document.querySelector('[aria-label="Event 1 carbohydrate source"]');select.value='usda-cooked-white-rice';select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    assert(
      await evaluate(
        `document.querySelector('[aria-label="Event 1 carbohydrate"]').value==='55.5' && document.querySelector('[aria-label="Event 1 carbohydrate"]').readOnly`,
      ),
      "Cooked rice portion was not explicitly converted to carbohydrate",
    );
    await click("Run what-if simulation");
    await ready("Physiology scenario computed");
    assert(
      await evaluate(
        `!document.querySelector('[data-testid="simulation-failure"]') && document.querySelector('[data-testid="scenario-result"]').textContent.includes('55.5 g carbohydrate (USDA cooked-rice estimate)')`,
      ),
      "Corrected cooked-rice scenario did not recover",
    );
    const successfulRice = await evaluate(
      `document.querySelector('[data-testid="forecast-values-panel"]').innerText`,
    );
    assert(
      await evaluate(
        `(() => {const colours=[...document.querySelectorAll('[data-testid="prediction-panel"] linearGradient stop')].map(stop=>stop.getAttribute('stop-color'));return colours.includes('#DC2626') && colours.includes('#991B1B');})()`,
      ),
      "High and very-high glucose regions were not separately coloured",
    );
    await chartScreenshot("what-if-cooked-rice-working.png");
    await evaluate(
      `(() => {const select=document.querySelector('[aria-label="Event 1 carbohydrate source"]');select.value='manual';select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await evaluate(
      `(() => {const input=document.querySelector('[aria-label="Event 1 carbohydrate"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'200');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await click("Run what-if simulation");
    await ready("What-if scenario was not calculated");
    assert(
      await evaluate(
        `document.querySelector('[data-testid="simulation-failure"]').innerText.includes('last successful applied schedule')`,
      ),
      "Retry failure did not identify the retained prior result",
    );
    assert(
      (await evaluate(
        `document.querySelector('[data-testid="forecast-values-panel"]').innerText`,
      )) === successfulRice,
      "A failed draft replaced the last successful scenario",
    );
    await ready("Draft changes are not applied");
    await click("Clear events and return to baseline");
    await ready("Browser GRU computed successfully");
    assert(
      await evaluate(
        `!document.querySelector('[data-testid="simulation-failure"]') && !document.querySelector('[data-testid="scenario-result"]')`,
      ),
      "Reset did not clear failed scenario state",
    );
    console.log(
      "PASS: exact screenshot record, 200g carbohydrate failure, explicit 200g cooked-rice conversion, successful recovery and honest retained-result/reset states",
    );
    await send("Page.navigate", {
      url: "http://127.0.0.1:3000/.ui-check/navigation-fixture.html?recovery",
    });
    await ready("Choose a new password");
    assert(
      await evaluate(
        `!document.querySelector('aside') && window.__clinicalReads===0`,
      ),
      "Password recovery opened an account workspace",
    );
    await evaluate(
      `(() => {for(const input of document.querySelectorAll('input[type="password"]')) {Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'new-fixture-password');input.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
    );
    await click("Update password");
    await ready("Welcome back");
    assert(
      await evaluate(
        `!document.querySelector('aside') && window.__clinicalReads===0`,
      ),
      "Password reset automatically logged into a workspace",
    );
    console.log(
      "PASS: login first despite restored/background sessions, invalid password stays signed out, explicit Doctor/Patient sign-in, and password recovery returns to login",
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
