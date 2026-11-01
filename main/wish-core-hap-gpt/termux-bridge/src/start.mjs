import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const bridgeDir=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const server=path.join(bridgeDir,'src','server.mjs');

for(;;){
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[server],{cwd:bridgeDir,env:{...process.env,GPT_BRIDGE_SUPERVISED:'1'},stdio:'inherit'});
    child.once('error',reject);child.once('exit',value=>resolve(value??1));
  }).catch(error=>{console.error('GPT 브리지를 시작하지 못했습니다.',error.message);return 1;});
  if(code!==75)process.exit(code);
}
