import fs from 'node:fs/promises';
import path from 'node:path';
import {API,SubscriptionAuth,BridgeError,check,sha,readJSON,writeJSON} from './auth.mjs';

export const DEFAULT_SETTINGS={paused:false,max_chars:240000,max_calls_5h:20,max_calls_7d:200};
export function normalizePayload(value){
  check(value&&typeof value==='object'&&!Array.isArray(value),'PAYLOAD','요청은 JSON 객체여야 합니다.');
  const allowed=new Set(['request_id','model','effort','instructions','input']);
  check(Object.keys(value).every(k=>allowed.has(k)),'PAYLOAD_FIELDS','참고 서버가 지원하지 않는 필드가 있습니다.');
  check(typeof value.request_id==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(value.request_id),'REQUEST_ID','요청마다 저장 가능한 고유 request_id가 필요합니다.');
  check(typeof value.model==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(value.model),'MODEL','구독 목록에서 모델을 선택하세요.');
  const instructions=value.instructions??'';
  check(typeof instructions==='string'&&instructions.length<=100000,'INSTRUCTIONS','지침 크기를 확인하세요.');
  const input=typeof value.input==='string'?[{role:'user',content:value.input}]:value.input;
  check(Array.isArray(input)&&input.length>0&&input.length<=1000,'INPUT','문자열 또는 텍스트 메시지 배열이 필요합니다.');
  const messages=input.map(m=>{
    check(m&&Object.keys(m).every(k=>['role','content'].includes(k))&&['user','assistant'].includes(m.role)&&typeof m.content==='string','TEXT_ONLY','참고 서버는 user/assistant 텍스트만 지원합니다. 시스템 지침은 instructions로 보내세요.');
    return {role:m.role,content:m.content};
  });
  const chars=instructions.length+messages.reduce((n,m)=>n+m.content.length,0);
  check(chars>0&&chars<=1000000,'INPUT_SIZE','요청은 1~1,000,000자여야 합니다.');
  const result={model:value.model,instructions,input:messages};
  if(value.effort!==undefined){check(['none','low','medium','high','xhigh','max'].includes(value.effort),'EFFORT','지원되는 생각 강도를 선택하세요.');result.reasoning={effort:value.effort};}
  return {request_id:value.request_id,body:{...result,store:false,stream:true},chars};
}

export async function readCompleted(body){
  let buffer='',text='',completed=null,total=0;
  const decoder=new TextDecoder();
  const event=block=>{
    const data=block.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
    if(!data||data==='[DONE]')return;
    let item;try{item=JSON.parse(data);}catch{throw new BridgeError('STREAM_JSON','응답 스트림을 읽지 못했습니다.',502);}
    if(item.type==='response.output_text.delta')text+=String(item.delta||'');
    check(text.length<2500000,'OUTPUT_SIZE','출력 크기가 참고 서버 한도를 넘었습니다.',502);
    if(item.type==='response.refusal.delta'||item.type==='response.refusal.done')throw new BridgeError('REFUSAL','모델이 요청을 거절했습니다. 원문에 적용하지 마세요.',422);
    if(item.type==='response.completed')completed=item.response;
    if(['response.failed','response.incomplete','error'].includes(item.type)){
      const code=String(item.response?.error?.code||item.error?.code||item.code||item.type).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,100);
      throw new BridgeError(code,'AI 요청이 완료되지 않았습니다. 자동 재요청하지 않았습니다.',502);
    }
  };
  try{
    for await(const chunk of body){
      total+=chunk.byteLength;check(total<=20000000,'STREAM_SIZE','응답 스트림이 너무 큽니다.',502);
      buffer+=decoder.decode(chunk,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');
      let at;while((at=buffer.indexOf('\n\n'))>=0){event(buffer.slice(0,at));buffer=buffer.slice(at+2);}
    }
    buffer+=decoder.decode();if(buffer.trim())event(buffer);
    check(completed&&completed.status==='completed','NOT_COMPLETED','완료 확인 전에 연결이 끝났습니다. 사용량이 소모됐을 수 있습니다.',502);
    check(!(completed.output||[]).some(m=>(m.content||[]).some(c=>c.type==='refusal')),'REFUSAL','모델이 요청을 거절했습니다.',422);
    const final=(completed.output||[]).filter(m=>m.type==='message').flatMap(m=>m.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('');
    check((final||text).trim(),'EMPTY','완료 응답에 텍스트가 없습니다.',502);
    return {text:final||text,usage:completed.usage??null};
  }catch(error){error.partial_text=text;throw error;}
}

export class JobBridge {
  constructor(dir,options={}){this.dir=dir;this.auth=new SubscriptionAuth(dir,options);this.now=options.clock||Date.now;this.jobs=new Map();this.running=false;this.closed=false;this.changes=Promise.resolve();}
  async init(){
    await this.auth.init();await fs.mkdir(path.join(this.dir,'jobs'),{recursive:true,mode:0o700});
    const saved=await readJSON(path.join(this.dir,'settings.json'),{});
    this.settings=Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(key=>[key,Object.hasOwn(saved,key)?saved[key]:DEFAULT_SETTINGS[key]]));
    for(const file of await fs.readdir(path.join(this.dir,'jobs'))){
      if(!/^[a-f0-9]{64}\.json$/.test(file))continue;
      const job=await readJSON(path.join(this.dir,'jobs',file),null);if(!job)continue;
      check(file===sha(job.request_id)+'.json','JOB_FILE','작업 기록이 손상되었습니다. 기존 파일을 보존합니다.');
      if(['running','queued'].includes(job.status)){job.status='error';job.error_code='INTERRUPTED';job.message='서버가 종료됐던 작업입니다. 자동으로 다시 보내지 않았습니다.';await this.save(job);}
      this.jobs.set(job.request_id,job);
    }
    return this;
  }
  save(job){return writeJSON(path.join(this.dir,'jobs',sha(job.request_id)+'.json'),job);}
  publicJob(job){const {body,fingerprint,...publicFields}=job;return publicFields;}
  counts(){const times=[...this.jobs.values()].map(j=>j.started_at).filter(Number.isFinite);return {five_hours:times.filter(t=>t>this.now()-18000000).length,seven_days:times.filter(t=>t>this.now()-604800000).length};}
  status(){return {version:'0.2.5',connected:!!this.auth.tokens,running:this.running,settings:this.settings,calls:this.counts(),recent:[...this.jobs.values()].sort((a,b)=>b.created_at-a.created_at).slice(0,20).map(j=>({request_id:j.request_id,status:j.status,created_at:j.created_at,started_at:j.started_at||null,finished_at:j.finished_at||null,error_code:j.error_code||'',model:j.body?.model||'',effort:j.body?.reasoning?.effort||'',usage:j.usage||null}))};}
  async settingsChange(value){
    check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>Object.hasOwn(DEFAULT_SETTINGS,k)),'SETTINGS','설정 항목을 확인해 주세요.');
    const next={...this.settings,...value};
    check(typeof next.paused==='boolean','SETTINGS','일시정지 값은 true/false여야 합니다.');
    for(const [key,minimum,maximum] of [['max_chars',1000,1000000],['max_calls_5h',1,200],['max_calls_7d',1,2000]])check(Number.isInteger(next[key])&&next[key]>=minimum&&next[key]<=maximum,'SETTINGS','설정 범위를 확인해 주세요: '+key);
    await writeJSON(path.join(this.dir,'settings.json'),next);this.settings=next;if(!next.paused)void this.drain();return next;
  }
  async add(value){
    const create=async()=>{
      const payload=normalizePayload(value),fingerprint=sha(JSON.stringify(payload.body));
      const old=this.jobs.get(payload.request_id);
      if(old){check(old.fingerprint===fingerprint,'REQUEST_CHANGED','같은 request_id로 내용이 바뀌었습니다. 기존 결과를 먼저 확인하세요.',409);return this.publicJob(old);}
      check(payload.chars<=this.settings.max_chars,'LOCAL_SIZE','설정한 요청 크기를 넘었습니다.',413);
      const job={...payload,fingerprint,status:'queued',created_at:this.now(),attempts:0};
      await this.save(job);this.jobs.set(job.request_id,job);void this.drain();return this.publicJob(job);
    };
    const promise=this.changes.then(create);this.changes=promise.catch(()=>{});return promise;
  }
  get(id){const job=this.jobs.get(id);check(job,'NOT_FOUND','해당 요청을 찾지 못했습니다. 이전 POST의 성공 여부가 불확실하면 자동 재전송하지 마세요.',404);return this.publicJob(job);}
  async resume(id){
    const job=this.jobs.get(id);check(job&&job.status==='blocked_budget'&&job.attempts===0,'RESUME','실제 AI 호출 전 로컬 한도에 걸린 작업만 재개할 수 있습니다.',409);
    job.status='queued';delete job.message;await this.save(job);void this.drain();return this.publicJob(job);
  }
  async drain(){
    if(this.running||this.closed||this.settings.paused)return;this.running=true;
    try{
      for(const job of this.jobs.values()){
        if(this.closed||this.settings.paused)break;if(job.status!=='queued')continue;
        const count=this.counts();
        if(count.five_hours>=this.settings.max_calls_5h||count.seven_days>=this.settings.max_calls_7d){job.status='blocked_budget';job.message='브리지에 설정한 호출 횟수에 도달했습니다. 공식 구독 잔여량과는 별개입니다.';await this.save(job);continue;}
        try{
          const models=await this.auth.models(),selected=models.find(m=>m.slug===job.body.model);check(selected,'MODEL_UNAVAILABLE','이 계정의 구독 모델 목록에서 모델을 선택하세요.');
          const effort=job.body.reasoning?.effort;if(effort&&selected.efforts?.length)check(selected.efforts.includes(effort),'MODEL_EFFORT','선택한 모델이 지원하는 추론 강도를 골라 주세요.');
          const token=await this.auth.access();job.status='running';job.started_at=this.now();job.attempts=1;await this.save(job);
          const controller=new AbortController();this.controller=controller;const timeout=setTimeout(()=>controller.abort(),900000);
          try{
            const response=await this.auth.fetch(API+'/responses',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(job.body),signal:controller.signal});
            if(!response.ok){let data={};try{data=await response.json();}catch{}throw new BridgeError(String(data.error?.code||'HTTP_'+response.status).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,100),'AI 요청이 거절됐습니다 ('+response.status+'). 자동 재요청하지 않았습니다.',response.status);}
            const result=await readCompleted(response.body);job.status='completed';job.text=result.text;job.usage=result.usage;job.finished_at=this.now();
          }finally{clearTimeout(timeout);this.controller=null;}
        }catch(error){
          job.status='error';job.error_code=error instanceof BridgeError?error.code:'CONNECTION_UNCERTAIN';
          job.message=error instanceof BridgeError?error.message:'연결 결과가 불확실합니다. 자동 재요청하지 않았습니다.';
          if(error.partial_text)job.partial_text=error.partial_text;
          if(/usage_limit|usage_unavailable|429|PLAN_PERMISSION|LOGIN_REQUIRED|invalid_grant/.test(job.error_code))await this.settingsChange({paused:true});
        }
        await this.save(job);
      }
    }finally{this.running=false;}
  }
  close(){this.closed=true;this.controller?.abort();}
}
