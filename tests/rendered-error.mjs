import assert from 'node:assert/strict';
import http from 'node:http';
import {scan,discover} from '../src/scanner.js';
const server=http.createServer((req,res)=>{res.writeHead(req.url==='/ok'?200:404,{'Content-Type':'text/html'});const pages={
 '/app':'<h1>Products</h1><main></main><script>setTimeout(()=>document.querySelector("main").innerHTML=\'<a href="/ok">Product details</a>\',100)</script>',
 '/error':'<h1>404 Not found</h1><a href="/ok">Home</a>',
 '/empty':'',
 '/login':'<h1>Sign in</h1><input autocomplete="username" name="username"><button>Continue</button>',
 '/mfa':'<h1>Verify your identity</h1><input autocomplete="one-time-code">',
 '/ok':'<h1>Product</h1>'};res.end(pages[req.url]||'')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const job=()=>({signal:new AbortController().signal,gaps:[]});
try{for(const viewports of [['Desktop'],['Mobile'],['Desktop','Mobile']]){const url=base+'/app',result=await scan({url,pages:[url],viewports},job());assert.equal(result.assets.length,viewports.length);assert.ok(result.assets.every(a=>a.accessibleName==='Product details'));assert.ok(result.pageResults.every(p=>p.httpStatus===404&&p.status==='checked'));assert.ok(result.coverage.gaps.some(g=>g.reason==='Document returned HTTP 404'));}
const failed=await scan({url:base+'/error',pages:[base+'/error'],viewports:['Desktop']},job());assert.equal(failed.assets.length,1);assert.equal(failed.assets[0].type,'Audited URL');assert.equal(failed.assets[0].status,'broken');assert.equal(failed.pageResults[0].status,'broken');
for(const path of ['/empty','/login','/mfa']){const url=base+path,result=await scan({url,pages:[url],viewports:['Desktop']},job());assert.equal(result.assets.length,0,path);assert.equal(result.pageResults[0].status,'unverified',path)}
const discovered=await discover({url:base+'/app'},job());assert.ok(discovered.pages.some(p=>p.url===base+'/ok'));assert.ok(discovered.gaps.some(g=>g.reason==='Document returned HTTP 404'));console.log('Rendered HTTP-error regressions passed: all viewport modes, retained HTTP evidence, discovery, real error/empty page rejection, username-only login and MFA rejection.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
