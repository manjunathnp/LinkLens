import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),app=await readFile(new URL('../app.js',import.meta.url),'utf8');
const ctx=vm.createContext({});vm.runInContext(app.slice(app.indexOf('function verificationResult('),app.indexOf('const resultFilterEntries')),ctx);
const seed={loaded:false,source:'https://example.test/page',issues:[{severity:'unverified',code:'destination-unverified',message:'Incomplete evidence'}]},classify=a=>ctx.verificationResult({...seed,...a});
const cases=[
 ['working',{loaded:true,issues:[]},'working','verified-working'],
 ['true failure',{issues:[{severity:'broken',message:'404'},{severity:'unverified',code:'scripted-destination'}]},'broken','confirmed-broken'],
 ['loaded inconclusive',{loaded:true},'incomplete','inconclusive'],
 ['sign-in',{reason:'Destination requires sign-in or verification in the browser; it is not confirmed broken.'},'incomplete','sign-in-required'],
 ['access',{httpStatus:403,reason:'Browser returned HTTP 403; access or rate limits prevent verification.'},'incomplete','access-restricted'],
 ['throttle',{httpStatus:429,reason:'Browser returned HTTP 429; access or rate limits prevent verification.'},'incomplete','rate-limited'],
 ['timeout',{reason:'Browser destination verification failed or timed out: page.goto: Timeout 7000ms exceeded.'},'incomplete','timed-out'],
 ['network failure',{reason:'Browser destination verification failed or timed out: net::ERR_NAME_NOT_RESOLVED'},'incomplete','browser-check-failed'],
 ['session',{reason:'Browser session storage could not be preserved; destination was not verified.'},'incomplete','session-unavailable'],
 ['limit',{reason:'Destination verification limit reached.'},'incomplete','scan-limit'],
 ['download',{download:true,reason:'Download or potential action destination was not activated.'},'manual','action-skipped'],
 ['guarded action',{reason:'Download or potential action destination was not activated.'},'manual','action-skipped'],
 ['email',{source:'mailto:test@example.test',reason:'mailto: destination requires manual verification; it was not activated.'},'manual','external-action'],
 ['script',{source:'javascript:void(0)',reason:'javascript: destination requires manual verification; it was not activated.'},'manual','external-action'],
 ['control',{issues:[{severity:'unverified',code:'scripted-destination'}]},'manual','scripted-control'],
 ['control name failure',{issues:[{severity:'alt',code:'missing-link-name'},{severity:'unverified',code:'scripted-destination'}]},'manual','scripted-control'],
 ['fragment',{loaded:true,reason:'Destination rendered, but its fragment target was not found. Dynamic content requires review.'},'incomplete','fragment-inconclusive'],
 ['response conflict',{loaded:true,httpStatus:404,reason:'Browser rendered content despite HTTP 404. Review the document response; the link is not confirmed broken.'},'incomplete','response-conflict'],
 ['legacy unknown',{},'incomplete','inconclusive']
];
for(const [name,a,group,code] of cases){const v=classify(a);assert.equal(v.group,group,name);assert.equal(v.code,code,name);assert.ok(v.detail&&v.next,name)}console.log('RESULT-04: nineteen evidence classifications passed; no promotion of unknowns to passes.');
const base='http://127.0.0.1:4505',server=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'4505'},stdio:'pipe'});let browser;
const out=new URL('../test-output/separation/',import.meta.url);await mkdir(out,{recursive:true});
try{let health;for(let i=0;i<70;i++){try{health=await(await fetch(base+'/api/health')).json();break}catch{await new Promise(r=>setTimeout(r,100))}}assert.ok(health);
 const sample=JSON.parse(await readFile(new URL('../test-output/report.json',import.meta.url),'utf8')),original=sample.assets[0];
 const make=(i,a)=>({...original,...seed,id:'result-'+i,name:'Observation '+i,accessibleName:'Observation '+i,page:sample.url,viewport:i%2?'Mobile':'Desktop',...a});
 const assets=[make(0,{loaded:true,issues:[]}),make(1,{issues:[{severity:'broken',code:'http-failure',message:'404 Not found',fix:'Correct URL'}]}),make(2,{httpStatus:403,reason:'Browser returned HTTP 403; access or rate limits prevent verification.'}),make(3,{reason:'Browser destination verification failed or timed out: Timeout 7000ms exceeded.'}),...Array.from({length:60},(_,i)=>make(i+4,{issues:[{severity:'unverified',code:'scripted-destination',message:'Control destination not verified',fix:'Check action'}]}))];
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.evaluate(a=>localStorage.setItem('linklense-audits-v1',JSON.stringify([a])),{...sample,buildId:health.buildId,assets});await page.reload();
 assert.deepEqual(await page.locator('.outcome-card>strong').allTextContents(),['1','1','1','60']);assert.match(await page.locator('.outcome-card.incomplete small').innerText(),/2 recorded checks/);assert.equal(await page.locator('tbody tr').count(),1);assert.equal(await page.locator('#status-filter').inputValue(),'confirmed');assert.match(await page.locator('.destination-summary').innerText(),/50% destination success/);assert.match(await page.locator('.destination-summary').innerText(),/2 \/ 64 observations/);
 await page.locator('.separate-actions summary').click();await page.locator('[data-filter="outcome:manual"]').first().click();assert.equal(await page.locator('#status-filter').inputValue(),'outcome:manual');assert.match(await page.locator('.table-footer').innerText(),/of 60 observations/);assert.match(await page.locator('.result-cell').first().innerText(),/Scripted control/);assert.match(await page.locator('.result-cell').first().innerText(),/Next:/);
 await page.getByRole('tab',{name:'Overview',exact:true}).click();await page.locator('[data-filter="reason:access-restricted"]').click();assert.equal(await page.locator('tbody tr').count(),1);assert.match(await page.locator('.result-cell').innerText(),/Access restricted/);await page.locator('#viewport-filter').selectOption('Mobile');assert.equal(await page.locator('tbody tr').count(),0);await page.getByRole('button',{name:'Clear filters'}).click();
 await page.getByRole('tab',{name:'Overview',exact:true}).click();await page.locator('#status-filter').selectOption('confirmed');await page.locator('h1').click();await page.screenshot({path:new URL('overview.png',out).pathname,fullPage:true});
 for(const theme of ['light','dark']){await page.getByLabel('Appearance',{exact:true}).selectOption(theme);await page.waitForTimeout(200);await page.setViewportSize({width:375,height:812});await page.evaluate(await readFile(require.resolve('axe-core/axe.min.js'),'utf8'));const ax=await page.evaluate(()=>axe.run());assert.deepEqual(ax.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
 const html=await page.evaluate(()=>reportHTML());await writeFile(new URL('report.html',out),html);const report=await browser.newPage();await report.goto(new URL('report.html',out).href);await report.locator('#severity').selectOption('outcome:manual');assert.equal(await report.locator('tbody tr:visible').count(),60);assert.match(await report.locator('tbody tr:visible').first().innerText(),/Scripted control/);await report.locator('#severity').selectOption('outcome:incomplete');assert.equal(await report.locator('tbody tr:visible').count(),2);await report.locator('#reset').click();assert.equal(await report.locator('tbody tr:visible').count(),64);await page.getByRole('button',{name:'Export report'}).click();
 for(const ext of ['json','csv']){const waiting=page.waitForEvent('download');await page.locator(`[data-export=${ext}]`).click();const download=await waiting;const path=new URL('export.'+ext,out).pathname;await download.saveAs(path);const content=await readFile(path,'utf8');if(ext==='json'){const exported=JSON.parse(content);assert.equal(exported.verificationSummary.manual,60);assert.equal(exported.assets.filter(a=>a.verificationResult.group==='incomplete').length,2)}else{assert.ok(content.includes('verificationGroup,verificationReason,verificationNextStep'));assert.ok(content.includes('Scripted control'));assert.ok(content.includes('Access restricted'));}}
 assert.deepEqual(errors,[]);
 await writeFile(new URL('results.json',out),JSON.stringify({buildId:health.buildId,version:health.version,tests:['RESULT-04 evidence classification','RESULT-05 large manual group separation','RESULT-06 reason filtering and viewport intersection','RESULT-07 standalone export parity'],classifications:cases.length,counts:{working:1,broken:1,incomplete:2,manual:60},total:64,successRate:50,status:'passed'},null,2));console.log('RESULT-05/06/07: exclusive totals, visible reasons, default confirmed findings, reason/viewport filters, mobile themes and HTML/JSON/CSV export parity passed.');
}finally{await browser?.close();server.kill('SIGTERM')}
