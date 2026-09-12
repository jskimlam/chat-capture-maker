const $ = (id) => document.getElementById(id);
const qs = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];

const state = {
  platform: 'kakao',
  messages: [],
  originals: [],
  avatars: { A: '', B: '' },
  currentLang: 'ko',
};

const els = {
  platformPicker: $('platformPicker'), chatTitle: $('chatTitle'), chatDate: $('chatDate'), startTime: $('startTime'),
  toneSelect: $('toneSelect'), nameA: $('nameA'), nameB: $('nameB'), contextHint: $('contextHint'),
  rawConversation: $('rawConversation'), messageEditor: $('messageEditor'), messageCount: $('messageCount'),
  previewTitle: $('previewTitle'), platformLabel: $('platformLabel'), dateSeparator: $('dateSeparator'),
  messageList: $('messageList'), captureTarget: $('captureTarget'), chatScroll: $('chatScroll'),
  statusTime: $('statusTime'), mockupToggle: $('mockupToggle'), mockupMark: $('mockupMark'),
  apiDialog: $('apiDialog'), gasUrl: $('gasUrl'), apiStatus: $('apiStatus'), toast: $('toast')
};

const platformNames = { kakao: 'KakaoTalk', wechat: 'WeChat', whatsapp: 'WhatsApp', telegram: 'Telegram' };
const platformPlaceholders = { kakao:'메시지 입력', wechat:'Message', whatsapp:'Type a message', telegram:'Message' };

function pad(n){ return String(n).padStart(2,'0'); }
function localDateValue(d=new Date()){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function localTimeValue(d=new Date()) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function initDefaults(){
  els.chatDate.value = localDateValue();
  els.startTime.value = localTimeValue();
  els.statusTime.textContent = localTimeValue();
  const savedUrl = localStorage.getItem('chatCaptureGasUrl') || '';
  els.gasUrl.value = savedUrl;
  updateApiStatus();
  parseConversation();
  bindEvents();
  renderAll();
}

function bindEvents(){
  els.platformPicker.addEventListener('click', e => {
    const card = e.target.closest('[data-platform]'); if(!card) return;
    state.platform = card.dataset.platform;
    qsa('.platform-card').forEach(x=>x.classList.toggle('active', x===card));
    renderPreview();
  });
  ['chatTitle','chatDate','startTime','nameA','nameB','toneSelect','contextHint'].forEach(id => {
    $(id).addEventListener('input', ()=>{ regenerateTimes(); renderAll(); });
  });
  $('parseBtn').addEventListener('click', parseConversation);
  $('addMessageBtn').addEventListener('click', () => {
    state.messages.push({speaker:'B', text:'새 메시지', original:'새 메시지', time:''});
    state.originals = state.messages.map(m=>({...m, text:m.original || m.text}));
    regenerateTimes(); renderAll();
  });
  $('resetBtn').addEventListener('click', resetApp);
  $('saveDraftBtn').addEventListener('click', saveDraft);
  $('loadDraftBtn').addEventListener('click', loadDraft);
  $('captureScreenBtn').addEventListener('click', ()=>capturePng(false));
  $('captureFullBtn').addEventListener('click', ()=>capturePng(true));
  $('apiSettingsBtn').addEventListener('click', ()=>els.apiDialog.showModal());
  $('saveApiBtn').addEventListener('click', saveApiUrl);
  els.mockupToggle.addEventListener('change', ()=>els.mockupMark.style.display = els.mockupToggle.checked ? 'block':'none');
  qsa('[data-lang]').forEach(btn => btn.addEventListener('click', ()=>handleLanguage(btn.dataset.lang)));
  qsa('[data-ai="naturalize"]').forEach(btn => btn.addEventListener('click', ()=>runAi('naturalize', state.currentLang)));
  $('avatarA').addEventListener('change', e=>loadAvatar(e,'A'));
  $('avatarB').addEventListener('change', e=>loadAvatar(e,'B'));
}

function parseConversation(){
  const lines = els.rawConversation.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const parsed = [];
  let current = null;
  for(const line of lines){
    const match = line.match(/^([AB])\s*[:：]\s*(.*)$/i);
    if(match){
      current = { speaker: match[1].toUpperCase(), text: match[2], original: match[2], time:'' };
      parsed.push(current);
    }else if(current){
      current.text += `\n${line}`; current.original += `\n${line}`;
    }
  }
  if(!parsed.length){ showToast('A: / B: 형식의 대화를 입력해 주세요.'); return; }
  state.messages = parsed;
  state.originals = parsed.map(m=>({...m}));
  state.currentLang = 'ko';
  regenerateTimes();
  renderAll();
  showToast(`${parsed.length}개 메시지를 적용했습니다.`);
}

function regenerateTimes(){
  if(!state.messages.length) return;
  const [h,m] = (els.startTime.value || '09:00').split(':').map(Number);
  let cursor = h*60 + m;
  state.messages.forEach((msg, i)=>{
    if(i>0){
      const prevLen = state.messages[i-1].text.length;
      const step = 1 + ((i + Math.floor(prevLen/28)) % 3 === 0 ? 1 : 0);
      cursor += step;
    }
    msg.time = `${pad(Math.floor((cursor%(24*60))/60))}:${pad(cursor%60)}`;
  });
}

function renderAll(){
  els.messageCount.textContent = `${state.messages.length}개`;
  renderMessageEditor();
  renderPreview();
}

function renderMessageEditor(){
  els.messageEditor.innerHTML = '';
  state.messages.forEach((msg, index)=>{
    const row = document.createElement('div'); row.className='message-edit-row';
    const toggle = document.createElement('button'); toggle.className='speaker-toggle'; toggle.textContent=msg.speaker;
    toggle.title='화자 전환'; toggle.onclick=()=>{ msg.speaker = msg.speaker==='A'?'B':'A'; renderAll(); };
    const ta = document.createElement('textarea'); ta.value=msg.text; ta.oninput=()=>{ msg.text=ta.value; renderPreview(); };
    const tm = document.createElement('div'); tm.className='auto-time'; tm.textContent=msg.time;
    const del = document.createElement('button'); del.className='delete-message'; del.textContent='×'; del.onclick=()=>{ state.messages.splice(index,1); regenerateTimes(); renderAll(); };
    row.append(toggle,ta,tm,del); els.messageEditor.append(row);
  });
}

function renderPreview(){
  els.captureTarget.className = `phone platform-${state.platform}`;
  els.previewTitle.textContent = els.chatTitle.value || els.nameB.value || 'Chat';
  els.platformLabel.textContent = platformNames[state.platform];
  els.dateSeparator.textContent = formatDate(els.chatDate.value, state.platform);
  qs('.fake-input', els.captureTarget).textContent = platformPlaceholders[state.platform];
  els.messageList.innerHTML='';
  const groupEnds = state.messages.map((m,i)=> i===state.messages.length-1 || state.messages[i+1].speaker!==m.speaker || state.messages[i+1].time!==m.time);
  state.messages.forEach((msg,i)=>{
    const mine = msg.speaker==='A';
    const row = document.createElement('div'); row.className=`message-row ${mine?'mine':'theirs'}`;
    if(!mine && isFirstOfGroup(i)) row.append(makeAvatar('B'));
    else if(!mine){ const spacer=document.createElement('div'); spacer.style.width='36px'; spacer.style.flex='0 0 36px'; row.append(spacer); }
    const stack=document.createElement('div'); stack.className='message-stack';
    if(!mine && isFirstOfGroup(i)){
      const sender=document.createElement('div'); sender.className='sender-name'; sender.textContent=els.nameB.value || 'B'; stack.append(sender);
    }
    const line=document.createElement('div'); line.className='bubble-line';
    const bubble=document.createElement('div'); bubble.className=`bubble ${mine?'self':'other'}`; bubble.textContent=msg.text;
    line.append(bubble);
    if(groupEnds[i]){ const time=document.createElement('span'); time.className='msg-time'; time.textContent=formatTime(msg.time,state.platform); line.append(time); }
    stack.append(line); row.append(stack); els.messageList.append(row);
  });
  els.mockupMark.style.display = els.mockupToggle.checked ? 'block':'none';
}

function isFirstOfGroup(i){ return i===0 || state.messages[i-1].speaker!==state.messages[i].speaker; }
function makeAvatar(speaker){
  const d=document.createElement('div'); d.className='msg-avatar';
  if(state.avatars[speaker]){ const img=document.createElement('img'); img.src=state.avatars[speaker]; img.style.display='block'; d.append(img); }
  else d.textContent=(speaker==='A'?(els.nameA.value||'A'):(els.nameB.value||'B')).slice(0,1).toUpperCase();
  return d;
}

function formatDate(value, platform){
  if(!value) return '';
  const d=new Date(`${value}T12:00:00`);
  if(platform==='kakao') return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(d);
  if(platform==='wechat') return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric'}).format(d);
  if(platform==='whatsapp') return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(d);
  return new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric'}).format(d);
}
function formatTime(value, platform){
  if(!value) return '';
  const [h,m]=value.split(':').map(Number);
  if(platform==='kakao') return `${h<12?'오전':'오후'} ${h%12||12}:${pad(m)}`;
  return `${pad(h)}:${pad(m)}`;
}

function loadAvatar(evt, speaker){
  const file=evt.target.files?.[0]; if(!file) return;
  const reader=new FileReader(); reader.onload=()=>{
    state.avatars[speaker]=reader.result;
    const img=$(speaker==='A'?'avatarAImg':'avatarBImg'); const fallback=$(speaker==='A'?'avatarAFallback':'avatarBFallback');
    img.src=reader.result; img.style.display='block'; fallback.style.display='none'; renderPreview();
  }; reader.readAsDataURL(file);
}

async function handleLanguage(lang){
  if(lang==='ko'){
    state.messages = state.originals.map((m,i)=>({...m, time:state.messages[i]?.time || ''}));
    state.currentLang='ko'; regenerateTimes(); renderAll(); showToast('한국어 원문으로 복원했습니다.'); return;
  }
  await runAi('translate',lang);
}

async function runAi(mode,targetLang){
  const gas = localStorage.getItem('chatCaptureGasUrl');
  if(!gas){ els.apiDialog.showModal(); showToast('먼저 Apps Script URL을 설정해 주세요.'); return; }
  if(!state.messages.length) return;
  setAiBusy(true);
  try{
    const payload={
      action:'transform', mode, targetLang,
      platform:state.platform, tone:els.toneSelect.value,
      contextHint:els.contextHint.value.trim(),
      participants:{A:els.nameA.value,B:els.nameB.value},
      messages:state.messages.map((m,i)=>({id:i,speaker:m.speaker,text:mode==='translate'?(m.original||m.text):m.text}))
    };
    const res=await fetch(gas,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow'});
    const data=await res.json();
    if(!res.ok || data.ok===false) throw new Error(data.error || `HTTP ${res.status}`);
    if(!Array.isArray(data.messages) || data.messages.length!==state.messages.length) throw new Error('AI 응답 메시지 수가 원문과 다릅니다.');
    state.messages = state.messages.map((m,i)=>({...m,text:data.messages[i].text ?? m.text}));
    if(mode==='translate') state.currentLang=targetLang;
    regenerateTimes(); renderAll();
    els.apiStatus.textContent=`AI ${mode==='translate'?'번역':'자연화'} 완료 · ${data.model || 'OpenAI'}`; els.apiStatus.className='status-line ok';
    showToast(mode==='translate'?'번역을 적용했습니다.':'대화를 자연스럽게 다듬었습니다.');
  }catch(err){
    console.error(err); els.apiStatus.textContent=`API 오류: ${err.message}`; els.apiStatus.className='status-line error'; showToast('AI 처리에 실패했습니다.');
  }finally{ setAiBusy(false); }
}

function setAiBusy(on){ qsa('.btn.ai').forEach(b=>{b.disabled=on;b.style.opacity=on?'.55':'1'}); }
function saveApiUrl(){
  const url=els.gasUrl.value.trim();
  if(url && !/^https:\/\/script\.google\.com\//.test(url)){ showToast('Apps Script Web App URL을 확인해 주세요.'); return; }
  localStorage.setItem('chatCaptureGasUrl',url); els.apiDialog.close(); updateApiStatus(); showToast('API URL을 저장했습니다.');
}
function updateApiStatus(){
  const has=!!localStorage.getItem('chatCaptureGasUrl');
  els.apiStatus.textContent=has?'Google Apps Script 연결 URL이 설정되어 있습니다.':'OpenAI 번역을 사용하려면 Google Apps Script Web App URL을 설정하세요.';
  els.apiStatus.className=`status-line ${has?'ok':''}`;
}

function saveDraft(){
  const draft={platform:state.platform,messages:state.messages,originals:state.originals,avatars:state.avatars,currentLang:state.currentLang,
    fields:{chatTitle:els.chatTitle.value,chatDate:els.chatDate.value,startTime:els.startTime.value,toneSelect:els.toneSelect.value,nameA:els.nameA.value,nameB:els.nameB.value,contextHint:els.contextHint.value,rawConversation:els.rawConversation.value},mockup:els.mockupToggle.checked};
  localStorage.setItem('chatCaptureDraft',JSON.stringify(draft)); showToast('현재 작업을 브라우저에 저장했습니다.');
}
function loadDraft(){
  const raw=localStorage.getItem('chatCaptureDraft'); if(!raw){showToast('저장된 작업이 없습니다.');return;}
  try{
    const d=JSON.parse(raw); Object.assign(state,{platform:d.platform||'kakao',messages:d.messages||[],originals:d.originals||[],avatars:d.avatars||{A:'',B:''},currentLang:d.currentLang||'ko'});
    Object.entries(d.fields||{}).forEach(([k,v])=>{ if($(k)) $(k).value=v; }); els.mockupToggle.checked=d.mockup!==false;
    qsa('.platform-card').forEach(x=>x.classList.toggle('active',x.dataset.platform===state.platform)); restoreAvatarUi('A'); restoreAvatarUi('B'); regenerateTimes(); renderAll(); showToast('저장된 작업을 불러왔습니다.');
  }catch{showToast('저장 데이터를 불러오지 못했습니다.');}
}
function restoreAvatarUi(s){
  const img=$(s==='A'?'avatarAImg':'avatarBImg'), fallback=$(s==='A'?'avatarAFallback':'avatarBFallback');
  if(state.avatars[s]){img.src=state.avatars[s];img.style.display='block';fallback.style.display='none';}else{img.style.display='none';fallback.style.display='block';}
}
function resetApp(){
  if(!confirm('현재 편집 내용을 초기화할까요?')) return;
  state.platform='kakao'; state.avatars={A:'',B:''}; state.currentLang='ko';
  els.chatTitle.value='Tommy'; els.nameA.value='lamjskim'; els.nameB.value='Tommy'; els.chatDate.value=localDateValue(); els.startTime.value=localTimeValue(); els.contextHint.value=''; els.toneSelect.value='natural-business';
  els.rawConversation.value='A: 오늘 SM 시장 어때?\nB: 중국 내수에서 prompt short covering이 계속 나오고 있어.\nA: LG도 이제 들어오나 보네.\nB: 한국과 일본 쪽 물량이 거의 말라서 필요하면 중국밖에 없을 듯.';
  restoreAvatarUi('A');restoreAvatarUi('B');qsa('.platform-card').forEach(x=>x.classList.toggle('active',x.dataset.platform==='kakao')); parseConversation();
}

async function capturePng(full){
  if(typeof html2canvas==='undefined'){showToast('캡처 라이브러리를 불러오지 못했습니다.');return;}
  const phone=els.captureTarget, scroll=els.chatScroll;
  const original={phoneHeight:phone.style.height,scrollOverflow:scroll.style.overflow,scrollHeight:scroll.style.height,scrollFlex:scroll.style.flex};
  try{
    if(full){
      scroll.style.overflow='visible';scroll.style.height='auto';scroll.style.flex='none';
      const contentHeight=scroll.scrollHeight; scroll.style.height=`${contentHeight}px`; phone.style.height='auto';
    }
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const canvas=await html2canvas(phone,{scale:2,useCORS:true,backgroundColor:null,logging:false});
    const link=document.createElement('a');
    const stamp=`${els.chatDate.value}_${state.platform}_${(els.chatTitle.value||'chat').replace(/[^\w가-힣ぁ-んァ-ン一-龥-]+/g,'_')}`;
    link.download=`chat_${stamp}${full?'_full':''}.png`; link.href=canvas.toDataURL('image/png'); link.click(); showToast('PNG 이미지를 저장했습니다.');
  }catch(err){console.error(err);showToast('이미지 저장에 실패했습니다.');}
  finally{phone.style.height=original.phoneHeight;scroll.style.overflow=original.scrollOverflow;scroll.style.height=original.scrollHeight;scroll.style.flex=original.scrollFlex;}
}

function showToast(text){
  els.toast.textContent=text; els.toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>els.toast.classList.remove('show'),2200);
}

initDefaults();
