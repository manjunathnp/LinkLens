process.env.LINKLENSE_TEST_HEADLESS='1';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {sessions,confirmSession,closeSession,scan} from '../src/scanner.js';
const server=http.createServer((req,res)=>{
 if(req.url==='/redirect'){res.writeHead(302,{location:other+'/account'});return res.end()}
 res.setHeader('Content-Type','text/html; charset=utf-8');
 if(req.url==='/account')res.setHeader('Set-Cookie','auth=yes; Path=/; HttpOnly');
 const html={
 '/login':'<h1>Sign in</h1><input type="password"><button>Sign in</button>',
 '/challenge':'<h1>Verify your identity</h1><input autocomplete="one-time-code">',
 '/account':'<h1 data-authenticated="true">Account dashboard</h1><a href="/protected">Private documents</a>',
 '/protected':req.headers.cookie?.includes('auth=yes')?'<h1>Documents</h1><a href="/account">My account</a>':'<input type="password"><button>Sign in</button>',
 '/landing':'<h1>Application ready</h1><a href="/account">Browse account</a>'};res.end(html[req.url]||'<h1>404 Not found</h1>');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const site='http://127.0.0.1:'+server.address().port,other='http://localhost:'+server.address().port;
let browser,processServer;const id='auth-regression';
try{
 browser=await chromium.launch();let context=await browser.newContext();let page=await context.newPage();await page.goto(site+'/login');sessions.set(id,{id,browser,context,page,url:site+'/login',busy:false,confirmed:false,lastUsed:Date.now()});
 await assert.rejects(()=>confirmSession(id),/sign-in form/i);
 await page.goto(other+'/challenge');await assert.rejects(()=>confirmSession(id));
 await page.goto(other+'/account');const choice=await confirmSession(id);assert.equal(choice.chooseApplication,true);assert.equal(choice.pages.length,1);assert.equal(sessions.get(id).confirmed,false);
 const picked=choice.pages[0];const connected=await confirmSession(id,picked);assert.equal(connected.url,other+'/account');assert.equal(sessions.get(id).url,connected.url);
 const result=await scan({url:connected.url,pages:[other+'/protected'],sessionId:id},{signal:new AbortController().signal,gaps:[]});assert.ok(result.assets.some(a=>a.accessibleName==='My account'));assert.equal(result.access,'private');
 context=sessions.get(id).context;page=sessions.get(id).page;browser=sessions.get(id).browser;
 // Original login tab can remain open while the app opens in another tab.
 await page.goto(site+'/login');Object.assign(sessions.get(id),{page,url:site+'/login',confirmed:false});const popup=await context.newPage();await popup.goto(site+'/account');assert.equal((await confirmSession(id)).url,site+'/account');assert.equal(sessions.get(id).page,popup);
 // A closed original tab must not discard the still-open application.
 Object.assign(sessions.get(id),{page,url:site+'/login',confirmed:false});await page.close();assert.equal((await confirmSession(id)).url,site+'/account');
 // Never authorize a stale page choice after a tab navigates.
 Object.assign(sessions.get(id),{url:site+'/login',confirmed:false});await popup.goto(other+'/landing');const stale=(await confirmSession(id)).pages[0];await popup.goto(other+'/challenge');await assert.rejects(()=>confirmSession(id,stale),/tab changed/);await assert.rejects(()=>confirmSession(id,{...stale,url:other+'/challenge'}),/verification/);
 await closeSession(id);browser=null;
 console.log('Authentication regression passed: origin changes require selection, private scan uses selected origin/cookies, popup selection, closed original tab, stale choice, incomplete login and MFA rejection.');
 // Exercise the real dashboard choice and scan workflow through HTTP.
 const base='http://127.0.0.1:4397';processServer=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'4397'},stdio:'pipe'});
 for(let i=0;i<60;i++){try{await fetch(base+'/api/health');break}catch{await new Promise(r=>setTimeout(r,100))}}
 browser=await chromium.launch();page=await browser.newPage();await page.goto(base);await page.getByRole('button',{name:'Start your first audit'}).click();await page.locator('#site-url').fill(site+'/redirect');await page.getByRole('radio',{name:'Requires sign-in'}).check();await page.getByRole('button',{name:'Open sign-in browser'}).click();await page.getByRole('button',{name:'Confirm completed sign-in'}).click();await page.getByRole('heading',{name:'Choose your signed-in application'}).waitFor();await page.locator('[data-application]').click();assert.equal(await page.locator('#site-url').inputValue(),other+'/account');await page.locator('#next').click();await page.getByRole('radio',{name:'Current page'}).check();await page.locator('#next').click();await page.locator('#next').click();await page.waitForFunction(()=>!document.querySelector('dialog').open,null,{timeout:60000});assert.match(await page.locator('.site-info').innerText(),/Signed-in session/);assert.ok(Number(await page.locator('.metric strong').first().innerText())>0);console.log('Dashboard regression passed: redirected login, explicit application selection, URL update, and authenticated audit completion.');
}finally{if(sessions.has(id))await closeSession(id);await browser?.close();processServer?.kill('SIGTERM');server.closeAllConnections();await new Promise(r=>server.close(r))}
