import assert from 'node:assert/strict';
import {mkdtemp,copyFile,mkdir,symlink,appendFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
const root=new URL('..',import.meta.url).pathname,temp=await mkdtemp(join(tmpdir(),'linklense-runtime-')),base='http://127.0.0.1:4390';let child;
async function start(){child=spawn(process.execPath,['server.js'],{cwd:temp,env:{...process.env,PORT:'4390'},stdio:'pipe'});for(let i=0;i<80;i++){try{return await(await fetch(base+'/api/health')).json()}catch{await new Promise(r=>setTimeout(r,100))}}throw Error('Server failed to start')}
async function stop(){const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exited}
try{await mkdir(join(temp,'src'));await mkdir(join(temp,'brand'));await mkdir(join(temp,'assets/fonts'),{recursive:true});for(const f of ['server.js','src/scanner.js','src/authentication.js','app.js','index.html','styles.css','theme.js','lens-tokens.css','brand/linklens-logo-v2.png','assets/fonts/geist-latin.woff2','package.json'])await copyFile(join(root,f),join(temp,f));await symlink(join(root,'node_modules'),join(temp,'node_modules'),'dir');
const original=await start();assert.equal(original.restartRequired,false);const js=await(await fetch(base+'/app.js')).text();assert.ok(js.includes(original.buildId));
await appendFile(join(temp,'src/scanner.js'),'\n// Runtime update regression fixture\n');await appendFile(join(temp,'app.js'),'\n// New frontend code\n');const stale=await(await fetch(base+'/api/health')).json();assert.equal(stale.restartRequired,true);assert.equal(await(await fetch(base+'/app.js')).text(),js,'Existing process must serve its own UI snapshot');
let response=await fetch(base+'/api/jobs',{method:'POST',headers:{'X-LinkLense':'1','Content-Type':'application/json'},body:JSON.stringify({kind:'scan',url:'https://example.com/',pages:['https://example.com/']})});assert.equal(response.status,409);assert.match((await response.json()).error,/old scanner/);
await stop();const updated=await start();assert.notEqual(updated.buildId,original.buildId);assert.equal(updated.restartRequired,false);
response=await fetch(base+'/api/sessions',{method:'POST',headers:{'X-LinkLense':'1','X-LinkLense-Build':original.buildId,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,409);assert.match((await response.json()).error,/Refresh/);console.log('Runtime version regression passed: build identity, restart detection, matching frontend snapshot, stale-server scan blocking, new build after restart, and stale-tab rejection.');
}finally{if(child?.exitCode===null)await stop();await rm(temp,{recursive:true,force:true})}
