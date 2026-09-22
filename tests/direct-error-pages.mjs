import assert from 'node:assert/strict';
import http from 'node:http';
import {chromium} from 'playwright';
import {scan} from '../src/scanner.js';
process.env.PORT='4409';const {server}=await import('../server.js');let external,browser;let recoveryRequests=0;
const fixture=http.createServer((req,res)=>{
 res.setHeader('Content-Type','text/html');
 if(req.url==='/links')return res.end('<h1>Reference links</h1>'+[404,410,500,503].map(code=>`<a href="${external}/${code}">Error ${code}</a>`).join('')+['login','blocked','app','article'].map(name=>`<a href="${external}/${name}">${name}</a>`).join(''));
 if(req.url==='/recovery'){recoveryRequests++;return res.end('<h1>Recovery page</h1>')}
 if(/^\/(404|410|500|503)$/.test(req.url)){res.statusCode=Number(req.url.slice(1));return res.end(`<h1>Status Codes</h1><p>This page returned a ${res.statusCode} status code.</p><a href="/recovery">Recovery</a>`)}
 res.statusCode=404;
 res.end({'/login':'<h1>404 Not found</h1><input type="password"><button>Sign in</button>','/blocked':'<h1>404 Not found</h1><p>Request blocked. Verify you are human.</p>','/app':'<h1>Working application</h1><p>Dashboard content.</p>','/article':'<h1>Explaining page not found errors</h1><p>A reference article.</p>'}[req.url]);
});await new Promise(r=>fixture.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+fixture.address().port;external='http://localhost:'+fixture.address().port;
const run=url=>scan({url,pages:[url],viewports:['Desktop','Mobile']},{signal:new AbortController().signal,gaps:[]});
try{
 const reports=[];
 for(const code of [404,410,500,503]){const report=await run(origin+'/'+code);reports.push(report);assert.equal(report.assets.length,2);assert.ok(report.assets.every(a=>a.auditedURL&&a.status==='broken'&&a.httpStatus===code));assert.ok(report.pageResults.every(p=>p.status==='broken'&&p.links===0));}
 assert.equal(recoveryRequests,0,'Error-page recovery links must not turn a failed audited URL into a success');
 const linked=await run(origin+'/links');assert.equal(linked.assets.length,16);for(const code of [404,410,500,503])assert.ok(linked.assets.filter(a=>a.accessibleName==='Error '+code).every(a=>a.status==='broken'&&!a.auditedURL));
 for(const name of ['login','blocked','app','article'])assert.ok(linked.assets.filter(a=>a.accessibleName===name).every(a=>a.status==='unverified'),name);
 for(const path of ['login','blocked','app','article']){const report=await run(origin+'/'+path);assert.ok(!report.assets.some(a=>a.status==='broken'),path);assert.ok(report.pageResults.every(p=>p.status!=='broken'),path)}
 browser=await chromium.launch({headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:4409');
 for(const report of reports){await page.evaluate(r=>localStorage.setItem('linklense-audits-v1',JSON.stringify([r])),report);await page.reload();assert.equal(await page.locator('.metric strong').nth(1).innerText(),'2');assert.equal(await page.locator('.donut-hole strong').innerText(),'0%');assert.match(await page.locator('.failed-pages').innerText(),/Audited URL failed/);assert.equal(await page.locator('tbody tr').count(),2);await page.locator('#viewport-filter').selectOption('Mobile');assert.equal(await page.locator('tbody tr').count(),1);await page.getByRole('button',{name:/^Inspect Audited URL/}).first().click();assert.match(await page.locator('dialog').innerText(),/HTTP status/);await page.getByRole('button',{name:'Close dialog',exact:true}).click();const html=await page.evaluate(()=>reportHTML());assert.match(html,/Audited URL failed/);assert.match(html,/0% destination success/);assert.match(html,new RegExp('HTTP '+report.assets[0].httpStatus));const exported=await browser.newPage();await exported.setContent(html);assert.ok(await exported.locator('.failed-pages .icon').evaluate(e=>e.getBoundingClientRect().height<30));await exported.close();await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1280,height:720});await page.getByRole('tab',{name:'Page coverage',exact:true}).click();assert.match(await page.locator('.matrix').innerText(),/broken/);}
 console.log('LINK-11/RESULT-04 passed: direct 404/410/500/503 URLs, external linked equivalents, login/block/app/article exceptions, both viewports, failed-page count, 0% success, viewport filtering, page coverage and HTML export.');
}finally{await browser?.close();fixture.closeAllConnections();await new Promise(r=>fixture.close(r));await new Promise(r=>server.close(r));}
