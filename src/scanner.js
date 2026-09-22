import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';
import { checkLogin, inspectAuthentication, confirmedPageFailure } from './authentication.js';

export const LIMITS={pages:200,queue:3000,scrolls:24,interactions:16,states:18,destinations:1500,timeout:20000,resourceTimeout:7000};
export const sessions=new Map();
const unsafe=/\b(?:add[-_ ]?to[-_ ]?cart|remove|delete|destroy|reset|submit|save|send|buy|purchase|pay|checkout|subscribe|unsubscribe|upload|download|log[-_ ]?out|sign[-_ ]?out)\b/i;
export function validURL(raw){const u=new URL(raw);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Use an HTTP or HTTPS URL without embedded credentials.');u.hash=/^#(?:\/|!)/.test(u.hash)?u.hash:'';return u.href}
function actionURL(raw){try{const u=new URL(raw);return unsafe.test(u.pathname)||[...u.searchParams].some(([k,v])=>unsafe.test(k)||['action','do','cmd','operation'].includes(k)&&unsafe.test(v))}catch{return true}}
function cancelled(signal){if(signal?.aborted)throw Error('Audit cancelled.');}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function gap(job,page,reason,detail=''){const key=page+'|'+reason+'|'+detail;if(!job.gaps.some(x=>x.key===key))job.gaps.push({key,page,reason,detail});}
const guardedContexts=new WeakMap();
async function guardPage(context,page,job){
 const state=guardedContexts.get(context);if(!state)return;
 if(!state.pages.has(page))state.pages.set(page,(async()=>{
  const client=await context.newCDPSession(page);state.clients.add(client);
  client.on('Fetch.requestPaused',async event=>{
   const req=event.request,blocked=!['GET','HEAD','OPTIONS'].includes(req.method)||actionURL(req.url);
   if(blocked)gap(job,new URL(req.url).origin+new URL(req.url).pathname,'Blocked action request',req.method);
   await client.send(blocked?'Fetch.failRequest':'Fetch.continueRequest',blocked?{requestId:event.requestId,errorReason:'BlockedByClient'}:{requestId:event.requestId}).catch(()=>{});
  });
  await client.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
 })());
 return state.pages.get(page);
}
async function unguard(context){const state=guardedContexts.get(context);if(!state)return;context.off('page',state.onPage);await Promise.allSettled([...state.pages.values()]);await Promise.allSettled([...state.clients].map(async client=>{await client.send('Fetch.disable').catch(()=>{});await client.detach().catch(()=>{})}));guardedContexts.delete(context);}
async function guard(context,job){
 await unguard(context);await context.unroute('**/*');
 const state={pages:new Map(),clients:new Set(),onPage:page=>guardPage(context,page,job).catch(()=>{})};guardedContexts.set(context,state);context.on('page',state.onPage);
 for(const page of context.pages())await guardPage(context,page,job);
}
export async function createSession(url){url=validURL(url);const browser=await chromium.launch({headless:process.env.LINKLENSE_TEST_HEADLESS==='1'});try{const context=await browser.newContext({viewport:{width:1366,height:900}});const page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded',timeout:LIMITS.timeout}).catch(e=>{if(!e.message.includes('Timeout'))throw e;});const id=randomUUID();const session={id,browser,context,page,url,confirmed:false,busy:false,lastUsed:Date.now()};sessions.set(id,session);watchSessionBrowser(session,browser);return{id,url:page.url()}}catch(e){await browser.close();throw e}}
function watchSessionBrowser(session,browser){browser.on('disconnected',()=>{if(sessions.get(session.id)===session&&session.browser===browser)sessions.delete(session.id)});}
async function connectHeadless(s,source){
 if(s.headless){s.page=source;s.url=validURL(source.url());s.confirmed=true;return{confirmed:true,url:s.url};}
 let browser,client,script;
 try{
  const url=validURL(source.url()),storageState=await s.context.storageState({indexedDB:true}),tabStorage={};
  for(const frame of source.frames()){
   if(!/^https?:/.test(frame.url()))continue;
   const values=await frame.evaluate(()=>Object.entries(sessionStorage));
   tabStorage[new URL(frame.url()).origin]=values;
  }
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({storageState,viewport:source.viewportSize()||{width:1366,height:900}}),page=await context.newPage();
  // Seed this initial navigation only. Re-seeding on later navigations could undo logout.
  client=await context.newCDPSession(page);await client.send('Page.enable');
  script=await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`for(const [key,value] of (${JSON.stringify(tabStorage)})[location.origin]||[])sessionStorage.setItem(key,value);`});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:LIMITS.timeout});
  await page.waitForLoadState('networkidle',{timeout:1800}).catch(()=>{});
  const result=await checkLogin(page,{loginUrl:s.url,allowOriginChange:false},new URL(url).origin);
  if(!result.accepted)throw Error('The signed-in state could not be restored for background scanning. Keep the sign-in window open and retry. '+result.message);
  await client.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier});await client.detach();client=null;
  if(sessions.get(s.id)!==s)throw Error('The sign-in session was closed while connecting. Open a new session.');
  const loginBrowser=s.browser;
  Object.assign(s,{browser,context,page,url:validURL(page.url()),headless:true,confirmed:true,pageIds:new Map()});watchSessionBrowser(s,browser);
  await loginBrowser.close();
  return{confirmed:true,url:s.url};
 }catch(e){await browser?.close().catch(()=>{});throw e;}
}
export async function confirmSession(id,selection={}){
 const s=sessions.get(id);if(!s)throw Error('The sign-in window was closed or expired. Open a new session.');
 if(s.connecting)return s.connecting;
 if(s.confirmed&&s.headless)return{confirmed:true,url:s.url};
 s.connecting=selectSession(id,selection).finally(()=>{s.connecting=null});return s.connecting;
}
async function selectSession(id, selection = {}) {
 const s=sessions.get(id);
 if(!s)throw Error('The sign-in window was closed or expired. Open a new session.');
 if(s.busy)throw Error('Wait for the current audit to finish before changing the application.');
 s.lastUsed=Date.now();
 s.pageIds ||= new Map();
 const pages=s.context.pages().filter(p=>!p.isClosed());
 if(!pages.length)throw Error('The sign-in window was closed or expired. Open a new session.');
 for(const page of pages)if(!s.pageIds.has(page))s.pageIds.set(page,randomUUID());
 const accept=page=>connectHeadless(s,page);
 if(selection.pageId){
  const page=pages.find(p=>s.pageIds.get(p)===selection.pageId);
  if(!page||page.url()!==selection.url)throw Error('The selected application tab changed. Confirm sign-in again to refresh the list.');
  validURL(page.url());
  const result=await checkLogin(page,{loginUrl:s.url,allowOriginChange:true},new URL(s.url).origin);
  if(!result.accepted)throw Error(result.message);
  return accept(page);
 }
 const candidates=[];let rejection='Return to your signed-in application, then confirm again.';
 for(const page of pages){
  try{validURL(page.url())}catch{continue}
  const result=await checkLogin(page,{loginUrl:s.url},new URL(s.url).origin);
  if(result.accepted)candidates.push({page,sameOrigin:true});
  else{
   if(page===s.page)rejection=result.message;
   if(new URL(page.url()).origin!==new URL(s.url).origin){
    const cross=await checkLogin(page,{loginUrl:s.url,allowOriginChange:true},new URL(s.url).origin);
    if(cross.accepted)candidates.push({page,sameOrigin:false});
   }
  }
 }
 if(candidates.length===1&&candidates[0].sameOrigin)return accept(candidates[0].page);
 if(candidates.length)return{confirmed:false,chooseApplication:true,pages:await Promise.all(candidates.map(async({page})=>({pageId:s.pageIds.get(page),url:page.url(),title:await page.title().catch(()=>'' )})))};
 throw Error(rejection);
}
export async function closeSession(id){const s=sessions.get(id);sessions.delete(id);await s?.browser.close().catch(()=>{});}
setInterval(()=>{for(const [id,s] of sessions)if(!s.busy&&!s.connecting&&Date.now()-s.lastUsed>30*60*1000)closeSession(id)},60000).unref();

async function acquire(input,job){let s;if(input.sessionId){s=sessions.get(input.sessionId);if(!s?.confirmed)throw Error('Your sign-in session has expired. Sign in again.');if(s.busy)throw Error('This browser session is already running an audit.');if(new URL(input.url).origin!==new URL(s.url).origin)throw Error('The signed-in session belongs to a different website.');s.busy=true;s.lastUsed=Date.now();}else{const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1366,height:900}});s={browser,context,page:await context.newPage(),private:false};}job.browser=s.browser;await guard(s.context,job);return s;}
async function release(s,input){if(!s)return;await unguard(s.context);if(input.sessionId){s.busy=false;s.lastUsed=Date.now();}else await s.browser.close().catch(()=>{});}
async function navigate(page,url,force=false){
 if(force||page.url()!==url){const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:LIMITS.timeout});page._linkLenseResponse={url,status:response?.status()||0,contentType:response?.headers()['content-type']||''};}
 // Client-rendered applications can serve usable content with a non-2xx document.
 await page.waitForLoadState('networkidle',{timeout:1800}).catch(()=>{});
 return page._linkLenseResponse?.url===url?page._linkLenseResponse.status:0;
}
async function inspectPageAccess(page,job,url,httpStatus){
 if(httpStatus>=400)gap(job,url,'Document returned HTTP '+httpStatus,'Rendered content is inspected where available. This HTTP error remains unresolved even when links can be collected.');
 const state=await inspectAuthentication(page);
 if(state.signInForm||state.challenge||state.rejected){gap(job,url,'Sign-in required','A login or verification screen is visible; protected content was not inspected.');return false;}
 if(confirmedPageFailure(httpStatus,state)){gap(job,url,'Audited URL failed',`HTTP ${httpStatus}: an explicit error page was displayed. Links on this error page were not inspected.`);return false;}
 if(httpStatus>=400&&(!state.ready||state.denied)){gap(job,url,'No inspectable application content','The page is empty, unavailable, or displays an error screen.');return false;}
 return true;
}
async function links(page,origin,job,cache,steps=[]){
 const hrefs=[];
 for(const frame of page.frames()){
  let rows;try{rows=await collect(frame)}catch{gap(job,page.url(),'Frame could not be discovered',frame.url());continue;}
  for(const a of rows)if(a.source&&/^https?:/.test(a.source)&&new URL(a.source).origin===origin&&!actionURL(a.source)&&!a.download)hrefs.push(a.source);
  const scripted=rows.filter(canInspectScripted).map(a=>({...a,navigationSteps:a.navigation?steps:[]}));
  if(rows.some(a=>isScripted(a)&&!canInspectScripted(a)))gap(job,page.url(),'Some scripted controls were not traversed','Supported navigation and menus are explored. Unrecognized or action controls require manual review.');
  if(scripted.length>LIMITS.interactions)gap(job,page.url(),'Scripted navigation limit reached');
  for(let i=0;i<Math.min(scripted.length,LIMITS.interactions);i+=4){cancelled(job.signal);const results=await Promise.all(scripted.slice(i,Math.min(i+4,LIMITS.interactions)).map(a=>probe(frame,a,cache,job)));for(const result of results)if(result.interactionVerified&&new URL(result.finalURL).origin===origin)hrefs.push(result.finalURL);}
 }
 return hrefs;
}
async function expandNavigation(page,job,visit){
 const original=page.url(),used=new Set(),steps=[];
 for(let n=0;n<LIMITS.interactions;n++){
  const candidates=await page.evaluate(()=>{
   const selector=e=>{if(e.id)return '#'+CSS.escape(e.id);const parts=[];for(let x=e;x?.nodeType===1;x=x.parentElement){const siblings=x.parentElement?[...x.parentElement.children].filter(s=>s.tagName===x.tagName):[];parts.unshift(x.tagName.toLowerCase()+(siblings.length>1?`:nth-of-type(${siblings.indexOf(x)+1})`:''))}return parts.join(' > ')};
   return [...document.querySelectorAll('summary,[aria-expanded="false"],button,[role="tab"]')].filter(e=>!e.closest('form')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],[aria-hidden="true"]')).filter(e=>e.matches('summary')&&!e.parentElement.open||e.getAttribute('aria-expanded')==='false'||e.getAttribute('role')==='tab'&&e.getAttribute('aria-selected')!=='true'||/^(?:open|show|toggle) (?:main |navigation )?menu$/i.test((e.getAttribute('aria-label')||e.textContent).trim())).map(e=>({selector:selector(e),name:(e.getAttribute('aria-label')||e.textContent).trim()}));
  });
  const next=candidates.find(c=>!used.has(c.selector)&&!unsafe.test(c.name));if(!next)return;
  used.add(next.selector);cancelled(job.signal);
  try{await page.locator(next.selector).click({timeout:1800});await delay(220);await page.waitForLoadState('networkidle',{timeout:900}).catch(()=>{});
   if(validURL(page.url())!==validURL(original)){gap(job,original,'Disclosure navigated to another page',next.name);await navigate(page,original,true);steps.length=0;continue;}
   steps.push(next.selector);await visit([...steps]);
  }catch{gap(job,original,'Navigation control could not be explored',next.name);}
 }
 gap(job,original,'Navigation interaction limit reached');
}

async function scrollPage(page,job,url){let exhausted=false;for(let i=0;i<LIMITS.scrolls;i++){cancelled(job.signal);const atEnd=await page.evaluate(()=>{window.scrollBy(0,Math.max(400,innerHeight*.8));return scrollY+innerHeight>=document.documentElement.scrollHeight-3});await delay(130);if(atEnd){const still=await page.evaluate(()=>scrollY+innerHeight>=document.documentElement.scrollHeight-3);if(still){exhausted=true;break;}}}if(!exhausted)gap(job,url,'Scroll limit reached','Lazy or infinite content may remain undiscovered.');await page.evaluate(()=>scrollTo(0,0));}
export async function discover(input,job){
 let s;try{
  s=await acquire(input,job);const origin=new URL(input.url).origin,queue=[...new Set([input.url,origin+'/'])],seen=new Set(),canonical=new Set(),pages=[],resources=new Set(),cache=new Map();
  const enqueue=raw=>{let url;try{url=validURL(raw)}catch{return;}if(new URL(url).origin!==origin||seen.has(url)||queue.includes(url)||actionURL(url))return;if(queue.length<LIMITS.queue)queue.push(url);else gap(job,input.url,'Discovery queue limit reached');};
  while(queue.length&&seen.size<LIMITS.pages){
   cancelled(job.signal);const url=queue.shift();if(seen.has(url))continue;seen.add(url);job.progress={message:`Discovering website: ${pages.length} pages found`,done:seen.size,total:seen.size+queue.length};
   try{
    const status=await navigate(s.page,url,true);if(!await inspectPageAccess(s.page,job,url,status))continue;
    const final=validURL(s.page.url()),contentType=s.page._linkLenseResponse?.contentType;if(contentType&&!/^(?:text\/html|application\/xhtml\+xml)\b/i.test(contentType)){resources.add(final);continue;}if(new URL(final).origin!==origin){gap(job,url,'Redirected outside website');continue;}if(canonical.has(final))continue;canonical.add(final);
    pages.push({url:final,path:new URL(final).pathname+new URL(final).search+new URL(final).hash,title:await s.page.title()});
    for(const viewport of [{name:'Desktop',width:1366,height:900},{name:'Mobile',width:390,height:844}].filter(v=>(input.viewports||['Desktop','Mobile']).includes(v.name))){
     await s.page.setViewportSize(viewport);await navigate(s.page,final,true);if(!await inspectPageAccess(s.page,job,final,s.page._linkLenseResponse?.status))continue;cache.clear();
     const collectState=async steps=>{await scrollPage(s.page,job,final);for(const href of await links(s.page,origin,job,cache,steps))enqueue(href);};
     await collectState([]);await expandNavigation(s.page,job,collectState);
    }
   }catch(e){cancelled(job.signal);gap(job,url,'Page could not be discovered',e.message.split('\n')[0]);}
  }
  if(resources.size)gap(job,input.url,'Linked files excluded from page discovery',`${resources.size} non-HTML destinations are checked as links, not crawled as application pages.`);
  if(queue.length)gap(job,input.url,'Page discovery limit reached',`${queue.length} queued pages remain; limit ${LIMITS.pages}.`);
  return{pages,gaps:job.gaps,complete:false,limits:LIMITS,discovery:{origin,seeds:[input.url,origin+'/'],visited:seen.size,remaining:queue.length,linkedResources:resources.size,viewports:input.viewports||['Desktop','Mobile']}};
 }finally{await release(s,input);}
}

// Read link semantics without activating destinations or controls.
async function collect(frame){return frame.evaluate(()=>{
 const out=[];
 function selector(el){if(el.id)return '#'+CSS.escape(el.id);const parts=[];for(let n=el;n?.nodeType===1;n=n.parentElement){let p=n.tagName.toLowerCase();const siblings=n.parentElement?[...n.parentElement.children].filter(x=>x.tagName===n.tagName):[];if(siblings.length>1)p+=`:nth-of-type(${siblings.indexOf(n)+1})`;parts.unshift(p)}return parts.join(' > ')}
 function walk(root,prefix=''){for(const el of root.querySelectorAll('*')){if(el.shadowRoot)walk(el.shadowRoot,prefix+selector(el)+' >>> ');if(!el.matches('a[href],area[href],a[role="button"],[role="link"]'))continue;
 const refs=(el.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>el.getRootNode().getElementById?.(id)?.textContent||'').join(' ').trim();
 function nameText(node,referenced=false){
  if(node.nodeType===Node.TEXT_NODE)return node.textContent;
  if(node.nodeType!==Node.ELEMENT_NODE)return '';
  const st=getComputedStyle(node);
  if(!referenced&&(node.hidden||node.getAttribute('aria-hidden')==='true'||st.display==='none'||st.visibility==='hidden'))return '';
  if(node.getAttribute('aria-label')?.trim())return node.getAttribute('aria-label').trim();
  if(node.tagName==='IMG'||node.tagName==='AREA')return node.getAttribute('alt')||'';
  return [...node.childNodes].map(n=>nameText(n,referenced)).join(' ');
 }
 const text=nameText(el).trim().replace(/\s+/g,' ');
 const accessibleName=refs||el.getAttribute('aria-label')?.trim()||text||el.getAttribute('alt')||el.getAttribute('title')||'';
 const raw=el.getAttribute('href'),style=getComputedStyle(el),r=el.getBoundingClientRect();let source='',malformed=false;
 if(raw!==null)try{source=new URL(raw,document.baseURI).href}catch{malformed=true}
 let fragmentExists=null;if(source)try{const u=new URL(source),here=new URL(location.href);if(u.origin===here.origin&&u.pathname===here.pathname&&u.search===here.search&&u.hash&&!/^#(?:\/|!)/.test(u.hash)){const id=decodeURIComponent(u.hash.slice(1));fragmentExists=!!(document.getElementById(id)||[...document.getElementsByName(id)].length||id==='top')}}catch{}
 let hidden=false;for(let n=el;n;n=n.parentElement||n.getRootNode()?.host){const st=getComputedStyle(n);if(n.hidden||n.inert||n.getAttribute('aria-hidden')==='true'||st.display==='none'||st.visibility==='hidden')hidden=true}
 out.push({selector:prefix+selector(el),type:el.getAttribute('role')==='button'?'Scripted control':el.getAttribute('role')==='link'?'ARIA link':el.tagName==='AREA'?'Image map link':'Anchor',source,raw,malformed,withinForm:!!el.closest('form'),text,accessibleName,alt:accessibleName,hidden,navigation:!!el.closest('nav,[role="navigation"]'),expandable:el.hasAttribute('aria-expanded'),fragmentExists,target:el.getAttribute('target')||'',rel:el.getAttribute('rel')||'',tabIndex:el.tabIndex,download:el.hasAttribute('download'),title:el.title||'',tooltip:el.title||'',html:el.outerHTML.slice(0,2000),width:r.width,height:r.height});
 }}walk(document);return out;
})}
function finding(code,severity,message,fix){return{code,severity,message,fix}}
function validate(a){const f=[],add=(...v)=>f.push(finding(...v));
 if((a.raw===null||!a.raw.trim()||a.raw.trim()==='#')&&!a.interactionVerified&&!a.confirmedBroken)add('scripted-destination','unverified','This control uses a scripted action whose destination was not verified.','Unverified, not a confirmed failure. Excluded from the destination success rate; review its action in the signed-in application.');
 if(a.malformed)add('invalid-url','broken','Destination is not a valid URL.','Correct the href URL.');
 if(a.confirmedBroken)add('http-failure','broken',a.failureKind==='server-error'?`The destination returned HTTP ${a.httpStatus} with a server-error page during browser verification.`:`The destination displayed a not-found page in the browser (HTTP ${a.httpStatus}).`,a.failureKind==='server-error'?'Retry the destination and investigate its server error. This records a failure at scan time, not permanent unavailability.':'Check this destination using the same account and permissions.');
 if(a.reason)add('destination-unverified','unverified',a.reason,'Verify this destination manually in the intended user session.');
 if(a.fragmentExists===false)add('missing-fragment','broken','The fragment target does not exist in the current document.','Correct the fragment or add the matching element ID.');
 if(a.source.startsWith('javascript:'))add('script-destination','review','This link runs script instead of identifying a destination.','Use a button for actions, or provide a real navigation URL.');
 if(!a.hidden){if(!a.accessibleName.trim())add('missing-link-name','alt','Link has no accessible name.','Provide meaningful link text or an accessible label.');
 else if(/^(click here|here|read more|learn more|more|link|go)$/i.test(a.accessibleName.trim()))add('generic-link-name','review','The link name may not explain its destination without context.','Use descriptive text and review surrounding programmatic context.');
 if(a.tabIndex<0)add('keyboard-unreachable','alt','Link is excluded from the normal keyboard tab order.','Ensure keyboard users can reach and activate this destination.');
 if(a.target==='_blank'&&!/new (tab|window)/i.test(a.accessibleName+' '+a.title))add('new-window-review','review','Link opens a new tab or window without a recorded warning.','Consider telling users when the browsing context changes.');}
 if(a.redirects?.length)add('redirect','performance',`Destination redirects ${a.redirects.length} time(s).`,'Use the final URL when it is stable and appropriate.');
 if(a.source.startsWith('http:')&&a.page.startsWith('https:'))add('insecure-destination','review','An HTTPS page links to an unencrypted HTTP destination.','Use HTTPS if supported by the destination.');
 return f;
}
function isScripted(a){return a.raw===null||!a.raw.trim()||a.raw.trim()==='#'}
function canInspectScripted(a){return isScripted(a)&&!a.hidden&&!a.withinForm&&a.target!=='_blank'&&!a.expandable&&!unsafe.test(a.accessibleName)&&(a.navigation&&!!a.accessibleName.trim()||/^(view (?:details|product|cart)|back to (?:products|catalog)|all items|cart\b|continue shopping\b)/i.test(a.accessibleName.trim()))}
async function probe(frame,a,cache,job){
 const scripted=isScripted(a);
 if(scripted&&!canInspectScripted(a))return{loaded:false,verification:'scripted-control'};
 if((!a.source&&!scripted)||a.malformed)return{loaded:false};
 const initial=new URL(scripted?frame.url():a.source),origin=new URL(frame.url()).origin;
 if(!['http:','https:'].includes(initial.protocol))return{loaded:false,reason:`${initial.protocol} destination requires manual verification; it was not activated.`};
 if(initial.username||initial.password)return{loaded:false,reason:'URL contains embedded credentials; request skipped.'};
 if(a.download||actionURL(initial.href))return{loaded:false,reason:'Download or potential action destination was not activated.'};
 if(a.fragmentExists!==null)return{loaded:a.fragmentExists,finalURL:a.source,verification:'rendered-fragment'};
 const sessionValues=await frame.evaluate(()=>{try{return Object.entries(sessionStorage)}catch{return null}}).catch(()=>null);
 if(sessionValues===null)return{loaded:false,reason:'Browser session storage could not be preserved; destination was not verified.'};
 const viewport=frame.page().viewportSize();
 const key=JSON.stringify([a.source,scripted?a.selector:null,a.navigationSteps||[],origin,viewport,sessionValues]);
 if(!cache.has(key)){
 if(cache.size>=LIMITS.destinations)return{loaded:false,reason:'Destination verification limit reached.'};
 cache.set(key,(async()=>{
 let tab;try{
 cancelled(job.signal);tab=await frame.page().context().newPage();await guardPage(frame.page().context(),tab,job);if(viewport)await tab.setViewportSize(viewport);
 await tab.addInitScript(({origin,values})=>{if(location.origin===origin)for(const [key,value]of values)sessionStorage.setItem(key,value)},{origin,values:sessionValues});
 let response=await tab.goto(initial.href,{waitUntil:'domcontentloaded',timeout:LIMITS.resourceTimeout});
 await tab.waitForLoadState('networkidle',{timeout:1200}).catch(()=>{});cancelled(job.signal);
 const sourceDocumentStatus=response?.status()||0;
 if(scripted){
  const sourceURL=tab.url();let interactionResponse=null;
  tab.on('popup',popup=>popup.close().catch(()=>{}));
  tab.on('response',r=>{if(r.frame()===tab.mainFrame()&&r.request().resourceType()==='document')interactionResponse=r});
  const sourceState=await inspectAuthentication(tab);if(sourceState.signInForm||sourceState.challenge||sourceState.denied)return{loaded:false,reason:'Source application was not available in the verification tab.'};
  for(const selector of a.navigationSteps||[]){await tab.locator(selector).click({timeout:2000});await delay(180);}
  await tab.locator(a.selector).click({timeout:2500});
  await tab.waitForURL(u=>u.href!==sourceURL,{timeout:2500}).catch(()=>{});
  await tab.waitForLoadState('networkidle',{timeout:1200}).catch(()=>{});cancelled(job.signal);
  if(tab.url().replace(/#$/,'')===sourceURL.replace(/#$/,''))return{loaded:false,verification:'browser-interaction',reason:'The control did not expose a navigation destination during the bounded interaction check.'};
  response=interactionResponse;
 }
 const httpStatus=response?.status()||0,finalURL=tab.url(),state=await inspectAuthentication(tab);
 const redirects=[];let request=response?.request();while(request?.redirectedFrom()){request=request.redirectedFrom();redirects.unshift({url:request.url()})}
 const evidence={httpStatus,finalURL,redirects,verification:scripted?'browser-interaction':'browser-session',...(scripted?{sourceDocumentStatus}:{}),loaded:false};
 if(state.signInForm||state.challenge||state.rejected)return{...evidence,reason:'Destination requires sign-in or verification in the browser; it is not confirmed broken.'};
 if([401,403,429].includes(httpStatus))return{...evidence,reason:`Browser returned HTTP ${httpStatus}; access or rate limits prevent verification.`};
 const failureKind=confirmedPageFailure(httpStatus,state);
 if(failureKind)return{...evidence,confirmedBroken:true,failureKind};
 if(new URL(finalURL).origin!==origin&&httpStatus>=400)return{...evidence,reason:`External destination returned HTTP ${httpStatus}; access restrictions cannot be ruled out.`};

 if(httpStatus>=200&&httpStatus<300&&/^(?:image\/|audio\/|video\/|application\/pdf(?:;|$))/i.test(response?.headers()['content-type']||''))return{...evidence,loaded:true,verification:'browser-resource'};
 if(!state.ready||state.denied)return{...evidence,reason:'Destination content was empty or an error screen; verification is inconclusive.'};
 if(httpStatus>=400)return{...evidence,loaded:true,reason:`Browser rendered content despite HTTP ${httpStatus}. Review the document response; the link is not confirmed broken.`};
 if(scripted)return{...evidence,loaded:true,interactionVerified:true};
 if(httpStatus===0)return{...evidence,reason:'No document response was available.'};
 if(initial.hash&&!/^#(?:\/|!)/.test(initial.hash)){
  const found=await tab.evaluate(hash=>{try{const id=decodeURIComponent(hash.slice(1));return id==='top'||!!document.getElementById(id)||document.getElementsByName(id).length>0}catch{return false}},initial.hash);
  if(!found)return{...evidence,loaded:true,reason:'Destination rendered, but its fragment target was not found. Dynamic content requires review.'};
 }
 return{...evidence,loaded:true};
 }catch(e){cancelled(job.signal);return{loaded:false,verification:'browser-session',reason:'Browser destination verification failed or timed out: '+e.message.split('\n')[0]}}
 finally{await tab?.close().catch(()=>{})}
 })());
 }
 return await cache.get(key);
}
// Keep six probes active without waiting for an entire batch's slowest destination.
async function mapConcurrent(items,limit,fn){const results=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)return;results[i]=await fn(items[i],i)}}));return results;}
async function snapshots(page,job,url,viewport,assets,seen,cache,network,state,steps=[]){let count=0;
 for(const [fi,frame]of page.frames().entries()){cancelled(job.signal);let rows;try{rows=await collect(frame)}catch{gap(job,url,'Frame could not be inspected',frame.url());continue}
 const candidates=rows.filter(a=>{const key=JSON.stringify([url,viewport,fi,a.selector,a.source,a.accessibleName,a.hidden,a.tabIndex,a.target,a.rel,a.fragmentExists]);if(seen.has(key))return false;seen.add(key);return true;});
 let completed=0;job.progress||={};job.progress.linkChecks={completed,total:candidates.length};
 const results=await mapConcurrent(candidates,6,async a=>{
  a.navigationSteps=steps;const verification=await probe(frame,a,cache,job),asset={...a,...verification,id:randomUUID(),page:url,frame:frame.url(),viewport,state,bytes:0,variantResults:[],name:a.accessibleName||a.source||'Unnamed link'};
  asset.issues=validate(asset);asset.status=['broken','alt','unverified','review','performance'].find(k=>asset.issues.some(f=>f.severity===k))||'pass';job.progress.linkChecks.completed=++completed;return asset;
 });
 assets.push(...results);count+=results.length;
 }return count;
}

async function controls(page){return page.evaluate(()=>[...document.querySelectorAll('summary,[role="tab"],button[aria-expanded],button[aria-label]')].map((e,index)=>({index,name:e.getAttribute('aria-label')||e.textContent||'',tag:e.tagName,role:e.getAttribute('role'),expanded:e.getAttribute('aria-expanded'),selected:e.getAttribute('aria-selected'),form:!!e.closest('form'),visible:!!e.getClientRects().length})).filter(e=>e.visible&&!e.form&&e.expanded!=='true'&&e.selected!=='true'))}
export async function scan(input,job){let s,responseListener;const start=Date.now(),assets=[],pageResults=[],seen=new Set();try{s=await acquire(input,job);const urls=[...new Set(input.pages.map(validURL))];const network=new Map(),cache=new Map();responseListener=response=>{const h=response.headers();if(response.request().resourceType()==='image')network.set(response.url(),{httpStatus:response.status(),mime:h['content-type']||'',bytes:Number(h['content-length'])||0})};s.context.on('response',responseListener);for(let pi=0;pi<urls.length;pi++){const url=urls[pi];const viewports=[{name:'Desktop',width:1366,height:900},{name:'Mobile',width:390,height:844}].filter(v=>(input.viewports||['Desktop','Mobile']).includes(v.name));for(const [vi,viewport] of viewports.entries()){cancelled(job.signal);job.progress={message:`Inspecting ${new URL(url).pathname} · ${viewport.name}`,done:pi*viewports.length+vi,total:urls.length*viewports.length,links:assets.length};let entry={url,viewport:viewport.name,status:'checked',links:0,states:0};pageResults.push(entry);try{cache.clear();await s.page.setViewportSize(viewport);entry.httpStatus=await navigate(s.page,url,true);if(new URL(s.page.url()).origin!==new URL(input.url).origin){gap(job,url,'Page redirected outside selected website');entry.status='unverified';continue;}const failureKind=confirmedPageFailure(entry.httpStatus,await inspectAuthentication(s.page));if(failureKind){
 entry.status='broken';entry.failureKind=failureKind;entry.finalURL=s.page.url();
 const asset={id:randomUUID(),type:'Audited URL',auditedURL:true,name:'Audited URL: '+url,source:url,raw:url,page:url,frame:s.page.url(),finalURL:s.page.url(),viewport:viewport.name,state:'Audited page response',selector:'Document response (not a link element)',html:'',accessibleName:'Audited URL',hidden:true,fragmentExists:null,loaded:false,confirmedBroken:true,failureKind,httpStatus:entry.httpStatus,verification:'browser-page',bytes:0,variantResults:[]};
 asset.issues=validate(asset);asset.status='broken';assets.push(asset);gap(job,url,'Audited URL failed',`HTTP ${entry.httpStatus}: an explicit error page was displayed. Links on this error page were not inspected.`);continue;
 }if(!await inspectPageAccess(s.page,job,url,entry.httpStatus)){entry.status='unverified';continue}await scrollPage(s.page,job,url);entry.links+=await snapshots(s.page,job,url,viewport.name,assets,seen,cache,network,'Initial page');entry.states++;await expandNavigation(s.page,job,async steps=>{await scrollPage(s.page,job,url);entry.links+=await snapshots(s.page,job,url,viewport.name,assets,seen,cache,network,'Expanded navigation',steps);entry.states++;});
 const residual=await s.page.locator('canvas,iframe,button,[role="button"]').count();if(residual)gap(job,url,'Additional interaction or embedded content may exist','Forms, unrecognized controls, closed shadow roots, canvas semantics, and exhaustive navigation journeys require manual review.');
 }catch(e){cancelled(job.signal);entry.status='unverified';gap(job,url,'Page inspection failed',e.message.split('\n')[0]);}}}
 const counted=new Set(assets.filter(a=>!a.auditedURL).map(a=>a.page+'|'+a.frame+'|'+a.selector+'|'+a.source));return{id:randomUUID(),date:new Date().toISOString(),durationMs:Date.now()-start,url:input.url,access:input.sessionId?'private':'public',scope:input.scope||'Selected pages',viewports:input.viewports||['Desktop','Mobile'],pages:urls,assets,pageResults,unverified:job.gaps.length,sampleData:false,coverage:{complete:false,discoveredOccurrences:assets.length,elementOccurrences:counted.size,failedPageChecks:assets.filter(a=>a.auditedURL).length,uniqueResources:new Set(assets.map(a=>a.source).filter(Boolean)).size,gaps:job.gaps,limits:LIMITS,note:'Counts include discovered link occurrences and explicitly labeled failed audited URLs, with viewport-specific observations. A checked page does not imply every possible state was discovered.'}};
 }finally{if(s&&responseListener)s.context.off('response',responseListener);await release(s,input)}}
