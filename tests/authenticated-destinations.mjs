import assert from 'node:assert/strict';
import http from 'node:http';
import {chromium} from 'playwright';
import {sessions,scan,closeSession} from '../src/scanner.js';
const requests=[];
const server=http.createServer((req,res)=>{requests.push({path:req.url,method:req.method});const send=(status,body)=>{res.writeHead(status,{'Content-Type':'text/html'});res.end(body)};
 const login='<h1>Sign in</h1><input name="username" autocomplete="username"><button>Continue</button>';
 if(req.url==='/cookie')return send(req.headers.cookie?.includes('auth=yes')?200:404,req.headers.cookie?.includes('auth=yes')?'<h1>Private document</h1>':'<h1>404 Not found</h1>');
 if(req.url==='/head-lies')return send(req.method==='HEAD'?404:200,'<h1>Readable document</h1>');
 if(req.url==='/session'||req.url==='/local')return send(200,`<main></main><script>document.querySelector('main').innerHTML=${req.url==='/session'?'sessionStorage':'localStorage'}.getItem('token')==='demo'?'<h1>Private document</h1>':${JSON.stringify(login)}</script>`);
 if(req.url==='/token-api'){res.writeHead(req.headers.authorization==='Bearer demo'?200:401,{'Content-Type':'text/plain'});return res.end(req.headers.authorization==='Bearer demo'?'Private API content':'Unauthorized')}
 if(req.url==='/token')return send(200,`<main></main><script>fetch('/token-api',{headers:{Authorization:'Bearer '+sessionStorage.getItem('token')}}).then(r=>r.text()).then(t=>document.querySelector('main').innerHTML='<h1>'+t+'</h1>')</script>`);
 if(req.url==='/render404')return send(404,'<h1>Working application</h1><a href="/cookie">Private document</a>');
 if(req.url==='/real404')return send(404,'<h1>404 Not found</h1>');
 if(req.url==='/denied')return send(403,'<h1>Access denied</h1>');
 if(req.url==='/failure')return send(500,'<h1>Temporary service error</h1>');
 if(req.url==='/login')return send(200,login);
 if(req.url==='/redirect-login'){res.writeHead(302,{Location:'/login'});return res.end()}
 if(req.url==='/redirect-action'){res.writeHead(302,{Location:'/logout'});return res.end()}
 if(req.url==='/logout')return send(200,'Unexpected action');
 if(req.url==='/home')return send(200,`<h1 data-authenticated="true">Account</h1>${['cookie','session','local','token','head-lies','render404','real404','denied','failure','login','redirect-login','redirect-action'].map(p=>`<a id="${p}" href="/${p}">${p} document</a>`).join('')}<a id="scripted-good" href="#" onclick="location.href='/cookie'">View details for product</a><a id="scripted-broken" href="#" onclick="location.href='/real404'">View details for missing product</a><a id="scripted-noop" href="#">View details for pending product</a><a id="scripted-action" href="#" onclick="location.href='/logout'">View details and delete product</a><a id="placeholder" href="#" onclick="location.href='/cookie'">Script navigation</a><a id="bookmark" name="bookmark"></a><a id="cart" role="button">Cart</a><a id="hidden-name" href="/cookie"><span aria-hidden="true">ICON</span><span hidden>Hidden name</span></a><a id="fragment" href="#answers">Answers</a><button aria-expanded="false" onclick="this.setAttribute('aria-expanded','true');document.querySelector('main').innerHTML='<h2 id=answers>Answers</h2>'">Show answers</button><main></main>`);
 return send(404,'<h1>404 Not found</h1>');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,id='destination-test';let browser;
try{browser=await chromium.launch();const context=await browser.newContext();await context.addCookies([{name:'auth',value:'yes',url:base}]);const page=await context.newPage();await page.goto(base+'/home');await page.evaluate(()=>{sessionStorage.setItem('token','demo');localStorage.setItem('token','demo')});sessions.set(id,{id,browser,context,page,url:base+'/home',confirmed:true,busy:false,lastUsed:Date.now()});const result=await scan({url:base+'/home',pages:[base+'/home'],viewports:['Desktop','Mobile'],sessionId:id},{signal:new AbortController().signal,gaps:[]});
for(const viewport of ['Desktop','Mobile']){const get=id=>result.assets.find(a=>a.selector==='#'+id&&a.viewport===viewport);
 for(const id of ['cookie','session','local','token','head-lies'])assert.equal(get(id).status,'pass',id+' '+JSON.stringify(get(id).issues));
 assert.equal(get('scripted-good').status,'pass');assert.equal(get('scripted-good').interactionVerified,true);assert.equal(get('scripted-broken').status,'broken');assert.equal(get('scripted-noop').status,'unverified');assert.equal(get('scripted-action').status,'unverified');assert.equal(get('render404').status,'unverified');assert.equal(get('render404').loaded,true);assert.equal(get('real404').status,'broken');
 for(const id of ['denied','failure','login','redirect-login','redirect-action','placeholder'])assert.equal(get(id).status,'unverified',id);
 assert.ok(!get('bookmark'));assert.equal(get('cart').status,'unverified');assert.equal(get('hidden-name').status,'alt');
 const fragments=result.assets.filter(a=>a.selector==='#fragment'&&a.viewport===viewport);assert.ok(fragments.some(a=>a.fragmentExists===false));assert.ok(fragments.some(a=>a.fragmentExists===true));
}
assert.ok(!requests.some(r=>r.method==='HEAD'));assert.ok(!requests.some(r=>r.path==='/logout'));assert.equal(await page.evaluate(()=>sessionStorage.getItem('token')),'demo');console.log('Authenticated destination matrix passed: cookies, sessionStorage, localStorage, JS bearer token, HEAD mismatch, rendered 404, real 404, access denial, login redirects, guarded redirects, scripted controls, hidden names, passive anchors, dynamic fragments, and both viewports.');
}finally{await closeSession(id);await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
