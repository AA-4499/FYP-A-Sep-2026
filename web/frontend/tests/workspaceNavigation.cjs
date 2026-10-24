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
      '<div id="root"></div><script type="module" src="/.ui-check/navigation-fixture.tsx"></script>',
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
 const details = empty ? [] : Array.from({length:48}, (_,i) => ({id:i,'Patient Number':'test-a',Date:new Date(Date.UTC(2020,0,1,0,i*15)).toISOString(),'CGM (mg / dl)':140+20*Math.sin(i/6)}));
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
        `document.querySelector('[aria-label="Data source"]').value==='supabase'`,
      ),
      "Clinical record used a local preview",
    );
    await click("Physiology lab");
    await ready("Glucose response and recovery");
    await click("Add event and compare");
    await ready("g carbohydrate");
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
