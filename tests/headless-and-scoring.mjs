import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createSession,confirmSession,closeSession,sessions,scan} from '../src/scanner.js';
process.env.LINKLENSE_TEST_HEADLESS='1';process.env.PORT='4401';
const {server}=await import('../server.js');
const site=http.createServer((req,res)=>{
 res.setHeader('Content-Type','text/html');
 if(req.url==='/login')return res.end('<h1>Sign in</h1><input type="password"><button>Sign in</button>');
 res.end(`<main></main><script>(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('auth',1);q.onupgradeneeded=()=>q.result.createObjectStore('tokens');q.onsuccess=()=>r(q.result)});const token=await new Promise(r=>{const q=db.transaction('tokens').objectStore('tokens').get('token');q.onsuccess=()=>r(q.result)});db.close();document.querySelector('main').innerHTML=${JSON.stringify(req.headers.cookie?.includes('auth=yes'))}&&localStorage.getItem('auth')==='local'&&sessionStorage.getItem('auth')==='tab'&&token==='indexed'?'<h1 data-authenticated="true">Account dashboard</h1><a href="/private">Private documents</a>':'<h1>Sign in</h1><input type="password"><button>Sign in</button>'})()</script>`);
});await new Promise(r=>site.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+site.address().port,base='http://127.0.0.1:4401';let browser;
const out=new URL('../validation-output/headless-and-scoring/',import.meta.url);await mkdir(out,{recursive:true});
try{
 const {id}=await createSession(origin+'/login'),initial=sessions.get(id),login=initial.page,oldBrowser=initial.browser;
 await login.evaluate(async()=>{localStorage.setItem('auth','local');sessionStorage.setItem('auth','tab');await new Promise(r=>{const q=indexedDB.open('auth',1);q.onupgradeneeded=()=>q.result.createObjectStore('tokens');q.onsuccess=()=>{const db=q.result,t=db.transaction('tokens','readwrite');t.objectStore('tokens').put('indexed','token');t.oncomplete=()=>{db.close();r()}}})});
 await initial.context.addCookies([{name:'auth',value:'yes',url:origin,httpOnly:true}]);await login.goto(origin+'/private');await login.getByRole('heading',{name:'Account dashboard'}).waitFor();
 const [a,b]=await Promise.all([confirmSession(id),confirmSession(id)]);assert.deepEqual(a,b);assert.equal(oldBrowser.isConnected(),false);assert.equal(sessions.has(id),true);
 const connected=sessions.get(id);assert.notEqual(connected.browser,oldBrowser);assert.equal(connected.headless,true);assert.match(await connected.page.evaluate(()=>navigator.userAgent),/HeadlessChrome/);await connected.page.getByRole('heading',{name:'Account dashboard'}).waitFor();
 assert.deepEqual(await confirmSession(id),a);
 const report=await scan({url:a.url,pages:[a.url],sessionId:id,viewports:['Desktop','Mobile']},{signal:new AbortController().signal,gaps:[]});assert.equal(report.assets.length,2);assert.ok(report.assets.every(a=>a.loaded&&a.status==='pass'));assert.equal(connected.context.pages().length,1);
 await connected.page.evaluate(()=>sessionStorage.removeItem('auth'));await connected.page.reload();await connected.page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
 const expired=await scan({url:a.url,pages:[a.url],sessionId:id,viewports:['Desktop']},{signal:new AbortController().signal,gaps:[]});assert.equal(expired.assets.length,0);assert.equal(expired.pageResults[0].status,'unverified');await closeSession(id);
 console.log('AUTH-08/09 passed: headless handoff, cookies/localStorage/sessionStorage/IndexedDB, duplicate confirmation, invisible destination tabs, logout not undone.');
 const failed=await createSession(origin+'/login'),failedSession=sessions.get(failed.id);await failedSession.page.goto(origin+'/private');await failedSession.page.getByRole('button',{name:'Sign in',exact:true}).waitFor();await failedSession.page.evaluate(()=>document.querySelector('main').innerHTML='<h1 data-authenticated="true">Account dashboard</h1>');
 await assert.rejects(()=>confirmSession(failed.id),/could not be restored/);assert.equal(failedSession.confirmed,false);assert.equal(failedSession.browser.isConnected(),true);assert.equal(sessions.has(failed.id),true);await closeSession(failed.id);
 console.log('AUTH-10 passed: non-transferable in-memory login is rejected without losing the sign-in window.');
 const sample=JSON.parse(await readFile(new URL('../test-output/report.json',import.meta.url),'utf8')),health=await(await fetch(base+'/api/health')).json(),asset=sample.assets[0];
 const make=(loaded,severities=[])=>({...asset,loaded,issues:severities.map(severity=>({severity,code:'test-'+severity,message:'Test evidence',fix:'Test guidance'})),status:severities[0]||'pass'});
 browser=await chromium.launch();const page=await browser.newPage();await page.goto(base);
 const cases=[['working plus unknown',[make(true),make(false,['unverified'])],100,1],['working broken unknown',[make(true),make(false,['broken']),make(false,['unverified'])],50,2],['name and review findings',[make(true,['alt']),make(true,['review'])],100,2],['all unknown',[make(false,['unverified']),make(true,['unverified'])],null,0],['only broken',[make(false,['broken'])],0,1],['empty',[],null,0]];
 for(const [name,assets,rate,checked]of cases){
  await page.evaluate(report=>localStorage.setItem('linklense-audits-v1',JSON.stringify([report])),{...sample,buildId:health.buildId,assets});await page.reload();
  const summary=await page.locator('.destination-summary').innerText();assert.ok(summary.includes(rate===null?'No verified destination outcomes':rate+'% destination success'));assert.ok(summary.includes(`${checked} / ${assets.length} observations`));const split=await page.evaluate(()=>destinationSummary(audit.assets));assert.equal(split.incomplete+split.manual,assets.length-checked);assert.ok(summary.includes(`${split.incomplete} access or response conditions; ${split.manual} interactive control and app-action observations`));assert.equal((await page.locator('.donut-hole strong').innerText()).trim(),rate===null?'—':rate+'%');
  const exported=await page.evaluate(()=>reportHTML());assert.ok(exported.includes(summary.split(' · ')[0]));
  if(name==='working plus unknown'){await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:new URL('mobile-score.png',out).pathname,fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:new URL('desktop-score.png',out).pathname,fullPage:true});}
 }
 await writeFile(new URL('results.json',out),JSON.stringify({buildId:health.buildId,version:health.version,authentication:['AUTH-08','AUTH-09','AUTH-10'],scoring:cases.map(([name,,rate,checked])=>({name,rate,checked,status:'passed'}))},null,2));
 console.log('RESULT-01/02 passed: unknowns excluded, true failures retained, name/review issues separate, zero denominator, exported summary and mobile reflow.');
}finally{await browser?.close();for(const id of sessions.keys())await closeSession(id);site.closeAllConnections();await new Promise(r=>site.close(r));await new Promise(r=>server.close(r));}
