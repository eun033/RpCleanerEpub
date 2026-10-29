import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BridgeError,check,equal} from './auth.mjs';
import {JobBridge} from './jobs.mjs';
export const DEFAULT_PORT=17446;
const ROOT=fileURLToPath(new URL('./',import.meta.url));
function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function readBody(req){let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;check(bytes<=5000000,'BODY_SIZE','요청이 너무 큽니다.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw new BridgeError('JSON','요청 JSON을 확인하세요.');}}
function command(file,args,cwd){return new Promise((resolve,reject)=>{const child=spawn(file,args,{cwd,stdio:['ignore','pipe','pipe']}),chunks=[];for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{if(chunks.reduce((n,x)=>n+x.length,0)<100000)chunks.push(chunk);});child.on('error',reject);child.on('close',code=>code===0?resolve(Buffer.concat(chunks).toString('utf8').trim()):reject(new BridgeError('UPDATE_FAILED','업데이트하지 못했습니다. Termux에서 git 상태와 인터넷 연결을 확인하세요. ('+Buffer.concat(chunks).toString('utf8').trim().split('\n').slice(-1)[0]+')',500)));});}
export function classifyUpdate({local,remote,base,dirty,currentVersion,latestVersion}){
  if(dirty)return 'local_changes';
  if(local===remote&&currentVersion===latestVersion)return 'current';
  if(base===local||local===remote)return 'available';
  if(base===remote)return 'local_ahead';
  return 'diverged';
}
export async function createServer({dir=path.join(os.homedir(),'.local-gpt-subscription-bridge'),fetchImpl=globalThis.fetch,clock=Date.now,appName='Local GPT Subscription Bridge',onRestart=null,onUpdateCheck=null,onUpdate=null}={}){
  const bridge=await new JobBridge(dir,{fetchImpl,clock,appName}).init();
  let updateBusy=false;const restartBusy=()=>updateBusy||bridge.running||[...bridge.jobs.values()].some(job=>['queued','running'].includes(job.status));
  const server=http.createServer(async(req,res)=>{
    const port=server.address()?.port,base='http://127.0.0.1:'+port;
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
    if(req.headers.host!=='127.0.0.1:'+port)return send(res,403,{code:'HOST',message:'127.0.0.1 주소로 연결하세요.'});
    const origin=req.headers.origin;
    // Cross-origin API calls still require the installation's random pair code.
    if(origin&&/^https?:\/\//.test(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'});res.end();return;}
    try{
      const url=new URL(req.url,base);
      if(url.pathname==='/auth/callback'&&req.method==='GET'){
        await bridge.auth.finishLogin(url);res.writeHead(303,{Location:'/#pair='+bridge.auth.identity.pair});res.end();return;
      }
      const assets={'/':['dashboard.html','text/html'],'/app.js':['dashboard.js','application/javascript']};
      if(req.method==='GET'&&Object.hasOwn(assets,url.pathname)){
        const [file,type]=assets[url.pathname];res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
        res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(await fs.readFile(path.join(ROOT,file)));return;
      }
      check(equal(req.headers.authorization||'','Bearer '+bridge.auth.identity.pair),'PAIR','관리 화면에서 복사한 로컬 연결 코드가 필요합니다.',401);
      if(req.method==='GET'&&url.pathname==='/api/status')return send(res,200,{...bridge.status(),can_restart:typeof onRestart==='function',restart_busy:restartBusy(),can_update:typeof onUpdate==='function',update_busy:updateBusy});
      if(req.method==='GET'&&url.pathname==='/api/update/check'){
        check(typeof onUpdateCheck==='function','UPDATE_UNAVAILABLE','기본 저장소에서 설치한 브리지만 업데이트를 확인할 수 있습니다.',409);
        check(!updateBusy,'BUSY','업데이트 작업이 끝난 뒤 다시 확인하세요.',409);
        updateBusy=true;try{return send(res,200,await onUpdateCheck());}finally{updateBusy=false;}
      }
      if(req.method==='GET'&&url.pathname==='/api/models')return send(res,200,await bridge.auth.models());
      if(req.method==='POST'&&url.pathname==='/api/login'){check(!bridge.running,'BUSY','진행 중인 작업이 끝난 뒤 로그인하세요.',409);return send(res,200,{url:bridge.auth.startLogin(port)});}
      if(req.method==='POST'&&url.pathname==='/api/logout'){check(!bridge.running,'BUSY','진행 중인 작업이 끝난 뒤 연결을 해제하세요.',409);await bridge.auth.logout();await bridge.settingsChange({paused:true});return send(res,200,{ok:true});}
      if(req.method==='POST'&&url.pathname==='/api/settings')return send(res,200,await bridge.settingsChange(await readBody(req)));
      if(req.method==='POST'&&url.pathname==='/api/restart'){
        check(typeof onRestart==='function','RESTART_UNAVAILABLE','start.sh로 서버를 실행한 경우에만 관리 화면에서 재시작할 수 있습니다.',409);
        check(!restartBusy(),'BUSY','대기·진행 중인 작업이 끝난 뒤 재시작하세요.',409);
        send(res,202,{ok:true});setImmediate(()=>onRestart({server,bridge}));return;
      }
      if(req.method==='POST'&&url.pathname==='/api/update'){
        check(typeof onUpdate==='function','UPDATE_UNAVAILABLE','기본 저장소에서 설치한 브리지만 관리 화면에서 업데이트할 수 있습니다.',409);
        check(!restartBusy(),'BUSY','대기·진행 중인 작업이 끝난 뒤 업데이트하세요.',409);
        updateBusy=true;try{const result=await onUpdate();send(res,200,{ok:true,...result});if(result.updated!==false)setImmediate(()=>onRestart({server,bridge}));}finally{updateBusy=false;}return;
      }
      if(req.method==='POST'&&url.pathname==='/api/jobs')return send(res,202,await bridge.add(await readBody(req)));
      const match=url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]{16,100})(?:\/(resume))?$/);
      if(match&&req.method==='GET'&&!match[2])return send(res,200,bridge.get(match[1]));
      if(match&&req.method==='POST'&&match[2]==='resume')return send(res,200,await bridge.resume(match[1]));
      send(res,404,{code:'PATH',message:'없는 경로입니다.'});
    }catch(error){send(res,error instanceof BridgeError?error.status:500,{code:error instanceof BridgeError?error.code:'LOCAL_ERROR',message:error instanceof BridgeError?error.message:'로컬 처리 중 오류가 발생했습니다. 같은 요청을 자동으로 다시 보내지 마세요.'});}
  });
  return {server,bridge};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.GPT_BRIDGE_PORT||DEFAULT_PORT);
  check(Number.isInteger(port)&&port>=1024&&port<=65535,'PORT','사용할 포트를 확인하세요.');
  const supervised=process.env.GPT_BRIDGE_SUPERVISED==='1',source=path.resolve(process.env.GPT_BRIDGE_SOURCE||path.join(os.homedir(),'RpCleanerEpub','main','wish-core-hap-gpt','termux-bridge')),repo=path.resolve(source,'../../..');
  const restart=supervised?({server,bridge})=>{bridge.close();server.close(()=>process.exit(75));}:null;
  const canUpdate=supervised&&await fs.stat(path.join(repo,'.git')).then(stat=>stat.isDirectory(),()=>false)&&await fs.stat(path.join(source,'update-termux.sh')).then(stat=>stat.isFile(),()=>false);
  const checkUpdate=canUpdate?async()=>{
    await command('git',['fetch','--quiet','origin','main'],repo);
    const [local,remote,base,dirty,currentPackage,latestPackage]=await Promise.all([
      command('git',['rev-parse','HEAD'],repo),command('git',['rev-parse','origin/main'],repo),command('git',['merge-base','HEAD','origin/main'],repo),command('git',['status','--porcelain','--untracked-files=no'],repo),
      fs.readFile(path.join(ROOT,'..','package.json'),'utf8'),command('git',['show','origin/main:main/wish-core-hap-gpt/termux-bridge/package.json'],repo)
    ]);
    const currentVersion=JSON.parse(currentPackage).version,latestVersion=JSON.parse(latestPackage).version;
    const status=classifyUpdate({local,remote,base,dirty,currentVersion,latestVersion});
    return {status,current_version:currentVersion,latest_version:latestVersion,current_commit:local.slice(0,7),latest_commit:remote.slice(0,7),checked_at:Date.now()};
  }:null;
  const update=canUpdate?async()=>{const state=await checkUpdate();check(state.status==='available','UPDATE_STATE',({current:'이미 최신 버전입니다.',local_changes:'저장소에 직접 수정한 파일이 있어 자동 업데이트하지 않았습니다.',local_ahead:'로컬 저장소에 원격보다 앞선 커밋이 있어 자동 업데이트하지 않았습니다.',diverged:'로컬과 원격 기록이 갈라져 자동 업데이트하지 않았습니다.'})[state.status]||'업데이트 상태를 다시 확인하세요.',409);await command('git',['pull','--ff-only','origin','main'],repo);await command('bash',[path.join(source,'update-termux.sh')],source);return {updated:true,message:'새 버전을 적용했습니다. 서버를 다시 시작합니다.'};}:null;
  const {server,bridge}=await createServer({onRestart:restart,onUpdateCheck:checkUpdate,onUpdate:update});
  server.listen(port,'127.0.0.1',()=>console.log('\nGPT 브리지 0.2.5\n관리 화면: http://127.0.0.1:'+port+'/#pair='+bridge.auth.identity.pair+'\n각자 본인 계정으로 로그인하세요. 종료: Ctrl+C\n'));
  server.on('error',error=>{bridge.close();console.error(error.code==='EADDRINUSE'?'해당 포트가 이미 사용 중입니다. 기존 서버를 확인하거나 GPT_BRIDGE_PORT를 바꾸세요.':'서버를 시작하지 못했습니다.');process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{bridge.close();server.close(()=>process.exit(0));});
}
