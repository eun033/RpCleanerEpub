import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {BridgeError,check,equal} from './auth.mjs';
import {JobBridge} from './jobs.mjs';
export const DEFAULT_PORT=17446;
const ROOT=fileURLToPath(new URL('./',import.meta.url));
const PUBLIC_RELEASE_API='https://api.github.com/repos/eun033/RpCleanerEpub/contents/main/wish-core-hap-gpt?ref=main';
const PUBLIC_PACKAGE_API='https://api.github.com/repos/eun033/RpCleanerEpub/contents/main/wish-core-hap-gpt/termux-bridge/package.json?ref=main';
function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function readBody(req){let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;check(bytes<=5000000,'BODY_SIZE','요청이 너무 큽니다.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw new BridgeError('JSON','요청 JSON을 확인하세요.');}}
function command(file,args,cwd){return new Promise((resolve,reject)=>{const child=spawn(file,args,{cwd,stdio:['ignore','pipe','pipe']}),chunks=[];for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{if(chunks.reduce((n,x)=>n+x.length,0)<100000)chunks.push(chunk);});child.on('error',reject);child.on('close',code=>code===0?resolve(Buffer.concat(chunks).toString('utf8').trim()):reject(new BridgeError('UPDATE_FAILED','업데이트 명령을 실행하지 못했습니다. 인터넷 연결과 설치 상태를 확인하세요. ('+Buffer.concat(chunks).toString('utf8').trim().split('\n').slice(-1)[0]+')',500)));});}
function commandExists(name){return new Promise(resolve=>{const child=spawn('sh',['-c','command -v "$1" >/dev/null 2>&1','sh',name],{stdio:'ignore'});child.on('error',()=>resolve(false));child.on('close',code=>resolve(code===0));});}
export function classifyUpdate({local,remote,base,dirty,currentVersion,latestVersion}){
  if(dirty)return 'local_changes';
  if(local===remote&&currentVersion===latestVersion)return 'current';
  if(base===local||local===remote)return 'available';
  if(base===remote)return 'local_ahead';
  return 'diverged';
}
export function compareVersions(a,b){const left=String(a).split('.').map(Number),right=String(b).split('.').map(Number);for(let i=0;i<Math.max(left.length,right.length);i++){const difference=(left[i]||0)-(right[i]||0);if(difference)return Math.sign(difference);}return 0;}
export function selectZipRelease(entries){return entries.filter(entry=>/^Wish_RP_Core_HAP_GPT_\d+\.\d+\.\d+\.zip$/.test(entry?.name||'')&&String(entry.download_url||'').startsWith('https://raw.githubusercontent.com/eun033/RpCleanerEpub/')&&String(entry.git_url||'').startsWith('https://api.github.com/repos/eun033/RpCleanerEpub/git/blobs/')).sort((a,b)=>compareVersions(a.name.match(/_(\d+\.\d+\.\d+)\.zip$/)[1],b.name.match(/_(\d+\.\d+\.\d+)\.zip$/)[1])).at(-1)||null;}
export function validZipEntries(entries){const prefix='wish-core-hap-gpt/termux-bridge/';return entries.length>0&&entries.every(entry=>entry.startsWith('wish-core-hap-gpt/')&&!entry.split('/').includes('..'))&&['package.json','update-termux.sh','src/server.mjs'].every(file=>entries.includes(prefix+file));}
export async function checkPublicZipUpdate(fetchImpl,currentVersion){
  const options={headers:{Accept:'application/vnd.github+json'},cache:'no-store'};
  const [listingResponse,packageResponse]=await Promise.all([fetchImpl(PUBLIC_RELEASE_API,options),fetchImpl(PUBLIC_PACKAGE_API,options)]);
  check(listingResponse.ok&&packageResponse.ok,'UPDATE_CHECK','공개 ZIP 버전을 확인하지 못했습니다.',502);
  const release=selectZipRelease(await listingResponse.json()),packageFile=await packageResponse.json();
  let latest=null;try{latest=JSON.parse(Buffer.from(packageFile?.content||'',packageFile?.encoding||'base64').toString('utf8'));}catch{}
  check(release&&/^[0-9a-f]{40}$/.test(release.sha||'')&&release.git_url.endsWith('/'+release.sha)&&latest?.name==='local-gpt-subscription-bridge'&&/^\d+\.\d+\.\d+$/.test(latest.version||''),'UPDATE_CHECK','공개 ZIP 배포 정보를 확인하지 못했습니다.',502);
  const comparison=compareVersions(currentVersion,latest.version),status=comparison<0?'available':comparison>0?'local_ahead':'current';
  return {method:'zip',status,current_version:currentVersion,latest_version:latest.version,archive:release.name,archive_sha:release.sha,download_url:release.git_url,checked_at:Date.now()};
}
async function applyPublicZipUpdate(fetchImpl,state){
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'gpt-bridge-update-')),archive=path.join(temporary,'release.zip');
  try{
    if(!await commandExists('unzip')){check(await commandExists('pkg'),'UPDATE_TOOL','ZIP 압축 해제 도구를 설치할 수 없는 환경입니다.',500);await command('pkg',['install','-y','unzip'],temporary);}
    const response=await fetchImpl(state.download_url,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'}),declared=Number(response.headers.get('content-length')||0);
    check(response.ok&&(!declared||declared<=45*1024*1024),'UPDATE_DOWNLOAD','공개 ZIP 파일을 내려받지 못했습니다.',502);
    const envelope=Buffer.from(await response.arrayBuffer());check(envelope.length>0&&envelope.length<=45*1024*1024,'UPDATE_DOWNLOAD','공개 ZIP 응답 크기를 확인할 수 없습니다.',502);
    let payload=null;try{payload=JSON.parse(envelope.toString('utf8'));}catch{}
    check(payload?.sha===state.archive_sha&&payload?.encoding==='base64'&&typeof payload.content==='string'&&/^[A-Za-z0-9+/=\s]+$/.test(payload.content),'UPDATE_DOWNLOAD','공개 ZIP 응답을 확인하지 못했습니다.',502);
    const bytes=Buffer.from(payload.content.replace(/\s/g,''),'base64'),blobSha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    check(bytes.length>0&&bytes.length<=32*1024*1024&&blobSha===state.archive_sha,'UPDATE_DOWNLOAD','공개 ZIP 파일 무결성을 확인하지 못했습니다.',502);await fs.writeFile(archive,bytes,{mode:0o600});
    const entries=(await command('unzip',['-Z1',archive],temporary)).split('\n').filter(Boolean);
    check(validZipEntries(entries),'UPDATE_ARCHIVE','ZIP 내부 경로를 확인하지 못했습니다.',422);
    await command('unzip',['-q',archive,'-d',temporary],temporary);
    const source=path.join(temporary,'wish-core-hap-gpt','termux-bridge'),manifest=JSON.parse(await fs.readFile(path.join(source,'package.json'),'utf8'));
    check(manifest.name==='local-gpt-subscription-bridge'&&manifest.version===state.latest_version,'UPDATE_ARCHIVE','ZIP의 브리지 버전이 확인 결과와 다릅니다.',422);
    await command('bash',[path.join(source,'update-termux.sh')],source);
    return {updated:true,method:'zip',message:'공개 ZIP 버전을 적용했습니다. 서버를 다시 시작합니다.'};
  }finally{await fs.rm(temporary,{recursive:true,force:true});}
}
export async function createServer({dir=path.join(os.homedir(),'.local-gpt-subscription-bridge'),fetchImpl=globalThis.fetch,clock=Date.now,appName='Local GPT Subscription Bridge',onRestart=null,onUpdateCheck=null,onUpdate=null,updateMethods=[]}={}){
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
      const methods=updateMethods.length?updateMethods:typeof onUpdate==='function'?['git']:[];
      if(req.method==='GET'&&url.pathname==='/api/status')return send(res,200,{...bridge.status(),can_restart:typeof onRestart==='function',restart_busy:restartBusy(),can_update:typeof onUpdate==='function',update_methods:methods,update_busy:updateBusy});
      if(req.method==='GET'&&url.pathname==='/api/update/check'){
        const method=url.searchParams.get('method')||methods[0];
        check(typeof onUpdateCheck==='function'&&methods.includes(method),'UPDATE_UNAVAILABLE','현재 설치 방식에서 사용할 수 없는 업데이트입니다.',409);
        check(!updateBusy,'BUSY','업데이트 작업이 끝난 뒤 다시 확인하세요.',409);
        updateBusy=true;try{return send(res,200,await onUpdateCheck(method));}finally{updateBusy=false;}
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
        const method=(await readBody(req)).method||methods[0];
        check(typeof onUpdate==='function'&&methods.includes(method),'UPDATE_UNAVAILABLE','현재 설치 방식에서 사용할 수 없는 업데이트입니다.',409);
        check(!restartBusy(),'BUSY','대기·진행 중인 작업이 끝난 뒤 업데이트하세요.',409);
        updateBusy=true;try{const result=await onUpdate(method);send(res,200,{ok:true,...result});if(result.updated!==false)setImmediate(()=>onRestart({server,bridge}));}finally{updateBusy=false;}return;
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
  const supervised=process.env.GPT_BRIDGE_SUPERVISED==='1',runtimeSource=path.resolve(ROOT,'..'),manifestPath=path.join(runtimeSource,'package.json');
  const restart=supervised?({server,bridge})=>{bridge.close();server.close(()=>process.exit(75));}:null;
  const marker=await fs.readFile(path.join(runtimeSource,'.git-source'),'utf8').then(value=>value.trim(),()=>''),candidates=[process.env.GPT_BRIDGE_SOURCE,marker,path.join(os.homedir(),'gpt-codex-work','work-hap-gpt','termux-bridge'),path.join(os.homedir(),'RpCleanerEpub','main','wish-core-hap-gpt','termux-bridge')].filter(Boolean);
  let gitInfo=null;
  if(supervised&&await commandExists('git'))for(const candidate of [...new Set(candidates.map(value=>path.resolve(value)))])try{
    const source=candidate,repo=await command('git',['-C',source,'rev-parse','--show-toplevel'],source),branch=await command('git',['-C',repo,'branch','--show-current'],repo),packageFile=path.relative(repo,path.join(source,'package.json')).split(path.sep).join('/');
    check(branch&&await fs.stat(path.join(source,'update-termux.sh')).then(stat=>stat.isFile(),()=>false),'UPDATE_SOURCE','업데이트 원본을 확인하지 못했습니다.',409);gitInfo={source,repo,branch,packageFile};break;
  }catch{}
  const updateMethods=supervised?[gitInfo?'git':'zip']:[];
  const checkGitUpdate=gitInfo?async()=>{
    const {source,repo,branch,packageFile}=gitInfo;await command('git',['fetch','--quiet','origin','refs/heads/'+branch+':refs/remotes/origin/'+branch],repo);
    const [local,remote,base,dirty,currentPackage,latestPackage]=await Promise.all([
      command('git',['rev-parse','HEAD'],repo),command('git',['rev-parse','origin/'+branch],repo),command('git',['merge-base','HEAD','origin/'+branch],repo),command('git',['status','--porcelain','--untracked-files=no'],repo),
      fs.readFile(manifestPath,'utf8'),command('git',['show','origin/'+branch+':'+packageFile],repo)
    ]);
    const currentVersion=JSON.parse(currentPackage).version,latestVersion=JSON.parse(latestPackage).version;
    const status=classifyUpdate({local,remote,base,dirty,currentVersion,latestVersion});
    return {method:'git',status,current_version:currentVersion,latest_version:latestVersion,current_commit:local.slice(0,7),latest_commit:remote.slice(0,7),checked_at:Date.now()};
  }:null;
  const currentVersion=async()=>JSON.parse(await fs.readFile(manifestPath,'utf8')).version;
  const checkUpdate=updateMethods.length?async method=>method==='git'?checkGitUpdate():checkPublicZipUpdate(globalThis.fetch,await currentVersion()):null;
  const stateError=state=>({current:'이미 최신 버전입니다.',local_changes:'저장소에 직접 수정한 파일이 있어 자동 업데이트하지 않았습니다.',local_ahead:'현재 설치본이 공개 버전보다 새롭거나 로컬 커밋이 앞서 있습니다.',diverged:'로컬과 원격 기록이 갈라져 자동 업데이트하지 않았습니다.'})[state.status]||'업데이트 상태를 다시 확인하세요.';
  const update=updateMethods.length?async method=>{
    const state=await checkUpdate(method);check(state.status==='available','UPDATE_STATE',stateError(state),409);
    if(method==='zip')return applyPublicZipUpdate(globalThis.fetch,state);
    const {source,repo,branch}=gitInfo;await command('git',['pull','--ff-only','origin',branch],repo);await command('bash',[path.join(source,'update-termux.sh')],source);return {updated:true,method:'git',message:'Git 버전을 적용했습니다. 서버를 다시 시작합니다.'};
  }:null;
  const {server,bridge}=await createServer({onRestart:restart,onUpdateCheck:checkUpdate,onUpdate:update,updateMethods});
  const version=await currentVersion();server.listen(port,'127.0.0.1',()=>console.log('\nGPT 브리지 '+version+'\n관리 화면: http://127.0.0.1:'+port+'/#pair='+bridge.auth.identity.pair+'\n각자 본인 계정으로 로그인하세요. 종료: Ctrl+C\n'));
  server.on('error',error=>{bridge.close();console.error(error.code==='EADDRINUSE'?'해당 포트가 이미 사용 중입니다. 기존 서버를 확인하거나 GPT_BRIDGE_PORT를 바꾸세요.':'서버를 시작하지 못했습니다.');process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{bridge.close();server.close(()=>process.exit(0));});
}
