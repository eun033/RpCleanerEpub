import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const bridgeDir=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const server=path.join(bridgeDir,'src','server.mjs');

export async function supervise({spawnImpl=spawn,node=process.execPath,execArgv=process.execArgv,env=process.env,stdio='inherit'}={}){for(;;){
  const code=await new Promise((resolve,reject)=>{
    const child=spawnImpl(node,[...execArgv,server],{cwd:bridgeDir,env:{...env,GPT_BRIDGE_SUPERVISED:'1'},stdio});
    child.once('error',reject);child.once('exit',value=>resolve(value??1));
  }).catch(error=>{console.error('GPT 브리지를 시작하지 못했습니다.',error.message);return 1;});
  if(code!==75)return code;
}}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exit(await supervise());
