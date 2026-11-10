/* Paste this class inside the original userscript's own scope.
 * Required grants: GM_getValue, GM_setValue, GM_xmlhttpRequest
 * Required connect: 127.0.0.1
 * This file never edits a webpage or starts an AI request on load.
 */
class LocalGPTClient {
  constructor({connection,storageKey='local-gpt-client-v1',getValue=GM_getValue,setValue=GM_setValue,request=GM_xmlhttpRequest,lock=globalThis.navigator?.locks}={}){
    const url=new URL(connection);
    if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port)throw Error('본인 폰의 127.0.0.1 연결 주소를 넣으세요.');
    this.base=url.origin;this.pair=new URLSearchParams(url.hash.slice(1)).get('pair');
    if(!this.pair||this.pair.length<32)throw Error('연결 코드가 포함된 주소 전체가 필요합니다.');
    this.key=storageKey;this.getValue=getValue;this.setValue=setValue;this.request=request;this.lock=lock;this.busy=false;
  }
  async api(route,body){
    return new Promise((resolve,reject)=>this.request({method:body===undefined?'GET':'POST',url:this.base+route,
      headers:{Authorization:'Bearer '+this.pair,'Content-Type':'application/json'},...(body===undefined?{}:{data:JSON.stringify(body)}),timeout:30000,
      onload:response=>{let data;try{data=JSON.parse(response.responseText);}catch{return reject(Error('로컬 서버 응답을 읽지 못했습니다.'));}
        if(response.status<200||response.status>=300){const error=Error(data.message||data.code);error.code=data.code;error.status=response.status;return reject(error);}resolve(data);},
      onerror:()=>reject(Error('Termux 서버에 연결하지 못했습니다. 같은 요청을 자동으로 다시 보내지 않습니다.')),
      ontimeout:()=>reject(Error('접수 여부가 불확실합니다. 기존 요청 상태를 먼저 확인하세요.'))
    }));
  }
  async fingerprint(context,payload){
    const bytes=new TextEncoder().encode(JSON.stringify({base:this.base,pair:this.pair,context,payload}));
    const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
  }
  async exclusive(action){
    const task=async()=>{if(this.busy)throw Error('이미 요청을 확인하는 중입니다.');this.busy=true;try{return await action();}finally{this.busy=false;}};
    return this.lock?this.lock.request(this.key,task):task();
  }
  async submit(context,payload){
    return this.exclusive(async()=>{
      const fingerprint=await this.fingerprint(context,payload),previous=await this.getValue(this.key,null);
      if(previous){
        if(previous.fingerprint!==fingerprint)throw Error('미확인 요청이 있습니다. 기존 결과를 확인하고 처리한 뒤 새 요청을 준비하세요.');
        return this.api('/api/jobs/'+previous.request_id); // GET only after an uncertain POST or reload.
      }
      const request_id=crypto.randomUUID();
      // Commit before POST. Do not change this ID automatically after errors.
      await this.setValue(this.key,{request_id,fingerprint,context,created_at:Date.now()});
      return this.api('/api/jobs',{...payload,request_id});
    });
  }
  async pending(){return this.getValue(this.key,null);}
  async checkPending(){const record=await this.pending();return record?this.api('/api/jobs/'+record.request_id):null;}
  async wait({pollMs=1500,maxWaitMs=900000}={}){
    const record=await this.pending();if(!record)throw Error('대기 중인 요청이 없습니다.');
    const deadline=Date.now()+maxWaitMs;
    while(Date.now()<deadline){
      const job=await this.api('/api/jobs/'+record.request_id);
      if(job.status==='completed')return job;
      if(['error','blocked_budget'].includes(job.status)){const error=Error(job.message||job.error_code||job.status);error.job=job;throw error;}
      await new Promise(resolve=>setTimeout(resolve,pollMs));
    }
    throw Error('대기 시간이 지났습니다. 요청 번호는 유지했습니다. 나중에 checkPending()으로 확인하세요.');
  }
  async acknowledge(requestId){
    return this.exclusive(async()=>{const record=await this.pending();if(record?.request_id===requestId)await this.setValue(this.key,null);});
  }
}
// Integration point, intentionally not called here:
// const client = new LocalGPTClient({connection: savedLocalConnection});
// await client.submit({roomId, messageId, sourceHash}, {
//   model: chosenModelSlug, effort: 'medium',
//   instructions: existingTranslationInstructions, input: originalText
// });
// const result = await client.wait();
// await persistReceivedResult(result);          // Keep it before applying.
// await verifyOriginalTargetIsStillUnchanged(); // Native ID + source + room.
// await applyViaExistingExtensionFunction(result.text);
// await client.acknowledge(result.request_id);  // Only after saved or deliberately discarded.
