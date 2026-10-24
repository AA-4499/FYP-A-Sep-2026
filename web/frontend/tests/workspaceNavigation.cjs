// Start npm run dev on port 3000, then run npm run test:navigation.
// Uses headless Chrome; set CHROME_PATH if Chrome is installed elsewhere.
﻿(async () => {
const fs=require('fs'),path=require('path'),cp=require('child_process');
const out=path.resolve(__dirname,'../.ui-check');
fs.mkdirSync(out,{recursive:true});
const browser=cp.spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--no-first-run','--disable-default-apps','--disable-background-networking','--remote-debugging-port=9334','--user-data-dir='+path.join(out,'navigation-chrome-profile'),'about:blank'], {windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let socket;
try{
 let target;
 for(let i=0;i<60;i++){
  try{target=await (await fetch('http://127.0.0.1:9334/json/new?about:blank',{method:'PUT'})).json();break;}catch{await delay(300);}
 }
 if(!target)throw Error('Chrome debugging target did not start');
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let seq=0;const pending=new Map(),exceptions=[];
 socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 const ready=async(text)=>{for(let i=0;i<90;i++){if(await evaluate('document.body.innerText.includes('+JSON.stringify(text)+')'))return;await delay(250);}throw Error('Timed out waiting for '+text);};
 const screenshot=async(name)=>{const metrics=await send('Page.getLayoutMetrics');const size=metrics.cssContentSize;const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:size.width,height:size.height,scale:1}});fs.writeFileSync(path.join(out,name),Buffer.from(shot.data,'base64'));};
 await send('Page.enable');await send('Page.bringToFront');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});

 const click = async (label, scope = 'document') => {
   const position = await evaluate(`(() => {
     const button = [...${scope}.querySelectorAll('button')].find(b => b.textContent.replaceAll(String.fromCharCode(0x25aa), '').trim() === ${JSON.stringify(label)});
     if (!button) throw Error('Missing button: ' + ${JSON.stringify(label)});
     button.scrollIntoView({block: 'center'});
     const rect = button.getBoundingClientRect();
     return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
   })()`);
   await send('Input.dispatchMouseEvent', {type: 'mousePressed', ...position, button: 'left', clickCount: 1});
   await send('Input.dispatchMouseEvent', {type: 'mouseReleased', ...position, button: 'left', clickCount: 1});
   await delay(250);
 };
 const expectPage = async (label, text) => {
   await click(label, "document.querySelector('aside')");
   for (let i = 0; i < 80; i++) {
     assert(!exceptions.length, exceptions.join('\n'));
     if (await evaluate(`document.querySelector('main')?.innerText.includes(${JSON.stringify(text)})`)) {
       console.log('PASS: ' + label);
       return;
     }
     await delay(150);
   }
   throw Error('Page did not open: ' + label);
 };
 await send('Page.navigate', {url: 'http://127.0.0.1:3000/'});
 await ready('Welcome back');
 await click('Preview sample dashboards');
 await ready('Clinical Population Health & Triage');
 for (const [label, text] of [
   ['Patient management', 'Patient List & Clinical Profiles'],
   ['Health monitoring', 'Longitudinal'],
   ['Digital twin', 'Physiological Digital Twin'],
   ['Knowledge graph', 'Patient and medical concept map'],
   ['Reports', 'Clinical Health & Digital Twin Dossier'],
   ['Settings', 'Workspace settings'],
 ]) await expectPage(label, text);
 await evaluate(`document.querySelector('[aria-label="Doctor workspace menu"]').click()`);
 await click('Switch to Patient workspace');
 for (const [label, text] of [
   ['Home', 'Fasting glucose'],
   ['My profile', 'Sample Patient profile'],
   ['My health', 'Longitudinal'],
   ['My digital twin', 'Physiological Digital Twin'],
   ['Risk prediction & what-if', 'Risk Prediction and What-if Simulation'],
   ['My recommendations', 'My recommendations'],
   ['Reports', 'Clinical Health & Digital Twin Dossier'],
 ]) await expectPage(label, text);
 await click('Doctor dashboard', "document.querySelector('aside')");
 await ready('Clinical Population Health & Triage');
 assert(!exceptions.length, exceptions.join('\n'));
 // Mount the same application with a verified Doctor and an empty cohort.
 // These mocks never contact a real auth service or patient database.
 fs.writeFileSync(path.join(out, 'navigation-empty.html'), '<div id="root"></div><script type="module" src="/.ui-check/navigation-empty.tsx"></script>');
 fs.writeFileSync(path.join(out, 'navigation-empty.tsx'), `
 import React from 'react';
 import { createRoot } from 'react-dom/client';
 import { App } from '../src/App';
 import { getSupabaseClient } from '../src/lib/supabase';
 import '../src/index.css';
 const client = getSupabaseClient()!;
 const user = {id: 'navigation-test', email_confirmed_at: '2026-10-24', app_metadata: {role: 'doctor'}};
 client.auth.getUser = async () => ({data: {user}, error: null}) as any;
 client.auth.onAuthStateChange = (callback: any) => {
   setTimeout(() => callback('INITIAL_SESSION', {user}), 0);
   return {data: {subscription: {unsubscribe() {}}}};
 };
 client.from = () => {
   const result: any = {select: () => result, limit: () => result,
     then: (resolve: any, reject: any) => Promise.resolve({data: [], count: 0, error: null}).then(resolve, reject)};
   return result;
 };
 createRoot(document.getElementById('root')!).render(<App />);
 `);
 await send('Page.navigate', {url: 'http://127.0.0.1:3000/.ui-check/navigation-empty.html'});
 await ready('Clinical Population Health & Triage');
 for (const label of ['Patient management', 'Health monitoring', 'Digital twin', 'Knowledge graph', 'Reports']) {
   await expectPage(label, 'No patient records available');
   assert(!(await evaluate(`document.body.innerText.includes('Elena Morales')`)), 'Live workspace leaked sample data');
 }
 await expectPage('Settings', 'Workspace settings');
 await evaluate(`document.querySelector('[aria-label="Doctor workspace menu"]').click()`);
 await click('Switch to Patient workspace');
 await ready('No patient records available');
 await click('Doctor dashboard', "document.querySelector('aside')");
 await ready('Clinical Population Health & Triage');
 assert(!exceptions.length, exceptions.join('\n'));
 console.log('PASS: empty cohort and patient preview retain working navigation');
 await send('Browser.close');
} catch (error) {
 console.error(error);
 process.exitCode = 1;
} finally {
 if (socket) socket.close();
 browser.kill();
 for (const name of ['navigation-empty.html', 'navigation-empty.tsx']) {
   const file = path.join(out, name);
   if (fs.existsSync(file)) fs.unlinkSync(file);
 }
}
})().catch(error => {console.error(error); process.exitCode = 1;});
