'use strict';
const el=id=>document.getElementById(id);
const PAIR_SESSION='gpt-bridge-pair-session-v1',PAIR_LOCAL='gpt-bridge-pair-local-v1',LAST_REFRESH='gpt-bridge-last-refresh-v1',MODEL_CACHE='gpt-bridge-model-cache-v1',UPDATE_STARTED='gpt-bridge-update-started-v1';
const storage={get:(area,key)=>{try{return area.getItem(key)||'';}catch{return '';}},set:(area,key,value)=>{try{value?area.setItem(key,value):area.removeItem(key);}catch{}}};
const fragmentPair=new URLSearchParams(location.hash.slice(1)).get('pair')||'',savedPair=storage.get(localStorage,PAIR_LOCAL);
function readModelCache(){try{const value=JSON.parse(storage.get(localStorage,MODEL_CACHE)||'null');return value&&Array.isArray(value.models)?{models:value.models.filter(model=>model&&model.slug),at:Number(value.at)||0}:{models:[],at:0};}catch{return {models:[],at:0};}}
let pair=fragmentPair||storage.get(sessionStorage,PAIR_SESSION)||savedPair,state=null,updateState=null,busy=false,modelCache=readModelCache();
if(location.hash)history.replaceState(null,'',location.pathname);
el('pair').value=pair;el('rememberPair').checked=!!savedPair&&savedPair===pair;
let messageTimer=null;
function message(text,error=false,sticky=false){clearTimeout(messageTimer);el('status').hidden=false;el('status').textContent=text;el('status').classList.toggle('error',error);if(!error&&!sticky)messageTimer=setTimeout(()=>{el('status').hidden=true;},2400);}
function serverState(label,kind=''){el('serverState').className='server-state '+kind;el('serverState').querySelector('span').textContent=label;}
function parsePair(value){
  const raw=value.trim();if(!raw.startsWith('http'))return raw;
  const url=new URL(raw);if(url.origin!==location.origin||url.hostname!=='127.0.0.1')throw Error('현재 관리 화면과 같은 주소의 코드를 넣으세요.');
  return new URLSearchParams(url.hash.slice(1)).get('pair')||'';
}
function remember(){storage.set(sessionStorage,PAIR_SESSION,pair);storage.set(localStorage,PAIR_LOCAL,el('rememberPair').checked?pair:'');}
async function api(route,body){
  if(!pair)throw Error('Termux가 표시한 연결 코드를 먼저 넣으세요.');
  const response=await fetch(route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+pair,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw Error(data.message||data.code||'연결에 실패했습니다.');return data;
}
function formatTime(value){if(!value)return '—';return new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit'}).format(value);}
function formatDateTime(value){if(!value)return '없음';return new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'}).format(value);}
function duration(job){const end=job.finished_at||Date.now(),start=job.started_at;if(!start)return '';const seconds=Math.max(0,Math.floor((end-start)/1000)),minutes=Math.floor(seconds/60);return minutes?minutes+'분 '+String(seconds%60).padStart(2,'0')+'초':seconds+'초';}
function updateMeter(prefix,used,limit){
  const safeLimit=Math.max(1,Number(limit)||1),percent=Math.min(100,Math.max(0,used/safeLimit*100)),remaining=Math.max(0,Math.round(100-percent)),meter=el(prefix+'Meter');
  el(prefix+'Text').textContent=used+' / '+safeLimit+'회';el(prefix+'Remain').textContent=remaining+'% 남음';meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax',String(safeLimit));meter.setAttribute('aria-valuenow',String(used));meter.title='사용 '+used+'회 · 남은 로컬 한도 '+Math.max(0,safeLimit-used)+'회';
  requestAnimationFrame(()=>{meter.querySelector('.meter-fill').style.width=percent+'%';meter.querySelector('.meter-dot').style.left=percent+'%';});
}
function statusLabel(value){return ({completed:'완료',running:'진행 중',queued:'대기',error:'오류',blocked_budget:'한도 대기'})[value]||value;}
function renderAccount(){
  const connected=!!state?.connected,models=modelCache.models;
  el('accountState').textContent=connected?'연결됨':'연결 필요';el('accountState').classList.toggle('connected',connected);el('login').textContent=connected?'재연결':'계정 연결';el('models').disabled=!connected;el('logout').hidden=!connected;
  if(connected&&models.length)el('modelList').textContent=models.map(model=>(model.name||model.slug)+' · '+model.slug).join('\n');
  else if(connected&&modelCache.at)el('modelList').textContent='마지막 확인에서 사용 가능한 모델이 없었습니다. [모델 확인]으로 다시 가져올 수 있습니다.';
  else if(connected)el('modelList').textContent='ChatGPT 계정에 연결되었습니다. 모델 정보를 가져오는 중이거나 [모델 확인]을 눌러 갱신할 수 있습니다.';
  else el('modelList').textContent='ChatGPT 계정 연결이 필요합니다.';
  el('modelRefresh').textContent='마지막 모델 확인 '+formatDateTime(modelCache.at);
}
function renderUpdate(){
  const labels={current:'최신 버전입니다.',available:'새 버전을 적용할 수 있습니다.',local_changes:'로컬 수정 파일이 있어 자동 업데이트할 수 없습니다.',local_ahead:'로컬 커밋이 원격보다 앞서 있습니다.',diverged:'로컬과 원격 기록이 갈라져 있습니다.'},result=el('updateResult');
  result.textContent=updateState?(labels[updateState.status]||'업데이트 상태를 확인하지 못했습니다.')+' · 현재 '+updateState.current_version+' / 최신 '+updateState.latest_version:'현재 '+(state?.version||'—')+' · 확인 전';
  el('checkUpdate').disabled=!state?.can_update||state?.update_busy;el('checkUpdate').textContent=state?.update_busy?'확인 중':'확인';
  el('update').disabled=!state?.can_update||state?.restart_busy||state?.update_busy||updateState?.status!=='available';
}
function saveModels(models){modelCache={models:models.map(model=>({name:String(model.name||model.display_name||model.slug||''),slug:String(model.slug||'')})).filter(model=>model.slug),at:Date.now()};storage.set(localStorage,MODEL_CACHE,JSON.stringify(modelCache));renderAccount();}
async function refreshModels(announce=true){const models=await api('/api/models');if(!Array.isArray(models))throw Error('모델 목록 형식을 확인하지 못했습니다.');saveModels(models);if(announce)message('모델 정보와 확인 시간을 저장했습니다.');return models;}
function renderJobs(){
  const recent=state?.recent||[],done=recent.filter(job=>job.status==='completed').length,active=recent.filter(job=>['running','queued'].includes(job.status)).length,errors=recent.filter(job=>['error','blocked_budget'].includes(job.status)).length;
  el('doneCount').textContent=done;el('activeCount').textContent=active;el('errorCount').textContent=errors;el('jobs').replaceChildren();
  if(!recent.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='아직 요청한 작업이 없습니다.';el('jobs').append(empty);return;}
  for(const job of recent){
    const details=document.createElement('details');details.className='job '+job.status;
    const summary=document.createElement('summary'),top=document.createElement('div'),dot=document.createElement('i'),label=document.createElement('span'),time=document.createElement('time'),name=document.createElement('div'),meta=document.createElement('div'),body=document.createElement('div'),output=document.createElement('pre');
    top.className='job-top';dot.className='job-dot';label.textContent=statusLabel(job.status);time.textContent=formatTime(job.created_at);name.className='job-name';name.textContent=job.model||'AI 요청';meta.className='job-meta';
    const tokens=Number(job.usage?.input_tokens||0)+Number(job.usage?.output_tokens||0),parts=[job.request_id.slice(0,12),job.effort,job.started_at?duration(job):'',tokens?tokens.toLocaleString()+' 토큰':''].filter(Boolean);meta.textContent=parts.join(' · ');
    top.append(dot,label,time);summary.append(top,name,meta);body.className='job-body';output.textContent='펼치면 저장된 결과를 조회합니다.';body.append(output);details.append(summary,body);let loaded=false;
    details.addEventListener('toggle',()=>{if(details.open&&!loaded){loaded=true;api('/api/jobs/'+job.request_id).then(data=>{output.textContent=JSON.stringify(data,null,2);if(data.status==='blocked_budget'){const resume=document.createElement('button');resume.className='btn secondary';resume.textContent='설정 확인 후 작업 재개';resume.addEventListener('click',()=>run(async()=>{await api('/api/jobs/'+job.request_id+'/resume',{});await refresh();}));body.append(resume);}}).catch(error=>{loaded=false;output.textContent=error.message;});}});
    el('jobs').append(details);
  }
}
function render(){
  for(const key of ['max_chars','max_calls_5h','max_calls_7d'])el(key).value=state.settings[key];
  el('pause').textContent=state.settings.paused?'요청 재개':'요청 일시정지';el('restart').disabled=!state.can_restart||state.restart_busy;
  renderAccount();renderUpdate();serverState(state.settings.paused?'일시정지':'서버 정상','online');updateMeter('usage5',state.calls.five_hours,state.settings.max_calls_5h);updateMeter('usage7',state.calls.seven_days,state.settings.max_calls_7d);renderJobs();
}
function saveRefreshTime(){const now=Date.now();storage.set(localStorage,LAST_REFRESH,String(now));el('lastRefresh').textContent='마지막 갱신 '+formatTime(now);}
async function refresh(announce=true){state=await api('/api/status');render();saveRefreshTime();if(announce)message('서버 상태와 브리지 사용량을 갱신했습니다.');return state;}
async function run(task){if(busy)return;busy=true;try{await task();}catch(error){serverState('확인 필요','error');message(error.message,true);}finally{busy=false;}}
function selectTab(name){for(const tab of document.querySelectorAll('[data-tab]'))tab.setAttribute('aria-selected',String(tab.dataset.tab===name));el('settingsPanel').hidden=name!=='settings';el('jobsPanel').hidden=name!=='jobs';}
for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>selectTab(tab.dataset.tab));
el('rememberPair').addEventListener('change',()=>remember());
el('connect').onclick=()=>run(async()=>{const next=parsePair(el('pair').value);if(!next)throw Error('연결 코드가 비어 있습니다.');if(next!==pair){modelCache={models:[],at:0};storage.set(localStorage,MODEL_CACHE,'');}pair=next;remember();await refresh();if(state.connected&&!modelCache.models.length)await refreshModels(false);});
el('copy').onclick=()=>run(async()=>{if(!pair)throw Error('연결 코드를 먼저 넣으세요.');await navigator.clipboard.writeText(location.origin+'/#pair='+pair);message('이 기기의 연결 주소를 복사했습니다.');});
el('login').onclick=()=>run(async()=>{message('ChatGPT 구독 연결 화면을 여는 중입니다.');const result=await api('/api/login',{});location.assign(result.url);});
el('models').onclick=()=>run(()=>refreshModels());
el('logout').onclick=()=>run(async()=>{await api('/api/logout',{});modelCache={models:[],at:0};storage.set(localStorage,MODEL_CACHE,'');await refresh();message('계정 연결을 해제했습니다.');});
el('save').onclick=()=>run(async()=>{await api('/api/settings',Object.fromEntries(['max_chars','max_calls_5h','max_calls_7d'].map(key=>[key,Number(el(key).value)])));await refresh();});
el('pause').onclick=()=>run(async()=>{if(!state)await refresh();await api('/api/settings',{paused:!state.settings.paused});await refresh();});
el('usageRefresh').onclick=()=>run(refresh);el('refreshJobs').onclick=()=>run(refresh);
el('checkUpdate').onclick=()=>run(async()=>{updateState=await api('/api/update/check');renderUpdate();message(updateState.status==='available'?'새 버전을 확인했습니다.':'업데이트 확인을 마쳤습니다.');});
el('update').onclick=()=>run(async()=>{if(updateState?.status!=='available')throw Error('먼저 업데이트 확인을 눌러 주세요.');if(!confirm('확인된 새 브리지 파일을 받고 서버를 재시작할까요? 진행 중인 요청이 있으면 실행되지 않습니다. 완료 표시가 보이지 않으면 5분 뒤 이 페이지를 다시 열고 [↻]를 눌러 주세요.'))return;const fallback='완료 표시가 보이지 않으면 5분 뒤 이 페이지를 다시 열고 서버 관리의 [↻]를 눌러 주세요.';storage.set(localStorage,UPDATE_STARTED,String(Date.now()));serverState('업데이트 중');message('확인된 새 버전을 적용하고 있습니다. '+fallback,false,true);try{const result=await api('/api/update',{});storage.set(localStorage,UPDATE_STARTED,'');message((result.message||'업데이트를 적용하고 서버를 다시 시작합니다.')+' 페이지가 자동으로 열리지 않으면 새로고침해 주세요.',false,true);setTimeout(()=>location.reload(),2200);}catch(error){throw Error(error.message+' '+fallback);}});
el('restart').onclick=()=>run(async()=>{if(!confirm('진행 중인 요청이 없을 때 서버를 재시작합니다. 계속할까요?'))return;await api('/api/restart',{});serverState('재시작 중');message('서버를 재시작하는 중입니다.');setTimeout(()=>location.reload(),1500);});
const last=Number(storage.get(localStorage,LAST_REFRESH));if(Number.isFinite(last)&&last>0)el('lastRefresh').textContent='마지막 갱신 '+formatTime(last);
if(pair){storage.set(sessionStorage,PAIR_SESSION,pair);run(async()=>{await refresh(false);if(state.connected&&!modelCache.models.length)await refreshModels(false);});}else{serverState('연결 필요');renderAccount();message('Termux가 표시한 주소 전체를 열거나 연결 코드를 넣으세요.',true);}
const updateStarted=Number(storage.get(localStorage,UPDATE_STARTED));if(Number.isFinite(updateStarted)&&updateStarted>0)message('업데이트 완료 여부가 확인되지 않았습니다. 시작 '+formatDateTime(updateStarted)+' · 5분 뒤 이 페이지를 다시 열고 서버 관리의 [↻]를 눌러 주세요.',false,true);
