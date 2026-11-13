'use strict';
const el=id=>document.getElementById(id);
const ICON_PATHS={refresh:'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16 M8 16H3v5',restart:'M3 10a9 9 0 1 1 2.6 8.4 M3 4v6h6',chevron:'m9 6 6 6-6 6',download:'M12 3v12 m-5-5 5 5 5-5 M5 16v5h14v-5',spinner:'M21 12a9 9 0 1 1-9-9',check:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M8 12l3 3 5-6',alert:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 7v6 M12 17h.01',clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M12 7v5l3 2',external:'M14 3h7v7 M21 3l-9 9 M10 3H3v18h18v-7'};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'20',height:'20',fill:'none',stroke:'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false',class:'ui-icon '+name}))svg.setAttribute(key,value);const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',ICON_PATHS[name]);svg.append(path);return svg;}
for(const [id,name] of [['restart','restart'],['updateGit','download'],['updateZip','download']])el(id).prepend(icon(name));
for(const id of ['usageRefresh','refreshJobs'])el(id).replaceChildren(icon('refresh'));
for(const summary of document.querySelectorAll('.fold>summary,.advanced>summary'))summary.prepend(icon('chevron'));
document.querySelector('.usage-link').replaceChildren(document.createTextNode('ChatGPT 공식 한도 확인'),icon('external'));
const PAIR_SESSION='gpt-bridge-pair-session-v1',PAIR_LOCAL='gpt-bridge-pair-local-v1',LAST_REFRESH='gpt-bridge-last-refresh-v1',MODEL_CACHE='gpt-bridge-model-cache-v1',UPDATE_STARTED='gpt-bridge-update-started-v1';
const storage={get:(area,key)=>{try{return area.getItem(key)||'';}catch{return '';}},set:(area,key,value)=>{try{value?area.setItem(key,value):area.removeItem(key);}catch{}}};
const fragmentPair=new URLSearchParams(location.hash.slice(1)).get('pair')||'',savedPair=storage.get(localStorage,PAIR_LOCAL);
function readModelCache(){try{const value=JSON.parse(storage.get(localStorage,MODEL_CACHE)||'null');return value&&Array.isArray(value.models)?{models:value.models.filter(model=>model&&model.slug),at:Number(value.at)||0}:{models:[],at:0};}catch{return {models:[],at:0};}}
let pair=fragmentPair||storage.get(sessionStorage,PAIR_SESSION)||savedPair,state=null,updateStates={git:null,zip:null},busy=false,modelCache=readModelCache();
function readRecovery(){
  for(const raw of [history.state?.bridgeRecovery,storage.get(localStorage,UPDATE_STARTED),storage.get(sessionStorage,UPDATE_STARTED)])try{
    const value=typeof raw==='string'?JSON.parse(raw||'null'):raw;
    if(typeof value==='number'&&value>0)return {kind:'legacy',started_at:value};
    if(['update','restart'].includes(value?.kind)&&Number.isFinite(value.started_at)&&value.started_at>0&&value.started_at<=Date.now()+60000)return value;
  }catch{}
  return null;
}
let recovery=readRecovery(),reconnecting=false;
function saveRecovery(value){recovery=value;for(const area of [localStorage,sessionStorage])storage.set(area,UPDATE_STARTED,value?JSON.stringify(value):'');try{history.replaceState({...history.state,bridgeRecovery:value},'',location.href);}catch{}}
const pendingRecovery=()=>recovery&&recovery.kind!=='legacy'&&recovery.phase!=='complete';
if(pair)storage.set(sessionStorage,PAIR_SESSION,pair);
if(location.hash&&(storage.get(sessionStorage,PAIR_SESSION)===pair||savedPair===pair))history.replaceState(history.state,'',location.pathname);
el('pair').value=pair;el('rememberPair').checked=!!savedPair&&savedPair===pair;
let messageTimer=null;
function message(text,error=false,sticky=false,progress=false,tone=''){clearTimeout(messageTimer);el('status').hidden=false;el('status').textContent=text;el('status').className='notice'+(error?' error':progress?' progress':tone==='unknown'?' unknown':'');if(progress)el('status').prepend(icon('spinner'));if(!error&&!sticky)messageTimer=setTimeout(()=>{el('status').hidden=true;},2400);}
function serverState(label,kind=''){el('serverState').className='server-state '+kind;el('serverState').querySelector('span').textContent=label;el('serverState').replaceChild(icon(kind==='online'?'check':kind==='busy'?'spinner':['error','warning'].includes(kind)?'alert':'clock'),el('serverState').firstElementChild);el('serverHealth').textContent=label==='정상'?(state?.settings.paused?'정상 · 요청 일시정지':'정상 실행 중'):label==='중지'?'연결이 끊겼어요. 브리지 실행 화면을 확인해 주세요.':label;}
function parsePair(value){
  const raw=value.trim();if(!raw.startsWith('http'))return raw;
  const url=new URL(raw);if(url.origin!==location.origin||url.hostname!=='127.0.0.1')throw Error('현재 관리 화면과 같은 주소의 코드를 넣으세요.');
  return new URLSearchParams(url.hash.slice(1)).get('pair')||'';
}
function remember(){storage.set(sessionStorage,PAIR_SESSION,pair);storage.set(localStorage,PAIR_LOCAL,el('rememberPair').checked?pair:'');if(pair&&storage.get(sessionStorage,PAIR_SESSION)!==pair&&storage.get(localStorage,PAIR_LOCAL)!==pair)history.replaceState(history.state,'',location.pathname+'#pair='+encodeURIComponent(pair));}
async function api(route,body,signal){
  if(!pair)throw Error('Termux가 표시한 연결 코드를 먼저 넣으세요.');
  const response=await fetch(route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+pair,'Content-Type':'application/json'},cache:'no-store',signal,...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.message||data.code||'연결에 실패했습니다.'),{status:response.status,code:data.code});return data;
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
  for(const method of ['git','zip']){const button=el('update'+(method==='git'?'Git':'Zip')),available=method===installed&&methods.has(method)&&updateStates[method]?.status==='available';button.hidden=!available;button.disabled=!available||!!state?.restart_busy||!!state?.update_busy||!!pendingRecovery()||reconnecting;}
  el('updateResult').textContent=methods.size?item?(labels[item.status]||'확인하지 못했습니다.'):'업데이트를 확인해 주세요.':['git','zip'].includes(installed)?'관리 화면에서 업데이트하려면 감독 실행이 필요합니다.':'설치 상태를 확인하세요.';
  if(recovery?.kind==='update')el('updateResult').textContent=({applying:'업데이트 적용 중',restarting:'브리지 재시작 중',verifying:'업데이트 결과 확인 중',unknown:'업데이트 결과 미확인',complete:'업데이트 완료'})[recovery.phase]||'업데이트 결과 확인 중';
  el('checkUpdate').disabled=reconnecting||(!pendingRecovery()&&(!methods.size||!!state?.update_busy));el('checkUpdate').replaceChildren(icon(reconnecting?'spinner':'refresh'),document.createTextNode(pendingRecovery()?(recovery.kind==='restart'?'연결 다시 확인':'결과 다시 확인'):'업데이트 확인'));
  const available=[...methods].map(method=>updateStates[method]).find(value=>value?.status==='available');el('updateBadge').hidden=!available;el('updateBadge').textContent=available?'v'+available.latest_version+' 업데이트 가능':'';
}
async function checkUpdates(announce=true){for(const method of state?.update_methods||[])updateStates[method]=await api('/api/update/check?method='+method);renderUpdate();if(announce)message(Object.values(updateStates).some(item=>item?.status==='available')?'새 버전을 확인했습니다.':'업데이트 확인을 마쳤습니다.');}
function saveModels(models){modelCache={models:models.map(model=>({name:String(model.name||model.display_name||model.slug||''),slug:String(model.slug||'')})).filter(model=>model.slug),at:Date.now()};storage.set(localStorage,MODEL_CACHE,JSON.stringify(modelCache));renderAccount();}
async function refreshModels(announce=true){const models=await api('/api/models');if(!Array.isArray(models))throw Error('모델 목록 형식을 확인하지 못했습니다.');saveModels(models);if(announce)message('모델 정보와 확인 시간을 저장했습니다.');return models;}
const compactJobs=matchMedia('(max-width:599px)');
compactJobs.addEventListener('change',()=>{for(const cell of document.querySelectorAll('.job-span'))cell.colSpan=compactJobs.matches?3:4;const title=document.querySelector('.job-title-column');if(title)title.textContent=compactJobs.matches?'작업 / 모델':'작업명';});
function renderJobs(){
  const recent=state?.recent||[],groups=[
    {name:'진행 중',jobs:recent.filter(job=>['running','queued'].includes(job.status))},
    {name:'완료',jobs:recent.filter(job=>job.status==='completed')},
    {name:'오류',jobs:recent.filter(job=>!['running','queued','completed'].includes(job.status))}
  ];
  el('activeCount').textContent=groups[0].jobs.length;el('doneCount').textContent=groups[1].jobs.length;el('errorCount').textContent=groups[2].jobs.length;el('jobs').replaceChildren();
  if(!recent.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='아직 요청한 작업이 없습니다.';el('jobs').append(empty);return;}
  const table=document.createElement('table');table.className='job-table';
  const caption=document.createElement('caption');caption.className='sr-only';caption.textContent='최근 작업 목록';table.append(caption);
  const head=document.createElement('thead'),headRow=document.createElement('tr');
  for(const [text,className] of [[compactJobs.matches?'작업 / 모델':'작업명','job-title-column'],['모델','model-column'],['상태','status-column'],['시간','time-column']]){
    const cell=document.createElement('th');cell.scope='col';cell.className=className;cell.textContent=text;headRow.append(cell);
  }
  head.append(headRow);table.append(head);
  let openButton=null,openRow=null,index=0;
  const close=()=>{if(openRow){openRow.hidden=true;openButton.setAttribute('aria-expanded','false');}openRow=null;openButton=null;};
  table.addEventListener('keydown',event=>{if(event.key==='Escape'&&openRow){const target=openButton;close();target.focus();event.preventDefault();}});
  for(const group of groups){
    if(!group.jobs.length)continue;
    const section=document.createElement('tbody'),groupRow=document.createElement('tr'),groupCell=document.createElement('th');
    groupRow.className='job-group';groupCell.className='job-span';groupCell.colSpan=compactJobs.matches?3:4;groupCell.scope='rowgroup';groupCell.textContent=group.name+' · '+group.jobs.length;groupRow.append(groupCell);section.append(groupRow);
    for(const job of group.jobs){
      const row=document.createElement('tr');row.className='job-row '+job.status;row.dataset.requestId=job.request_id;
      const titleCell=document.createElement('td'),modelCell=document.createElement('td'),statusCell=document.createElement('td'),timeCell=document.createElement('td'),toggle=document.createElement('button');
      const client=job.client||{},title=[client.room_name,client.task_name].filter(Boolean).join(' · ')||client.name||job.model||'AI 요청';
      const name=document.createElement('span'),meta=document.createElement('span'),mobileModel=document.createElement('span'),text=document.createElement('span');
      name.className='job-name';name.textContent=title;name.title=title;
      meta.className='job-meta';meta.append(document.createTextNode(client.name||'클라이언트 미지정'));
      mobileModel.className='mobile-model';mobileModel.textContent=' · '+[job.model,job.effort].filter(Boolean).join(' · ');meta.append(mobileModel);meta.title=[client.name,job.model,job.effort].filter(Boolean).join(' · ');
      text.className='job-title-text';text.append(name,meta);toggle.type='button';toggle.className='job-toggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label',title+' 상세');toggle.append(icon('chevron'),text);titleCell.append(toggle);
      modelCell.className='model-column';const model=document.createElement('span'),effort=document.createElement('span');model.className='job-model';model.textContent=job.model||'—';model.title=job.model||'';effort.className='job-meta';effort.textContent=job.effort||'';modelCell.append(model,effort);
      statusCell.className='status-column';const status=document.createElement('span');status.className='job-status';
      if(job.status==='completed'){const dot=document.createElement('span');dot.className='status-dot';dot.setAttribute('aria-hidden','true');status.append(dot);}else status.append(icon(job.status==='running'?'spinner':job.status==='queued'?'clock':'alert'));
      status.append(document.createTextNode(statusLabel(job.status)));statusCell.append(status);
      timeCell.className='time-column';const time=document.createElement('time'),date=document.createElement('span');time.textContent=job.created_at?new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(job.created_at):'—';if(job.created_at)time.dateTime=new Date(job.created_at).toISOString();time.title=formatDateTime(job.created_at);date.className='job-date';date.textContent=job.created_at?new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric'}).format(job.created_at):'';timeCell.append(time,date);
      row.append(titleCell,modelCell,statusCell,timeCell);
      const detailRow=document.createElement('tr'),detailCell=document.createElement('td'),body=document.createElement('div');
      detailRow.className='job-detail';detailRow.hidden=true;detailCell.className='job-span';detailCell.colSpan=compactJobs.matches?3:4;body.className='job-body';body.id='job-detail-'+index++;toggle.setAttribute('aria-controls',body.id);
      const overview=document.createElement('p'),usage=document.createElement('p'),feedback=document.createElement('p');
      overview.className='job-overview';overview.textContent=statusLabel(job.status)+' · '+(job.started_at?'소요 '+duration(job):'실행 전');
      usage.className='job-usage';usage.textContent=jobTokenText(job);feedback.className='job-feedback';feedback.textContent='저장된 결과를 조회합니다.';
      const responseDetails=document.createElement('details'),responseTitle=document.createElement('summary'),responseText=document.createElement('pre');
      responseDetails.className='fold response-details';responseTitle.append(icon('chevron'),document.createTextNode('응답 내용'));responseText.textContent='조회 중입니다.';responseDetails.append(responseTitle,responseText);
      const rawDetails=document.createElement('details'),rawTitle=document.createElement('summary'),rawText=document.createElement('pre');
      rawDetails.className='fold raw-details';rawTitle.append(icon('chevron'),document.createTextNode('원본 로그'));rawDetails.append(rawTitle,rawText);
      body.append(overview,usage,feedback,responseDetails,rawDetails);detailCell.append(body);detailRow.append(detailCell);
      let loaded=false,saved=null;
      rawDetails.addEventListener('toggle',()=>{if(rawDetails.open&&saved)rawText.textContent=JSON.stringify(saved,null,2);});
      const expand=()=>{
        if(openRow===detailRow){close();return;}close();detailRow.hidden=false;toggle.setAttribute('aria-expanded','true');openRow=detailRow;openButton=toggle;
        if(loaded)return;loaded=true;
        api('/api/jobs/'+job.request_id).then(data=>{
          saved=data;feedback.textContent=data.message||'';feedback.hidden=!data.message;
          const fresh={...job,...data};usage.textContent=jobTokenText(fresh);overview.textContent=statusLabel(fresh.status)+' · '+(fresh.started_at?'소요 '+duration(fresh):'실행 전');
          responseText.textContent=data.status==='completed'?(data.text||'응답 내용이 없습니다.'):data.partial_text?'미완료 부분 응답입니다. 원문에 적용하지 마세요.\n'+data.partial_text:data.message||'완료된 응답이 없습니다.';
          if(rawDetails.open)rawText.textContent=JSON.stringify(data,null,2);
          if(data.status==='blocked_budget'){
            const resume=document.createElement('button');resume.className='btn secondary';resume.textContent='설정 확인 후 작업 재개';resume.addEventListener('click',()=>run(async()=>{await api('/api/jobs/'+job.request_id+'/resume',{});await refresh();}));body.append(resume);
          }
        }).catch(error=>{loaded=false;feedback.hidden=false;feedback.textContent=error.message;});
      };
      toggle.addEventListener('click',expand);row.addEventListener('click',event=>{if(!event.target.closest('button'))expand();});
      section.append(row,detailRow);
    }
    table.append(section);
  }
  el('jobs').append(table);
}
function render(){
  for(const key of ['max_chars','max_calls_5h','max_calls_7d'])el(key).value=state.settings[key];
  el('bridgeVersion').textContent='v'+state.version;document.title='GPT 브리지 '+state.version;
  el('pause').textContent=state.settings.paused?'요청 재개':'요청 일시정지';el('restart').disabled=!state.can_restart||state.restart_busy||!!pendingRecovery()||reconnecting;
  renderAccount();renderUpdate();serverState('정상','online');updateMeter('usage5',state.calls.five_hours,state.settings.max_calls_5h);updateMeter('usage7',state.calls.seven_days,state.settings.max_calls_7d);updateTokens(state.tokens);renderJobs();
  const latest=(state.recent||[]).filter(job=>job.status==='completed').sort((a,b)=>(b.finished_at||b.created_at)-(a.finished_at||a.created_at))[0];
  el('latestUsage').textContent=latest?jobTokenText(latest):'아직 완료된 응답이 없습니다.';
  el('latestUsageMeta').textContent=latest?[latest.client?.task_name,latest.model,formatDateTime(latest.finished_at||latest.created_at)].filter(Boolean).join(' · '):'';
}
function saveRefreshTime(){const now=Date.now();storage.set(localStorage,LAST_REFRESH,String(now));el('lastRefresh').textContent='마지막 갱신 '+formatTime(now);}
async function refresh(announce=true){try{state=await api('/api/status');render();saveRefreshTime();if(pendingRecovery()&&!reconnecting){if(recoveryConfirmed(state))recoveryComplete(state,true);else recoveryUnknown(state);}else if(announce)message('서버 상태와 로컬 사용량을 갱신했습니다.');return state;}catch(error){serverState(error.status===401?'연결 필요':error.status?'오류':'중지',error.status?'error':'warning');throw error;}}
async function run(task){if(busy)return;busy=true;try{await task();}catch(error){message(error.message,true);}finally{busy=false;}}
function selectTab(name){for(const tab of document.querySelectorAll('[data-tab]'))tab.setAttribute('aria-selected',String(tab.dataset.tab===name));for(const panel of document.querySelectorAll('.tab-panel'))panel.hidden=panel.id!==name+'Panel';}
for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>selectTab(tab.dataset.tab));
selectTab(pair?'server':'settings');
el('rememberPair').addEventListener('change',()=>remember());
el('connect').onclick=()=>run(async()=>{const next=parsePair(el('pair').value);if(!next)throw Error('연결 코드가 비어 있습니다.');if(next!==pair){modelCache={models:[],at:0};storage.set(localStorage,MODEL_CACHE,'');saveRecovery(null);}pair=next;remember();await refresh();selectTab('server');if(state.connected&&!modelCache.models.length)await refreshModels(false);});
el('copy').onclick=()=>run(async()=>{if(!pair)throw Error('연결 코드를 먼저 넣으세요.');await navigator.clipboard.writeText(location.origin+'/#pair='+pair);message('이 기기의 연결 주소를 복사했습니다.');});
el('login').onclick=()=>run(async()=>{message('ChatGPT 구독 연결 화면을 여는 중입니다.');const result=await api('/api/login',{});location.assign(result.url);});
el('models').onclick=()=>run(async()=>{await refreshModels();el('modelDetails').open=true;});
el('logout').onclick=()=>run(async()=>{await api('/api/logout',{});modelCache={models:[],at:0};storage.set(localStorage,MODEL_CACHE,'');await refresh();message('계정 연결을 해제했습니다.');});
el('save').onclick=()=>run(async()=>{await api('/api/settings',Object.fromEntries(['max_chars','max_calls_5h','max_calls_7d'].map(key=>[key,Number(el(key).value)])));await refresh();});
el('pause').onclick=()=>run(async()=>{if(!state)await refresh();await api('/api/settings',{paused:!state.settings.paused});await refresh();});
el('usageRefresh').onclick=()=>run(refresh);el('refreshJobs').onclick=()=>run(refresh);
el('checkUpdate').onclick=()=>run(()=>pendingRecovery()?reconnectAfterRestart(true,true):checkUpdates());
function versionAtLeast(current,target){
  if(!/^\d+\.\d+\.\d+$/.test(current||'')||!/^\d+\.\d+\.\d+$/.test(target||''))return false;
  const a=current.split('.').map(Number),b=target.split('.').map(Number);
  for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];
  return true;
}
function recoveryConfirmed(next){return !!(recovery?.previous_instance&&next.instance_id&&next.instance_id!==recovery.previous_instance&&!next.update_busy&&(recovery.kind==='restart'||versionAtLeast(next.version,recovery.target_version)));}
function recoveryProgress(phase){
  saveRecovery({...recovery,phase});reconnecting=true;
  if(state)render();else renderUpdate();
  el('restart').disabled=true;
  serverState(phase==='applying'?'업데이트 중':phase==='restarting'?'재시작 중':'결과 확인 중','busy');
  message(phase==='applying'?'업데이트를 적용하고 있어요.':phase==='restarting'?'브리지를 다시 시작하고 있어요.':recovery.kind==='update'?'업데이트 결과를 확인하고 있어요.':'브리지 연결을 확인하고 있어요.',false,true,true);
}
async function timedApi(route,body,timeout=4000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{return await api(route,body,controller.signal);}finally{clearTimeout(timer);}
}
function recoveryComplete(next,reload){
  state=next;reconnecting=false;saveRecovery({...recovery,phase:'complete'});render();saveRefreshTime();
  message(recovery.kind==='update'?'v'+next.version+' 새 버전으로 업데이트했어요.':'브리지를 다시 시작했어요.',false,true);
  if(!reload){saveRecovery(null);return;}
  try{remember();history.replaceState(history.state,'',location.pathname+'#pair='+encodeURIComponent(pair));location.reload();}
  catch{message('브리지는 정상 실행 중이에요. 페이지를 다시 열지 못했습니다. 현재 페이지를 새로고침해 주세요.',false,true,false,'unknown');}
}
function recoveryUnknown(next,unauthorized=false){
  reconnecting=false;saveRecovery({...recovery,phase:'unknown'});
  if(next){state=next;render();}else{if(state)render();else renderUpdate();serverState(unauthorized?'연결 필요':'중지',unauthorized?'error':'warning');}
  const text=recovery.kind==='update'?'업데이트 결과를 아직 확인하지 못했어요.':'브리지 연결을 아직 확인하지 못했어요.';
  message(text+(unauthorized?' 브리지 실행 화면의 연결 주소 전체를 다시 열어 주세요.':next?' 현재 v'+next.version+'가 응답하고 있어요. ['+(recovery.kind==='update'?'결과 다시 확인':'연결 다시 확인')+']으로 다시 확인할 수 있어요.':' 브리지 실행 화면을 확인한 뒤 다시 확인해 주세요.'),recovery.kind==='restart',true,false,'unknown');
}
async function reconnectAfterRestart(reload=true,manual=false){
  // Reloading keeps the original deadline; an explicit recheck gets a short GET-only window.
  const deadline=manual?Date.now()+15000:recovery.started_at+300000;
  let next=null,first=true,applying=recovery.phase==='applying';
  recoveryProgress(recovery.phase==='restarting'?'restarting':'verifying');
  while(first||Date.now()<deadline){
    if(!first)await new Promise(resolve=>setTimeout(resolve,2000));first=false;next=null;
    try{next=await timedApi('/api/status');}
    catch(error){if(error.status===401){recoveryUnknown(null,true);return false;}}
    if(next){
      if(recoveryConfirmed(next)){recoveryComplete(next,reload);return true;}
      state=next;recoveryProgress(applying&&next.update_busy&&next.instance_id===recovery.previous_instance?'applying':next.instance_id===recovery.previous_instance||next.update_busy?'restarting':'verifying');
    }
    if(Date.now()>=deadline)break;
  }
  recoveryUnknown(next);return false;
}
async function startControl(kind,method){
  if(pendingRecovery())return reconnectAfterRestart(true,true);
  if(kind==='update'&&updateStates[method]?.status!=='available')throw Error('먼저 업데이트 확인을 눌러 주세요.');
  if(!confirm(kind==='update'?'새 버전을 받고 브리지를 다시 시작할까요? 진행 중인 요청이 있으면 실행되지 않습니다.':'진행 중인 요청이 없을 때 브리지를 다시 시작할까요?'))return;
  saveRecovery({kind,started_at:Date.now(),previous_instance:state.instance_id,target_version:kind==='update'?updateStates[method].latest_version:'',phase:kind==='update'?'applying':'restarting'});
  recoveryProgress(recovery.phase);
  let result;
  try{result=await timedApi(kind==='update'?'/api/update':'/api/restart',kind==='update'?{method}:{},120000);}
  catch(error){
    if(error.status){
      let next=null;try{next=await timedApi('/api/status');}catch{}
      if(next&&recoveryConfirmed(next)){recoveryComplete(next,true);return;}
      reconnecting=false;saveRecovery(null);if(next){state=next;render();}else{render();serverState(error.status===401?'연결 필요':'중지',error.status===401?'error':'warning');}
      message((kind==='update'?'업데이트하지 못했어요.':'브리지를 다시 시작하지 못했어요.')+(error.code==='BUSY'?' 진행 중인 작업이 끝나면 다시 시도해 주세요.':error.status===401?' 브리지 실행 화면의 연결 주소 전체를 다시 열어 주세요.':' 연결 상태를 확인한 뒤 다시 시도해 주세요.'),true,true);return;
    }
  }
  if(result?.updated===false){reconnecting=false;saveRecovery(null);await refresh(false);await checkUpdates(false);message('적용할 업데이트가 없어요.',false,true,false,'unknown');return;}
  recoveryProgress('restarting');await reconnectAfterRestart();
}
el('updateGit').onclick=()=>run(()=>startControl('update','git'));el('updateZip').onclick=()=>run(()=>startControl('update','zip'));
el('restart').onclick=()=>run(()=>startControl('restart'));
const last=Number(storage.get(localStorage,LAST_REFRESH));if(Number.isFinite(last)&&last>0)el('lastRefresh').textContent='마지막 갱신 '+formatTime(last);
if(pair){storage.set(sessionStorage,PAIR_SESSION,pair);run(async()=>{try{
  if(recovery&&recovery.kind!=='legacy'){if(!await reconnectAfterRestart(false))return;}
  else{await refresh(false);if(recovery?.kind==='legacy'){saveRecovery(null);message('현재 v'+state.version+' 브리지가 응답하고 있어요. 이전 업데이트 결과는 기록이 부족해 확인할 수 없어요.',false,true,false,'unknown');}}
  try{await checkUpdates(false);}catch{renderUpdate();}if(state.connected&&!modelCache.models.length)await refreshModels(false);
}catch(error){selectTab('settings');throw error;}});}else{serverState('연결 필요');renderAccount();message('브리지 실행 화면의 주소 전체를 열거나 연결 코드를 넣으세요.',true);}
