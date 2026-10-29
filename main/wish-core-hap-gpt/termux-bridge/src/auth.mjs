// Local-only reference implementation. Never send OAuth tokens to an extension.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const AUTH='https://auth.openai.com';
export const API='https://api.openai.com/v1';
export const SCOPE='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const REASONING_EFFORTS=Object.freeze(['low','medium','high','xhigh','max']);
export function documentedReasoningEfforts(model){
  const slug=String(model||'').toLowerCase();
  if(/^gpt-6(?:\.1-sol|-astra)(?:-|$)/.test(slug))return [...REASONING_EFFORTS];
  if(/^(?:gpt-6\.1-terra|gpt-6-(?:sol|luna)|gpt-5\.6-(?:sol|terra|luna))(?:-|$)/.test(slug)||slug==='gpt-5.6')return ['none',...REASONING_EFFORTS];
  return [];
}
export class BridgeError extends Error {
  constructor(code,message,status=400){super(message);this.code=code;this.status=status;}
}
export function check(ok,code,message,status=400){if(!ok)throw new BridgeError(code,message,status);}
export const random=()=>crypto.randomBytes(32).toString('base64url');
export const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
export const equal=(a,b)=>crypto.timingSafeEqual(Buffer.from(sha(String(a))),Buffer.from(sha(String(b))));
export async function readJSON(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
export async function writeJSON(file,value){
  await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
  const temporary=file+'.'+random()+'.tmp';
  await fs.writeFile(temporary,JSON.stringify(value),{flag:'wx',mode:0o600});
  await fs.rename(temporary,file);await fs.chmod(file,0o600);
}

export class SubscriptionAuth {
  constructor(dir,{fetchImpl=globalThis.fetch,clock=Date.now,appName='Local GPT Subscription Bridge'}={}){
    this.dir=dir;this.fetch=fetchImpl;this.now=clock;this.appName=appName;
    this.pending=null;this.refreshing=null;this.tokens=null;this.registration=null;
  }
  file(name){return path.join(this.dir,name);}
  async init(){
    await fs.mkdir(this.dir,{recursive:true,mode:0o700});await fs.chmod(this.dir,0o700);
    this.identity=await readJSON(this.file('identity.json'),null);
    if(!this.identity){this.identity={host_id:'urn:uuid:'+crypto.randomUUID(),pair:random()};await writeJSON(this.file('identity.json'),this.identity);}
    check(/^urn:uuid:[0-9a-f-]{36}$/i.test(this.identity.host_id)&&typeof this.identity.pair==='string'&&this.identity.pair.length>=32,'IDENTITY','로컬 연결 파일을 확인해 주세요.');
    this.tokens=await readJSON(this.file('account.json'),null);
    this.registration=await readJSON(this.file('registration.json'),null);return this;
  }
  async json(url,options={}){
    const response=await this.fetch(url,{...options,signal:AbortSignal.timeout(30000)});
    const raw=await response.text();check(raw.length<8000000,'UPSTREAM_SIZE','응답 크기를 확인해 주세요.',502);
    let data;try{data=JSON.parse(raw);}catch{throw new BridgeError('UPSTREAM_FORMAT','공식 서버 응답을 읽지 못했습니다.',502);}
    if(!response.ok){const code=String(data.error?.code||data.error||'HTTP_'+response.status).replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,100);throw new BridgeError(code,'인증 또는 연결 요청이 거절됐습니다 ('+response.status+').',response.status===401?401:502);}
    return data;
  }
  startLogin(port){
    const state=random(),nonce=random(),verifier=random();
    const clientId=this.tokens?.client_id||this.registration?.client_id||null;
    const redirect='http://127.0.0.1:'+port+'/auth/callback';
    this.pending={state,nonce,verifier,clientId,redirect,expires:this.now()+600000,subject:this.tokens?.subject||this.registration?.subject||null};
    const params=new URLSearchParams({client_id:clientId||'dynamic_agent_client',ext_agent_host_id:this.identity.host_id,response_type:'code',redirect_uri:redirect,scope:SCOPE,resource:API,state,nonce,code_challenge_method:'S256',code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url')});
    if(!clientId)params.set('agent_name_hint',this.appName);
    if(clientId&&this.tokens?.id_token)params.set('id_token_hint',this.tokens.id_token);
    return AUTH+'/api/accounts/authorize?'+params.toString();
  }
  async verifyID(jwt,{clientId,nonce,subject}={}){
    check(typeof jwt==='string','ID_TOKEN','로그인 확인 결과가 없습니다.');
    const parts=jwt.split('.');check(parts.length===3,'ID_TOKEN','로그인 확인 결과를 읽지 못했습니다.');
    let header,claims;try{header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{throw new BridgeError('ID_TOKEN','로그인 확인 결과를 읽지 못했습니다.');}
    check(['RS256','ES256'].includes(header.alg)&&!header.crit,'ID_ALGORITHM','로그인 서명 형식을 확인해 주세요.');
    const meta=await this.json(AUTH+'/.well-known/openid-configuration');
    const jwksURL=new URL(meta.jwks_uri);
    check(meta.issuer===AUTH&&jwksURL.protocol==='https:'&&jwksURL.hostname==='auth.openai.com','ISSUER','인증 기관을 확인하지 못했습니다.');
    const jwks=await this.json(jwksURL.href);
    const key=jwks.keys?.find(k=>k.kid===header.kid&&(!k.use||k.use==='sig')&&(!k.alg||k.alg===header.alg));
    check(key&&(header.alg==='RS256'?key.kty==='RSA':key.kty==='EC'&&key.crv==='P-256'),'ID_KEY','로그인 서명 키를 확인하지 못했습니다.');
    const publicKey=crypto.createPublicKey({key,format:'jwk'});
    check(crypto.verify('sha256',Buffer.from(parts[0]+'.'+parts[1]),header.alg==='ES256'?{key:publicKey,dsaEncoding:'ieee-p1363'}:publicKey,Buffer.from(parts[2],'base64url')),'ID_SIGNATURE','로그인 서명이 일치하지 않습니다.');
    const audience=Array.isArray(claims.aud)?claims.aud:[claims.aud],seconds=this.now()/1000;
    check(claims.iss===AUTH&&audience.includes(clientId)&&(!claims.azp||claims.azp===clientId)&&Number(claims.exp)>seconds&&(!claims.nbf||Number(claims.nbf)<=seconds+30)&&typeof claims.sub==='string'&&claims.sub.length>0,'ID_CLAIMS','계정 또는 로그인 유효기간을 확인해 주세요.');
    if(nonce)check(equal(claims.nonce||'',nonce),'ID_NONCE','로그인 시도와 결과가 다릅니다.');
    if(subject)check(equal(claims.sub,subject),'ID_ACCOUNT','선택한 계정과 다른 계정입니다. 계정을 바꾸려면 먼저 연결을 해제하세요.');
    return claims;
  }
  async finishLogin(url){
    const pending=this.pending;
    check(pending&&pending.expires>this.now()&&equal(url.searchParams.get('state')||'',pending.state),'LOGIN_STATE','로그인 시간이 지났거나 다른 로그인 시도입니다.');
    this.pending=null;check(!url.searchParams.has('error'),'CONSENT_DENIED','구독 연결이 승인되지 않았습니다.');
    const clientId=url.searchParams.get('client_id')||pending.clientId;
    check(clientId&&clientId!=='dynamic_agent_client'&&(!pending.clientId||clientId===pending.clientId),'CLIENT_ID','발급된 연결 ID를 확인하지 못했습니다.');
    const code=url.searchParams.get('code');check(code,'LOGIN_CODE','로그인 코드가 없습니다.');
    const token=await this.json(AUTH+'/api/accounts/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,code,code_verifier:pending.verifier,redirect_uri:pending.redirect,resource:API}).toString()});
    const claims=await this.verifyID(token.id_token,{clientId,nonce:pending.nonce,subject:pending.subject});
    const scopes=String(token.scope||'').split(/\s+/);
    check(scopes.includes('chatgpt.tokens.use.direct')&&token.access_token&&token.refresh_token,'PLAN_PERMISSION','이 연결의 구독 사용 권한이 없습니다. 공식 계정 설정과 지원 여부를 확인하세요.',403);
    const next={client_id:clientId,subject:claims.sub,access_token:token.access_token,refresh_token:token.refresh_token,id_token:token.id_token,scopes,expires_at:this.now()+Number(token.expires_in||3600)*1000};
    await writeJSON(this.file('account.json'),next);
    await writeJSON(this.file('registration.json'),{client_id:clientId,subject:claims.sub});
    this.tokens=next;this.registration={client_id:clientId,subject:claims.sub};return {connected:true};
  }
  async access(){
    check(this.tokens,'LOGIN_REQUIRED','관리 화면에서 ChatGPT 구독 연결을 먼저 완료하세요.',401);
    check(this.tokens.scopes?.includes('chatgpt.tokens.use.direct'),'PLAN_PERMISSION','구독 사용 권한을 확인해 주세요.',403);
    if(this.tokens.expires_at>this.now()+90000)return this.tokens.access_token;
    if(!this.refreshing)this.refreshing=(async()=>{
      const old=this.tokens;
      const token=await this.json(AUTH+'/api/accounts/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:old.client_id,refresh_token:old.refresh_token,resource:API}).toString()});
      check(token.access_token,'REFRESH','구독 로그인을 다시 확인해 주세요.',401);
      if(token.id_token)await this.verifyID(token.id_token,{clientId:old.client_id,subject:old.subject});
      const scopes=token.scope?String(token.scope).split(/\s+/):old.scopes;
      check(scopes.includes('chatgpt.tokens.use.direct'),'PLAN_PERMISSION','구독 사용 권한이 해제되었습니다.',403);
      const next={...old,access_token:token.access_token,refresh_token:token.refresh_token||old.refresh_token,id_token:token.id_token||old.id_token,scopes,expires_at:this.now()+Number(token.expires_in||3600)*1000};
      await writeJSON(this.file('account.json'),next);this.tokens=next;return next.access_token;
    })().finally(()=>{this.refreshing=null;});
    return this.refreshing;
  }
  async models(){
    const token=await this.access();
    const data=await this.json(API+'/models',{headers:{Authorization:'Bearer '+token}});
    check(Array.isArray(data.models),'MODEL_CATALOG','구독 모델 목록을 읽지 못했습니다.',502);
    const allowed=new Set(['none','low','medium','high','xhigh','max']);
    return data.models.filter(m=>m.visibility==='list'&&typeof m.slug==='string').map(m=>{
      const raw=m.supported_reasoning_efforts??m.reasoning?.efforts??m.reasoning_efforts;
      const listed=Array.isArray(raw)?raw.map(String).filter(x=>allowed.has(x)):[],efforts=listed.length?listed:documentedReasoningEfforts(m.slug);
      const defaultEffort=String(m.default_reasoning_effort??m.reasoning?.default_effort??(efforts.includes('medium')?'medium':''));
      return {slug:m.slug,name:m.display_name||m.slug,efforts,...(efforts.includes(defaultEffort)?{default_effort:defaultEffort}:{})};
    });
  }
  async logout(){
    if(this.tokens?.refresh_token){
      const meta=await this.json(AUTH+'/.well-known/openid-configuration');const url=new URL(meta.revocation_endpoint);
      check(url.protocol==='https:'&&url.hostname==='auth.openai.com','REVOKE_URL','연결 해제 주소를 확인하지 못했습니다.');
      const r=await this.fetch(url.href,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:this.tokens.refresh_token,token_type_hint:'refresh_token',client_id:this.tokens.client_id}).toString(),signal:AbortSignal.timeout(30000)});
      check(r.ok,'REVOKE','원격 연결 해제에 실패했습니다. ChatGPT 설정에서 앱 연결을 확인하세요.',502);
    }
    this.tokens=null;this.registration=null;this.pending=null;
    await fs.rm(this.file('account.json'),{force:true});await fs.rm(this.file('registration.json'),{force:true});
  }
}
