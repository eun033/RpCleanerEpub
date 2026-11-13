'use strict';
const el=id=>document.getElementById(id);
const PAIR_SESSION='gpt-bridge-pair-session-v1',PAIR_LOCAL='gpt-bridge-pair-local-v1',LAST_REFRESH='gpt-bridge-last-refresh-v1',MODEL_CACHE='gpt-bridge-model-cache-v1',UPDATE_STARTED='gpt-bridge-update-started-v1';
const storage={get:(area,key)=>{try{return area.getItem(key)||'';}catch{return '';}},set:(area,key,value)=>{try{value?area.setItem(key,value):area.removeItem(key);}catch{}}};
const fragmentPair=new URLSearchParams(location.hash.slice(1)).get('pair')||'',savedPair=storage.get(localStorage,PAIR_LOCAL);
function readModelCache(){try{const value=JSON.parse(storage.get(localStorage,MODEL_CACHE)||'null');return value&&Array.isArray(value.models)?{models:value.models.filter(model=>model&&model.slug),at:Number(value.at)||0}:{models:[],at:0};}catch{return {models:[],at:0};}}
let pair=fragmentPair||storage.get(sessionStorage,PAIR_SESSION)||savedPair,state=null,updateStates={git:null,zip:null},busy=false,modelCache=readModelCache();
if(pair)storage.set(sessionStorage,PAIR_SESSION,pair);
if(location.hash&&(storage.get(sessionStorage,PAIR_SESSION)===pair||savedPair===pair))history.replaceState(null,'',location.pathname);
el('pair').value=pair;el('rememberPair').checked=!!savedPair&&savedPair===pair;
let messageTimer=null;
function message(text,error=false,sticky=false,progress=false){clearTimeout(messageTimer);el('status').hidden=false;el('status').textContent=text;el('status').className='notice'+(error?' error':progress?' progress':'');if(!error&&!sticky)messageTimer=setTimeout(()=>{el('status').hidden=true;},2400);}
function serverState(label,kind=''){el('serverState').className='server-state '+kind;el('serverState').querySelector('span').textContent=label;el('serverHealth').textContent=label==='정상'?(state?.settings.paused?'정상 · 요청 일시정지':'정상 실행 중'):label==='중지'?'중지 또는 연결 끊김 · 터미널 실행 상태를 확인하세요.':label;}
function parsePair(value){
  const raw=value.trim();if(!raw.startsWith('http'))return raw;
  const url=new URL(raw);if(url.origin!==location.origin||url.hostname!=='127.0.0.1')throw Error('현재 관리 화면과 같은 주소의 코드를 넣으세요.');
  return new URLSearchParams(url.hash.slice(1)).get('pair')||'';
}
function remember(){storage.set(sessionStorage,PAIR_SESSION,pair);storage.set(localStorage,PAIR_LOCAL,el('rememberPair').checked?pair:'');if(pair&&storage.get(sessionStorage,PAIR_SESSION)!==pair&&storage.get(localStorage,PAIR_LOCAL)!==pair)history.replaceState(null,'',location.pathname+'#pair='+encodeURIComponent(pair));}
async function api(route,body){
  if(!pair)throw Error('Termux가 표시한 연결 코드를 먼저 넣으세요.');
  const response=await fetch(route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+pair,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.message||data.code||'연결에 실패했습니다.'),{status:response.status});return data;
}
function formatTime(value){if(!value)return '—';return new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit'}).format(value);}
function formatDateTime(value){if(!value)return '없음';return new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'}).format(value);}
function duration(job){const end=job.finished_at||Date.now(),start=job.started_at;if(!start)return '';const seconds=Math.max(0,Math.floor((end-start)/1000)),minutes=Math.floor(seconds/60);return minutes?minutes+'분 '+String(seconds%60).padStart(2,'0')+'초':seconds+'초';}
function updateMeter(prefix,used,limit){
  const safeLimit=Math.max(1,Number(limit)||1),percent=Math.min(100,Math.max(0,used/safeLimit*100)),meter=el(prefix+'Meter');
  el(prefix+'Text').textContent=used+' / '+safeLimit+'회';el(prefix+'Remain').textContent='로컬 보호 한도 '+Math.max(0,safeLimit-used)+'회 남음';meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax',String(safeLimit));meter.setAttribute('aria-valuenow',String(used));meter.setAttribute('aria-valuetext',used+'회 사용 / 로컬 보호 한도 '+safeLimit+'회');
  requestAnimationFrame(()=>{meter.querySelector('.meter-fill').style.width=percent+'%';});
}
function updateTokens(tokens={}){
  for(const [id,key] of [['tokenInput','input_tokens'],['tokenOutput','output_tokens'],['tokenTotal','total_tokens']])el(id).textContent=(Number(tokens[key])||0).toLocaleString('ko-KR');
  const recorded=Number(tokens.recorded_jobs)||0,missing=Number(tokens.unreported_calls)||0;
  el('tokenNote').textContent='완료 응답 '+recorded.toLocaleString('ko-KR')+'건에 기록된 합계'+(missing?' · 사용량 미확인 '+missing.toLocaleString('ko-KR')+'회 제외':'')+'입니다.';
}
const validTokens=value=>Number.isSafeInteger(value)&&value>=0;
const formatTokens=value=>validTokens(value)?value.toLocaleString('ko-KR'):'미제공';
function jobTokenText(job){
  const usage=job.usage,input=usage?.input_tokens,output=usage?.output_tokens;
  if(!validTokens(input)||!validTokens(output))return job.status==='running'||job.status==='queued'?'응답 완료 후 실제 사용량을 표시합니다.':'토큰 사용량 추정 못함';
  const total=input+output;
  let text='입력 '+formatTokens(input)+' · 출력 '+formatTokens(output)+' · 총 '+formatTokens(total)+' 토큰';
  const cached=usage.input_tokens_details?.cached_tokens,reasoning=usage.output_tokens_details?.reasoning_tokens;
  if(validTokens(cached))text+='\n입력 중 캐시 '+formatTokens(cached)+' 토큰 (입력에 포함)';
  if(validTokens(reasoning))text+='\n출력 중 추론 '+formatTokens(reasoning)+' 토큰 (출력에 포함)';
  return text;
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
  el('modelSummary').textContent=connected?'연결됨 · '+(modelCache.at?'사용 가능 모델 '+models.length+'개':'모델 확인 필요'):'계정 연결이 필요합니다.';
}
function renderUpdate(){
  const labels={current:'최신 버전입니다.',available:'업데이트 있음',local_changes:'로컬 수정이 있어 자동 업데이트할 수 없습니다.',local_ahead:'설치본이 더 새롭습니다.',diverged:'저장소 기록을 확인하세요.'},methods=new Set(state?.update_methods||[]),installed=state?.install_method||'unknown',item=updateStates[installed];
  for(const method of ['git','zip']){const button=el('update'+(method==='git'?'Git':'Zip')),available=method===installed&&methods.has(method)&&updateStates[method]?.status==='available';button.hidden=!available;button.disabled=!available||!!state?.restart_busy||!!state?.update_busy;}
  el('updateResult').textContent=methods.size?item?(labels[item.status]||'확인하지 못했습니다.'):'업데이트를 확인해 주세요.':['git','zip'].includes(installed)?'관리 화면에서 업데이트하려면 감독 실행이 필요합니다.':'설치 상태를 확인하세요.';
  el('checkUpdate').disabled=!methods.size||!!state?.update_busy;el('checkUpdate').textContent=state?.update_busy?'확인 중…':'업데이트 확인';
  const available=[...methods].map(method=>updateStates[method]).find(value=>value?.status==='available');el('updateBadge').hidden=!available;el('updateBadge').textContent=available?'v'+available.latest_version+' 업데이트 가능':'';
}
async function checkUpdates(announce=true){for(const method of state?.update_methods||[])updateStates[method]=await api('/api/update/check?method='+method);renderUpdate();if(announce)message(Object.values(updateStates).some(item=>item?.status==='available')?'새 버전을 확인했습니다.':'업데이트 확인을 마쳤습니다.');}
function saveModels(models){modelCache={models:models.map(model=>({name:String(model.name||model.display_name||model.slug||''),slug:String(model.slug||'')})).filter(model=>model.slug),at:Date.now()};storage.set(localStorage,MODEL_CACHE,JSON.stringify(modelCache));renderAccount();}
async function refreshModels(announce=true){const models=await api('/api/models');if(!Array.isArray(models))throw Error('모델 목록 형식을 확인하지 못했습니다.');saveModels(models);if(announce)message('모델 정보와 확인 시간을 저장했습니다.');return models;}
function renderJobs(){
  const recent=state?.recent||[],groups=[
    {name:'진행 중',jobs:recent.filter(job=>['running','queued'].includes(job.status))},
    {name:'완료',jobs:recent.filter(job=>job.status==='completed')},
    {name:'오류',jobs:recent.filter(job=>!['running','queued','completed'].includes(job.status))}
  ];
  el('activeCount').textContent=groups[0].jobs.length;el('doneCount').textContent=groups[1].jobs.length;el('errorCount').textContent=groups[2].jobs.length;el('jobs').replaceChildren();
  if(!recent.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='아직 요청한 작업이 없습니다.';el('jobs').append(empty);return;}
  for(const group of groups){
    if(!group.jobs.length)continue;
    const heading=document.createElement('h3');heading.className='job-group';heading.textContent=group.name;el('jobs').append(heading);
    for(const job of group.jobs){
      const details=document.createElement('details');details.className='job '+job.status;details.dataset.requestId=job.request_id;
      const summary=document.createElement('summary'),top=document.createElement('div'),label=document.createElement('span'),time=document.createElement('time'),name=document.createElement('div'),meta=document.createElement('div'),body=document.createElement('div');
      const client=job.client||{};
      top.className='job-top';label.textContent=statusLabel(job.status);time.textContent=formatTime(job.created_at);
      name.className='job-name';name.textContent=[client.room_name,client.task_name].filter(Boolean).join(' · ')||client.name||job.model||'AI 요청';
      meta.className='job-meta';meta.textContent=[client.name,job.model,job.effort].filter(Boolean).join(' · ');
      top.append(label,time);summary.append(name,meta,top);
      const overview=document.createElement('p'),usage=document.createElement('p'),feedback=document.createElement('p');
      overview.className='job-overview';overview.textContent=statusLabel(job.status)+' · '+(job.started_at?'소요 '+duration(job):'실행 전');
      usage.className='job-usage';usage.textContent=jobTokenText(job);feedback.className='job-feedback';feedback.textContent='저장된 결과를 조회합니다.';
      const responseDetails=document.createElement('details'),responseTitle=document.createElement('summary'),responseText=document.createElement('pre');
      responseDetails.className='fold response-details';responseTitle.textContent='응답 내용';responseText.textContent='조회 중입니다.';responseDetails.append(responseTitle,responseText);
      const rawDetails=document.createElement('details'),rawTitle=document.createElement('summary'),rawText=document.createElement('pre');
      rawDetails.className='fold raw-details';rawTitle.textContent='원본 로그';rawDetails.append(rawTitle,rawText);
      body.className='job-body';body.append(overview,usage,feedback,responseDetails,rawDetails);details.append(summary,body);
      let loaded=false,saved=null;
      rawDetails.addEventListener('toggle',()=>{if(rawDetails.open&&saved)rawText.textContent=JSON.stringify(saved,null,2);});
      details.addEventListener('toggle',()=>{
        if(!details.open||loaded)return;loaded=true;
        api('/api/jobs/'+job.request_id).then(data=>{
          saved=data;feedback.textContent=data.message||'';feedback.hidden=!data.message;
          const fresh={...job,...data};usage.textContent=jobTokenText(fresh);overview.textContent=statusLabel(fresh.status)+' · '+(fresh.started_at?'소요 '+duration(fresh):'실행 전');
          responseText.textContent=data.status==='completed'?(data.text||'응답 내용이 없습니다.'):data.partial_text?'미완료 부분 응답입니다. 원문에 적용하지 마세요.\n'+data.partial_text:data.message||'완료된 응답이 없습니다.';
          if(rawDetails.open)rawText.textContent=JSON.stringify(data,null,2);
          if(data.status==='blocked_budget'){
            const resume=document.createElement('button');resume.className='btn secondary';resume.textContent='설정 확인 후 작업 재개';resume.addEventListener('click',()=>run(async()=>{await api('/api/jobs/'+job.request_id+'/resume',{});await refresh();}));body.append(resume);
          }
        }).catch(error=>{loaded=false;feedback.hidden=false;feedback.textContent=error.message;});
      });
      el('jobs').append(details);
    }
  }
}
function render(){
  for(const key of ['max_chars','max_calls_5h','max_calls_7d'])el(key).value=state.settings[key];
  el('bridgeVersion').textContent='v'+state.version;document.title='GPT 브리지 '+state.version;
  el('pause').textContent=state.settings.paused?'요청 재개':'요청 일시정지';el('restart').disabled=!state.can_restart||state.restart_busy;
  renderAccount();renderUpdate();serverState('정상','online');updateMeter('usage5',state.calls.five_hours,state.settings.max_calls_5h);updateMeter('usage7',state.calls.seven_days,state.settings.max_calls_7d);updateTokens(state.tokens);renderJobs();
  const latest=(state.recent||[]).filter(job=>job.status==='completed').sort((a,b)=>(b.finished_at||b.created_at)-(a.finished_at||a.created_at))[0];
  el('latestUsage').textContent=latest?jobTokenText(latest):'아직 완료된 응답이 없습니다.';
  el('latestUsageMeta').textContent=latest?[latest.client?.task_name,latest.model,formatDateTime(latest.finished_at||latest.created_at)].filter(Boolean).join(' · '):'';
}
function saveRefreshTime(){const now=Date.now();storage.set(localStorage,LAST_REFRESH,String(now));el('lastRefresh').textContent='마지막 갱신 '+formatTime(now);}
async function refresh(announce=true){try{state=await api('/api/status');render();saveRefreshTime();if(announce)message('서버 상태와 로컬 사용량을 갱신했습니다.');return state;}catch(error){serverState(error.status===401?'연결 필요':error.status?'오류':'중지','error');throw error;}}
async function run(task){if(busy)return;busy=true;try{await task();}catch(error){message(error.message,true);}finally{busy=false;}}
function selectTab(name){for(const tab of document.querySelectorAll('[data-tab]'))tab.setAttribute('aria-selected',String(tab.dataset.tab===name));for(const panel of document.querySelectorAll('.tab-panel'))panel.hidden=panel.id!==name+'Panel';}
for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>selectTab(tab.dataset.tab));
selectTab(pair?'server':'settings');
el('rememberPair').addEventListener('change',()=>remember());
el('connect').onclick=()=>run(async()=>{const next=parsePair(el('pair').value);if(!next)throw Error('연결 코드가 비어 있습니다.');if(next!==pair){modelCache={models:[],at:0};storage.set(localStorage,MODEL_CACHE,'');}pair=next;remember();await refresh();selectTab('server');if(state.connected&&!modelCache.models.length)await refreshModels(false);});
el('copy').onclick=()=>run(async()=>{if(!pair)throw Error('연결 코드를 먼저 넣으세요.');await navigator.clipboard.writeText(location.origin+'/#pair='+pair);message('이 기기의 연결 주소를 복사했습니다.');});
el('login').onclick=()=>run(async()=>{message('ChatGPT 구독 연결 화면을 여는 중입니다.');const result=await api('/api/login',{});location.assign(result.url);});
el('models').onclick=()=>run(async()=>{await refreshModels();el('modelDetails').open=true;});
el('logout').onclick=()=>run(async()=>{await api('/api/logout',{});modelCache={models:[],at:0};storage.set(localStorage,MODEL_CACHE,'');await refresh();message('계정 연결을 해제했습니다.');});
el('save').onclick=()=>run(async()=>{await api('/api/settings',Object.fromEntries(['max_chars','max_calls_5h','max_calls_7d'].map(key=>[key,Number(el(key).value)])));await refresh();});
el('pause').onclick=()=>run(async()=>{if(!state)await refresh();await api('/api/settings',{paused:!state.settings.paused});await refresh();});
el('usageRefresh').onclick=()=>run(refresh);el('refreshJobs').onclick=()=>run(refresh);
el('checkUpdate').onclick=()=>run(()=>checkUpdates());
async function reconnectAfterRestart(updated=false){
  const previous=state?.instance_id,deadline=Date.now()+300000;
  serverState('재시작 중','busy');message('서버가 다시 준비되면 연결 코드를 유지한 채 페이지를 엽니다.',false,true,true);
  while(Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,2000));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
    try{
      const response=await fetch('/api/status',{headers:{Authorization:'Bearer '+pair},cache:'no-store',signal:controller.signal});
      if(response.status===401)throw Object.assign(Error('연결 코드를 확인할 수 없습니다. 터미널에 표시된 관리 화면 주소 전체를 다시 열어 주세요.'),{status:401});
      if(!response.ok)continue;
      const next=await response.json();
      if(!next.instance_id||next.instance_id===previous||next.update_busy)continue;
      if(updated)storage.set(localStorage,UPDATE_STARTED,'');
      remember();history.replaceState(null,'',location.pathname+'#pair='+encodeURIComponent(pair));location.reload();return;
    }catch(error){if(error.status===401)throw error;}finally{clearTimeout(timer);}
  }
  throw Error('5분 동안 서버 재연결을 확인하지 못했습니다. 브리지 실행 상태를 확인한 뒤 터미널의 관리 화면 주소 전체를 다시 열어 주세요.');
}
async function applyUpdate(method){
  if(updateStates[method]?.status!=='available')throw Error('먼저 업데이트 확인을 눌러 주세요.');
  if(!confirm((method==='git'?'Git':'ZIP')+' 버전을 받고 서버를 재시작할까요? 진행 중인 요청이 있으면 실행되지 않습니다.'))return;
  storage.set(localStorage,UPDATE_STARTED,String(Date.now()));state.update_busy=true;renderUpdate();el('restart').disabled=true;serverState('업데이트 중','busy');message('확인된 새 버전을 적용하고 있습니다.',false,true,true);
  let result;
  try{result=await api('/api/update',{method});}catch(error){if(error.status){state.update_busy=false;render();throw Error(error.message+' 완료 표시가 보이지 않으면 5분 뒤 이 페이지를 다시 열고 서버 관리의 [재시작]을 눌러 주세요.');}}
  if(result?.updated===false){storage.set(localStorage,UPDATE_STARTED,'');state.update_busy=false;render();message(result.message||'업데이트할 파일이 없습니다.');return;}
  await reconnectAfterRestart(true);
}
el('updateGit').onclick=()=>run(()=>applyUpdate('git'));el('updateZip').onclick=()=>run(()=>applyUpdate('zip'));
el('restart').onclick=()=>run(async()=>{if(!confirm('진행 중인 요청이 없을 때 서버를 재시작합니다. 계속할까요?'))return;try{await api('/api/restart',{});}catch(error){if(error.status)throw error;}await reconnectAfterRestart();});
const last=Number(storage.get(localStorage,LAST_REFRESH));if(Number.isFinite(last)&&last>0)el('lastRefresh').textContent='마지막 갱신 '+formatTime(last);
if(pair){storage.set(sessionStorage,PAIR_SESSION,pair);run(async()=>{try{await refresh(false);try{await checkUpdates(false);}catch{renderUpdate();}if(state.connected&&!modelCache.models.length)await refreshModels(false);}catch(error){selectTab('settings');throw error;}});}else{serverState('연결 필요');renderAccount();message('Termux가 표시한 주소 전체를 열거나 연결 코드를 넣으세요.',true);}
const updateStarted=Number(storage.get(localStorage,UPDATE_STARTED));if(Number.isFinite(updateStarted)&&updateStarted>0)message('업데이트 완료 여부가 확인되지 않았습니다. 시작 '+formatDateTime(updateStarted)+' · 5분 뒤 이 페이지를 다시 열고 서버 관리의 [재시작]을 눌러 주세요.',false,true);
