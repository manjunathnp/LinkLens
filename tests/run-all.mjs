process.env.LINKLENSE_TEST_HEADLESS='1';
import {spawn} from 'node:child_process';
for(const test of ['integration','authentication','viewports','rendered-error','authenticated-destinations','history','runtime-version','headless-and-scoring','site-navigation','error-evidence-and-queue','direct-error-pages','design-system','verification-separation']){
 console.log('Running '+test);
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[`tests/${test}.mjs`],{cwd:new URL('..',import.meta.url),stdio:'inherit'});child.on('error',reject);child.on('exit',resolve)});
 if(code!==0)process.exit(code||1);
}
console.log('All thirteen regression suites passed.');
