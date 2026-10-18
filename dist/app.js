'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const icons = {
  workspace:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 3v18M9 9h12"/>',
  practice:'<path d="M7 3h10l4 4v13H3V7zM8 12h8M8 16h5"/><path d="M7 3v5h10V3"/>',
  files:'<rect x="6" y="6" width="14" height="16" rx="2"/><path d="M15 2H4a2 2 0 0 0-2 2v13M10 11h6M10 15h6"/>',
  history:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
  shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16v.1"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  audio:'<path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/>',
  spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v12h5"/>',
  mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  send:'<path d="m3 11 18-8-8 18-2-8zM11 13 21 3"/>',
  edit:'<path d="m15 4 5 5M4 15 16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L9 20l-6 1z"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  play:'<path d="m8 4 12 8-12 8z"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.info}</svg>`;
function decorate(){ $$('[data-icon]').forEach(e => e.innerHTML = icon(e.dataset.icon)); }
function escapeHTML(value){ return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const esc = escapeHTML;
function readLocal(key, fallback){try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}}
function writeLocal(key, value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{toast('Your browser could not save this data. Export it instead.');return false;}}
const sampleQuestion = 'Tell me about a time you used data to solve a problem.';
const sampleCues = ['Set the scene: describe a real problem and why it mattered.', 'Explain your approach: how you checked the data, chose your analysis and tested the result.', 'Close with the impact: share an outcome you can support, then what you learned.'];
const questions = {
  Behavioural:['Tell me about a time you used data to solve a problem.','Describe a time you had to learn something quickly.','Tell me about a disagreement and how you handled it.','What would you do if you made a mistake at work?'],
  Technical:['How would you investigate a mismatch between two datasets?','How would you check a dashboard before sharing it with a stakeholder?','Explain the difference between a LEFT JOIN and an INNER JOIN.','How would you handle missing values in a dataset?'],
  'Trading & finance':['Walk me through the lifecycle of a trade.','How would you investigate an unexpected P&L movement?','What is the difference between market risk and liquidity risk?','How would you respond to a trading limit breach?'],
  'General interview':['Tell me about yourself.','Why are you interested in this role?','What is a skill you are currently developing?','What questions would you ask the interviewer?']
};
const initialContext = readLocal('cue-remember',false) ? readLocal('cue-context',{}) : {};
const state = {
  view:'workspace', backend:false, connected:false, health:null, mode:'demo', context:{resume:'',job:'',instructions:'',...initialContext},
  remember:readLocal('cue-remember',false), sessions:readLocal('cue-sessions',[]),
  title:'General interview', transcript:[], answer:'', answerQuestion:'', answerSample:true, tab:'cues', style:'concise', busy:false,
  seconds:0, started:false, recording:false, savedSessionId:null, notes:'', category:'Behavioural', practiceIndex:0,
  practiceQuestion:questions.Behavioural[0], practiceAnswer:'', feedback:'', practiceBusy:false,
};
let answerController, practiceController, mediaStream, recorder, recordTimer, pendingTranscriptions=0, answerEpoch=0;
let transcriptionQueue=Promise.resolve();
let demoTimer, recordingEpoch=0;
const notes = {};
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function setConnection(){
  const local = state.mode==='local' && state.connected;
  $('#connection').className='connection-pill'+(local?' connected':'');
  $('#connection').innerHTML=`<span class="status-dot"></span>${local?'Local AI connected':state.mode==='local'?'Local AI unavailable':'Demo mode'}`;
  $('#session-count').textContent=state.sessions.length;
}
const titles = {
  workspace:['A LITTLE CLARITY GOES A LONG WAY','Your interview, in focus.','Stay present. Find your words. Let the conversation flow.','Live session'],
  practice:['THE CONFIDENCE COMES WITH PRACTICE','A safe space to find your voice.','One question at a time. Practise out loud or write your answer.','Mock interview'],
  context:['MAKE YOUR NEXT ANSWER YOUR OWN','A little context. A better cue.','Bring your experience, the role and the way you want to sound.','Your context'],
  sessions:['YOUR CONVERSATIONS, KEPT CLOSE','Pick up where you left off.','Sessions stay in this browser only when you choose to save them.','Saved sessions'],
  settings:['OPEN SOURCE. ON YOUR TERMS.','Make yourself at home.','Connect local AI and choose what stays in your browser.','Settings & setup'],
};
function navigate(view){
  if(!titles[view])view='workspace';
  if(view!=='workspace'&&state.recording)stopRecording();
  state.view=view;location.hash=view;
  const t=titles[view];$('#eyebrow').textContent=t[0];$('#page-title').textContent=t[1];$('#page-description').textContent=t[2];$('#breadcrumb').textContent=t[3];
  $$('.nav-item[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  render();
}
function banner(){
  if(state.mode==='local' && state.connected)return `<div class="demo-banner">${icon('shield')}<span><strong>Local workspace.</strong> Questions and context go to your local backend. No paid API needed.</span><button class="text-link" data-view="settings">Connection details ↗</button></div>`;
  return `<div class="demo-banner">${icon('spark')}<span><strong>Make yourself comfortable.</strong> You’re exploring a demo with illustrative responses.</span><button class="text-link" data-action="setup">Connect local AI ↗</button></div>`;
}
function render(){
  setConnection();
  $('#view').innerHTML=({workspace:workspaceView,practice:practiceView,context:contextView,sessions:sessionsView,settings:settingsView}[state.view])();
  decorate();
  if(state.view==='workspace'){renderTranscript();renderAnswer();}
}
function workspaceView(){return `${banner()}
  <div class="session-bar"><div class="session-title"><h2>${esc(state.title)}</h2><span class="session-tag">${state.mode==='demo'?'DEMO':'LOCAL AI'}</span><button class="icon-button" data-action="rename" aria-label="Rename session">${icon('edit')}</button></div><div class="session-meta"><span class="time">${icon('clock')}<span id="timer">${formatTime(state.seconds)}</span></span><span class="sep"></span><span class="privacy-label">${icon('shield')} Local-first workspace</span></div></div>
  <div class="workspace-grid">
    <section class="panel transcript-panel"><div class="panel-header"><div class="panel-heading">${icon('audio')}Live conversation</div><span class="live-badge"><i></i>${state.recording?'RECORDING':state.backend?'READY':'SAMPLE'}</span></div>
      <div class="transcript-scroll" id="transcript" aria-live="polite"></div>
      <div class="transcript-foot"><span class="audio-label"><span class="audio-bars ${state.recording?'active':''}">${'<i></i>'.repeat(14)}</span><span id="audio-status">${state.recording?'Microphone on':state.backend?'Microphone off':'Sample transcript'}</span></span><button class="button listen-button ${state.recording?'':'soft'}" data-action="mic">${icon(state.recording?'stop':'mic')}${state.recording?'Stop listening':'Start listening'}</button></div>
    </section>
    <section class="panel answer-panel"><div class="panel-header"><div class="panel-heading"><span class="spark">${icon('spark')}</span>Your next words</div><div class="answer-controls"><button class="icon-button" data-action="regenerate" aria-label="Regenerate answer" ${state.busy?'disabled':''}>${icon('refresh')}</button><button class="icon-button" data-action="copy" aria-label="Copy answer">${icon('copy')}</button></div></div>
      <div class="answer-tabs" role="tablist" aria-label="Answer format"><button role="tab" aria-selected="${state.tab==='cues'}" class="answer-tab ${state.tab==='cues'?'active':''}" data-tab="cues">Talking points</button><button role="tab" aria-selected="${state.tab==='full'}" class="answer-tab ${state.tab==='full'?'active':''}" data-tab="full">Full answer</button><button role="tab" aria-selected="${state.tab==='notes'}" class="answer-tab ${state.tab==='notes'?'active':''}" data-tab="notes">My notes</button></div>
      <div class="answer-body" id="answer-body" aria-live="polite"></div>
      <div class="answer-footer"><span class="word-count" id="word-count">Your voice, with a little structure</span><button class="text-link" data-action="style">${icon('settings')}<span id="style-label">${{concise:'Keep it concise',star:'STAR structure',technical:'Technical depth'}[state.style]}</span></button></div>
    </section>
  </div>
  <form class="composer" id="question-form"><span class="composer-icon">${icon('edit')}</span><textarea id="question" rows="1" maxlength="6000" aria-label="Interview question" placeholder="Type a question, or paste something you’d like a hand with…"></textarea><span class="keyboard">⌘ ↵</span><button class="button primary" id="ask-button" type="submit" ${state.busy?'disabled':''}>${icon('spark')}${state.busy?'Thinking…':'Get a cue'}</button></form>
  <div class="workspace-bottom"><span>${state.mode==='demo'?'Illustrative examples · No AI model connected':'Mic transcription arrives in ~3-second chunks · Latency depends on your hardware'}</span><div><button class="text-link" data-action="demo">Try a demo</button><span style="margin:0 8px;color:#d0d6c7">·</span><button class="text-link" data-action="save">Save session</button><span style="margin:0 8px;color:#d0d6c7">·</span><button class="text-link" data-action="export">Export ${icon('download')}</button></div></div>
  <div class="context-strip"><span class="context-icon">${icon('files')}</span><div><strong>${state.context.resume||state.context.job?'Your context is ready.':'Good answers start with your story.'}</strong><p>${state.context.resume||state.context.job?'Your saved context will guide local AI suggestions.':'Add your CV and the role to make local AI suggestions more relevant.'}</p></div><button class="button" data-view="context">${state.context.resume||state.context.job?'Edit context':'Add your context'} ${icon('plus')}</button></div>`;}
function renderTranscript(){
  const el=$('#transcript');if(!el)return;
  const list=state.transcript.length?state.transcript:[{speaker:'Sample interviewer',text:sampleQuestion,time:'00:00'}];
  el.innerHTML=list.map((t,i)=>`<div class="transcript-item"><div class="speaker-row"><span class="speaker-avatar">${t.speaker==='Microphone'?'M':t.speaker==='You'?'Y':'I'}</span><strong>${esc(t.speaker)}</strong><span class="speaker-time">${esc(t.time)}</span></div><p class="transcript-text ${i===list.length-1?'question':''}">${esc(t.text)}</p></div>`).join('');
  el.scrollTop=el.scrollHeight;
}
function renderAnswer(){
  const el=$('#answer-body');if(!el)return;
  if(state.tab==='notes'){el.innerHTML=`<label class="field"><span>Your private notes</span><textarea id="session-notes" maxlength="10000" placeholder="A useful detail, a question to ask, a reminder to breathe…">${esc(state.notes)}</textarea><small>Included when you save or export this session.</small></label>`;return;}
  let body='';
  if(!state.answer){body=`<h3>A good answer tells a small, clear story.</h3><ul class="cue-list">${sampleCues.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`;}
  else if(state.tab==='cues'){
    const chunks=state.answer.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    body=`<ul class="cue-list">${chunks.map(c=>`<li>${esc(c.replace(/^[-*•]\s*/,''))}</li>`).join('')}</ul>`;
  }else body=esc(state.answer);
  el.innerHTML=`<div class="response-meta">${state.answerSample?'ILLUSTRATIVE EXAMPLE · NOT AI GENERATED':'LOCAL AI SUGGESTION · REVIEW BEFORE USING'}</div><div class="answer-content ${state.busy?'loading':''}">${body}</div>`;
  const count=$('#word-count');if(count)count.textContent=state.answer?`${state.answer.trim().split(/\s+/).length} words · ${state.answerSample?'Illustrative guidance':'Ground it in your real experience'}`:'Your voice, with a little structure';
}
function contextView(){return `<div class="form-grid"><section class="panel form-panel"><h2>Your experience</h2><p>Paste your CV or a short summary. Include examples you’re comfortable discussing.</p><label class="field"><span>CV / career notes</span><textarea id="resume" maxlength="20000" rows="12" placeholder="Your roles, projects, skills and real achievements…">${esc(state.context.resume)}</textarea><small>Up to 20,000 characters. Text and Markdown imports are supported.</small></label><label class="button small">${icon('files')}Import .txt or .md<input id="context-file" type="file" accept=".txt,.md,text/plain,text/markdown" hidden></label></section>
  <section class="panel form-panel"><h2>The opportunity</h2><p>Give Cue the role and company context. Focus on the responsibilities that matter.</p><label class="field"><span>Job description</span><textarea id="job" maxlength="15000" rows="9" placeholder="Role, company, responsibilities, required skills…">${esc(state.context.job)}</textarea></label><label class="field"><span>Your preferences</span><textarea id="instructions" maxlength="5000" rows="3" style="min-height:90px" placeholder="For example: use simple British English, focus on my SQL and finance experience…">${esc(state.context.instructions)}</textarea></label></section></div>
  <label class="toggle-row"><input id="remember-context" type="checkbox" ${state.remember?'checked':''}>Remember this context in this browser. Leave off to keep it only for this visit.</label><div class="form-actions"><span class="muted">Context is only sent to the AI when you request a response.</span><button class="button" data-action="clear-context">Clear context</button><button class="button primary" data-action="save-context">${icon('check')}Apply context</button></div>`;}
function practiceView(){return `${banner()}<div class="practice-layout"><section class="panel form-panel"><div style="display:flex;align-items:center;justify-content:space-between;gap:14px"><h2>Let’s talk it through.</h2><select class="select" id="practice-category" aria-label="Question category" style="width:auto;font-size:10px;padding:8px">${Object.keys(questions).map(c=>`<option ${c===state.category?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="practice-label">YOUR NEXT QUESTION</div><div class="practice-question" id="practice-question">${esc(state.practiceQuestion)}</div><label class="field"><span>Your answer</span><textarea class="practice-area" id="practice-answer" maxlength="10000" placeholder="Give it a go. Use one specific example and explain what you did…">${esc(state.practiceAnswer)}</textarea></label><div class="form-actions"><button class="button" data-action="next-question" ${state.practiceBusy?'disabled':''}>${icon('refresh')}Next question</button><button class="button primary" data-action="feedback" ${state.practiceBusy?'disabled':''}>${icon('spark')}${state.practiceBusy?'Working…':'Get feedback'}</button></div></section>
  <section class="panel form-panel"><div class="panel-heading" style="margin-bottom:23px">${icon('spark')}A little perspective</div><div class="feedback-content" id="feedback" aria-live="polite">${esc(state.feedback || 'Your feedback will appear here. Write your answer, then ask for a second pair of eyes.')}</div><div class="practice-hint"><strong>A useful rhythm</strong><br>What happened → What you did → What changed.<br><br>Take a breath. Clear and honest beats perfectly memorised.</div></section></div>`;}
function sessionsView(){return state.sessions.length?`<div style="display:flex;justify-content:space-between;margin-bottom:20px"><p class="description">${state.sessions.length} saved ${state.sessions.length===1?'session':'sessions'} · Stored in this browser</p><button class="text-link" data-action="clear-sessions">Delete all sessions</button></div>${state.sessions.map(s=>`<div class="panel session-card"><span class="context-icon">${icon('history')}</span><div><h3>${esc(s.title)}</h3><p>${esc(new Date(s.date).toLocaleString('en-GB'))} · ${s.transcript.length} transcript entries · ${esc(s.mode==='demo'?'Demo':'Local AI')}</p></div><div class="session-buttons"><button class="button small" data-open-session="${esc(s.id)}">Open session</button><button class="icon-button" data-export-session="${esc(s.id)}" aria-label="Export ${esc(s.title)}">${icon('download')}</button><button class="icon-button" data-delete-session="${esc(s.id)}" aria-label="Delete ${esc(s.title)}">${icon('close')}</button></div></div>`).join('')}`:`<section class="panel empty-state">${icon('history')}<h2>A fresh page.</h2><p>Your sessions will appear here when you choose to save them.<br>Nothing is saved automatically.</p><button class="button primary" data-view="workspace">Go to your workspace</button></section>`;}
function settingsView(){return `<div class="form-grid"><section class="panel form-panel"><h2>Your local AI, connected.</h2><p>The browser demo works immediately. For real AI and microphone transcription, run the included server on your computer and open its local address.</p><ol class="steps"><li>Install <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">Ollama</a> and start it.</li><li>Download the source and extract it.</li><li>Open Terminal in that folder, then run:</li></ol><div class="code-block">ollama pull qwen2.5:7b\nbash start.sh</div><p style="margin-top:16px">Open <strong>http://127.0.0.1:8000</strong>. AI connects automatically when the model is ready. First microphone use downloads Whisper’s speech model.</p><div class="form-actions"><button class="button" data-action="source">${icon('download')}Download source</button><button class="button primary" data-action="check">${icon('refresh')}Check connection</button></div><p class="danger-note" id="connection-details" style="margin-top:14px">${connectionDetails()}</p></section>
  <section class="panel form-panel"><h2>Simple by design.</h2><div class="info-row"><span>Answer engine</span><strong>Ollama · ${esc(state.health?.model||'qwen2.5:7b')}</strong></div><div class="info-row"><span>Speech recognition</span><strong>faster-whisper · ${esc(state.health?.whisper||'base.en')}</strong></div><div class="info-row"><span>Licence</span><strong>MIT · v0.1.0</strong></div><div class="info-row"><span>Audio storage</span><strong>No recordings saved by Cue</strong></div><div class="info-row"><span>Session storage</span><strong>Browser · explicit save only</strong></div><p style="margin-top:20px">Local model downloads need internet the first time. Inference runs on your computer with the default configuration. Model caches stay on disk.</p><p>Microphone input captures your selected microphone, without speaker labels. Use it for practice or conversations where AI assistance and transcription are agreed.</p><button class="button small" data-action="demo-mode">Use demo mode</button></section></div>`;}
function connectionDetails(){
  if(!isLocal())return 'This hosted page is a demo. Run the downloaded app at 127.0.0.1:8000 to use local AI.';
  if(state.connected)return `Connected to Ollama · ${state.health?.model||'qwen2.5:7b'}.`;
  if(state.health?.ollama)return `Ollama is running. Pull the model: ${state.health.model}`;
  return 'Local model unavailable. Start Ollama and run ollama pull qwen2.5:7b, then check again.';
}
function isLocal(){return ['localhost','127.0.0.1'].includes(location.hostname);}
async function checkConnection(notify=false){
  if(!isLocal()){if(notify)toast(connectionDetails());return;}
  try{
    const r=await fetch('/api/health',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Unavailable');
    state.health=await r.json();state.backend=true;state.connected=!!state.health.model_ready;if(state.connected)state.mode='local';
  }catch{state.backend=false;state.connected=false;}
  setConnection();if(state.view==='settings')render();else if(state.view==='workspace'&&!state.busy)render();
  if(notify)toast(connectionDetails());
}
async function streamRequest(path,payload,onToken,signal){
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
  if(!response.ok)throw Error(`Local server returned ${response.status}. Check the server log.`);
  if(!response.body)throw Error('Your browser cannot stream this response.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';let received=false;
  function consume(line){if(!line.trim())return;const item=JSON.parse(line);if(item.error)throw Error(item.error);if(item.token){received=true;onToken(item.token);}}
  try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();lines.forEach(consume);}buffer+=decoder.decode();if(buffer.trim())consume(buffer);if(!received)throw Error('The model returned an empty response. Try again.');}
  finally{reader.releaseLock();}
}
function illustrativeAnswer(question){
  const q=question.toLowerCase();
  if(/join|sql|dataset|reconcil|mismatch/.test(q))return 'Clarify the grain and the expected result before writing a query. Identify the business key and check whether it is unique.\nCompare row counts, nulls, duplicates, types and date ranges. For reconciliation, join on validated keys and separate missing records from value mismatches.\nValidate a few examples manually, explain the cause and add a repeatable check. Replace this outline with a real example from your experience.';
  if(/p&l|trade|trading|risk|liquidity/.test(q))return 'Start by defining the instrument, account, time window and the issue you are investigating.\nCheck source data, positions, prices, trade status and relevant limits. Explain which checks you would perform and who you would involve.\nDescribe a real outcome only if you have evidence. For a hypothetical scenario, clearly say what you would do and when you would escalate.';
  if(/yourself|introduce/.test(q))return 'Present: briefly explain the type of work you do and the skills most relevant to this role.\nPast: pick one real project or role and explain your contribution, without adding unsupported metrics.\nFuture: connect what you have learned to the responsibilities in this job. Aim for a clear 60–90 second introduction.';
  if(/why|company|role/.test(q))return 'Name a specific responsibility in the role that interests you.\nConnect it to a real skill or example from your experience. Research the company so you can explain your interest with a concrete fact.\nFinish with what you hope to contribute and learn. This is an outline to personalise, rather than a completed personal answer.';
  if(state.style==='star')return 'Situation: describe the real setting and the problem. Keep it to one or two sentences.\nTask: explain what you personally needed to achieve.\nAction: give two or three specific steps you took and why you chose them.\nResult: explain what changed, with evidence you can support. Add one lesson you would carry into this role.';
  return sampleCues.join('\n');
}
function setBusy(busy){
  state.busy=busy;const button=$('#ask-button');if(button){button.disabled=busy;button.innerHTML=icon('spark')+(busy?'Thinking…':'Get a cue');}
  const regen=$('[data-action="regenerate"]');if(regen)regen.disabled=busy;renderAnswer();
}
async function ask(question,addTranscript=true){
  if(state.busy)return;question=question.trim();if(!question){toast('Type a question first.');return;}
  state.started=true;const epoch=++answerEpoch;
  if(addTranscript){state.transcript.push({speaker:'You',text:question,time:formatTime(state.seconds)});state.transcript=state.transcript.slice(-150);}
  const history=[];if(state.answer && !state.answerSample){history.push({role:'user',content:state.answerQuestion},{role:'assistant',content:state.answer.slice(0,6000)});}
  state.answer='';state.answerQuestion=question;state.answerSample=state.mode==='demo';if(state.tab==='notes')state.tab='cues';
  renderTranscript();setBusy(true);
  try{
    if(state.mode==='demo'){
      state.answer=illustrativeAnswer(question);renderAnswer();
    }else{
      answerController=new AbortController();
      await streamRequest('/api/answer',{question,context:state.context,history,style:state.style},token=>{if(epoch===answerEpoch){state.answer+=token;renderAnswer();}},answerController.signal);
    }
  }catch(e){if(e.name!=='AbortError'&&epoch===answerEpoch){state.answer='';toast(e.message);}}
  finally{if(epoch===answerEpoch)setBusy(false);}
}
function newSession(title){
  stopRecording();answerEpoch++;answerController?.abort();clearTimeout(demoTimer);
  Object.assign(state,{title:title||'General interview',transcript:[],answer:'',answerQuestion:'',answerSample:true,seconds:0,started:false,notes:'',savedSessionId:null,busy:false,tab:'cues'});
  navigate('workspace');
}
function sessionSnapshot(){return {id:state.savedSessionId||crypto.randomUUID(),title:state.title,date:new Date().toISOString(),mode:state.mode,transcript:state.transcript,answer:state.answer,answerQuestion:state.answerQuestion,answerSample:state.answerSample,seconds:state.seconds,notes:state.notes};}
function saveSession(){
  if(!state.transcript.length&&!state.notes){toast('Add a question or note before saving.');return;}
  const s=sessionSnapshot(),sessions=[s,...state.sessions.filter(x=>x.id!==s.id)].slice(0,50);
  if(writeLocal('cue-sessions',sessions)){state.sessions=sessions;state.savedSessionId=s.id;setConnection();toast('Session saved in this browser.');}
}
function exportSession(s=sessionSnapshot()){
  const text=`# ${s.title}\n\nSaved: ${s.date}\nMode: ${s.mode}\n\n## Transcript\n\n${s.transcript.map(t=>`**${t.speaker} · ${t.time}**\n${t.text}`).join('\n\n')}\n\n## ${s.answerSample?'Illustrative guidance':'AI suggestion (review for accuracy)'}\n\nQuestion: ${s.answerQuestion||'—'}\n\n${s.answer||'No answer generated.'}\n\n## Your notes\n\n${s.notes||'—'}\n`;
  const url=URL.createObjectURL(new Blob([text],{type:'text/markdown'}));const a=document.createElement('a');a.href=url;a.download='cue-session-'+new Date().toISOString().slice(0,10)+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Session exported as Markdown.');
}
function modal(title,body){$('#modal-content').innerHTML=`<div class="modal-header"><h2>${esc(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body">${body}</div>`;if(!$('#modal').open)$('#modal').showModal();}
function setupModal(){modal('Bring your own AI.',`<p>Use the downloadable app on your computer for real answer generation and microphone transcription. The hosted workspace uses illustrative demo responses.</p><ol class="steps"><li>Install and start <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">Ollama</a>.</li><li>Download and extract Cue’s source, then open Terminal inside the folder.</li><li>Run these commands:</li></ol><div class="code-block">ollama pull qwen2.5:7b\nbash start.sh</div><p>Then open <strong>http://127.0.0.1:8000</strong>. No API key or subscription required. Python 3.10+ is needed.</p><div class="form-actions"><button class="button" data-action="full-settings">Setup details</button><button class="button primary" data-action="source">${icon('download')}Download source</button></div>`);}
async function toggleMic(){
  if(state.recording){stopRecording();render();return;}
  // Speech recognition is served by Whisper and does not depend on Ollama.
  if(!isLocal()||!state.backend){setupModal();return;}
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){toast('Microphone recording is unavailable. Use a recent Chrome, Edge or Safari on localhost.');return;}
  try{
    mediaStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    state.recording=true;state.started=true;const epoch=++recordingEpoch;render();
    toast('Microphone on. First transcription may download the speech model.');
    recordChunk(epoch);
  }catch(e){toast('Microphone could not start. Check browser permissions and try again.');stopRecording();}
}
function recordChunk(epoch){
  if(!state.recording||epoch!==recordingEpoch)return;
  const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  let chunkRecorder;
  try{chunkRecorder=new MediaRecorder(mediaStream,mime?{mimeType:mime}:undefined);recorder=chunkRecorder;}catch{stopRecording();toast('Recording format is not supported by this browser.');render();return;}
  let chunks=[];const sessionEpoch=epoch;
  chunkRecorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  chunkRecorder.onerror=()=>{stopRecording();toast('Microphone recording failed.');if(state.view==='workspace')render();};
  chunkRecorder.onstop=()=>{
    if(sessionEpoch!==recordingEpoch)return;
    // Begin capturing the next chunk before transcription, so speech is not
    // lost while the previous chunk is processed.
    if(state.recording)recordChunk(epoch);
    if(chunks.length)queueTranscription(new Blob(chunks,{type:chunkRecorder.mimeType||'audio/webm'}),sessionEpoch);
  };
  chunkRecorder.start();recordTimer=setTimeout(()=>{if(chunkRecorder.state==='recording')chunkRecorder.stop();},3000);
}
function queueTranscription(audio,sessionEpoch){
  pendingTranscriptions++;const status=$('#audio-status');if(status)status.textContent='Transcribing…';
  transcriptionQueue=transcriptionQueue.then(async()=>{
    const form=new FormData();form.append('audio',audio,audio.type.includes('mp4')?'microphone.mp4':'microphone.webm');
    const response=await fetch('/api/transcribe',{method:'POST',body:form,signal:AbortSignal.timeout(180000)});
    if(!response.ok){const err=await response.json();throw Error(err.detail||'Transcription failed.');}
    const result=await response.json();
    if(sessionEpoch===recordingEpoch&&result.text){state.transcript.push({speaker:'Microphone',text:result.text,time:formatTime(state.seconds)});state.transcript=state.transcript.slice(-150);renderTranscript();const input=$('#question');if(input)input.value=(input.value+' '+result.text).trim().slice(-6000);}
  }).catch(e=>{if(sessionEpoch===recordingEpoch)toast(e.message);}).finally(()=>{
    pendingTranscriptions--;if(!pendingTranscriptions&&state.recording&&sessionEpoch===recordingEpoch){const current=$('#audio-status');if(current)current.textContent='Microphone on';}
  });
}
function stopRecording(){
  state.recording=false;recordingEpoch++;clearTimeout(recordTimer);
  if(recorder?.state==='recording')recorder.stop();mediaStream?.getTracks().forEach(t=>t.stop());mediaStream=null;
}
async function practiceFeedback(){
  if(state.practiceBusy)return;state.practiceAnswer=$('#practice-answer')?.value.trim()||state.practiceAnswer;
  if(!state.practiceAnswer){toast('Write your answer first.');return;}
  state.practiceBusy=true;state.feedback='';render();
  try{
    if(state.mode==='demo'){
      const count=state.practiceAnswer.split(/\s+/).length;
      state.feedback=`DEMO CHECKLIST · NOT AN AI ASSESSMENT\n\nYour answer has ${count} words.\n\nReview it for these four things:\n• Did you answer the question directly?\n• Did you use one specific, real example?\n• Is it clear what you personally did?\n• Did you explain the outcome and what you learned?\n\nConnect local AI for feedback on the content of your answer.`;
    }else{
      practiceController=new AbortController();
      await streamRequest('/api/feedback',{question:state.practiceQuestion,answer:state.practiceAnswer,context:state.context},token=>{state.feedback+=token;const e=$('#feedback');if(e)e.textContent=state.feedback;},practiceController.signal);
    }
  }catch(e){if(e.name!=='AbortError')state.feedback=e.message;}
  finally{state.practiceBusy=false;if(state.view==='practice')render();}
}
async function nextPractice(){
  if(state.practiceBusy)return;state.practiceAnswer='';state.feedback='';
  if(state.mode==='demo'){state.practiceIndex++;const bank=questions[state.category];state.practiceQuestion=bank[state.practiceIndex%bank.length];render();return;}
  state.practiceBusy=true;state.practiceQuestion='';render();practiceController=new AbortController();
  try{await streamRequest('/api/question',{category:state.category,context:state.context},token=>{state.practiceQuestion+=token;const e=$('#practice-question');if(e)e.textContent=state.practiceQuestion;},practiceController.signal);}
  catch(e){if(e.name!=='AbortError'){toast(e.message);state.practiceQuestion=questions[state.category][0];}}
  finally{state.practiceBusy=false;if(state.view==='practice')render();}
}
const actions = {
  setup:setupModal,
  'close-modal':()=>$('#modal').close(),
  'full-settings':()=>{$('#modal').close();navigate('settings');},
  source:()=>{const a=document.createElement('a');a.href='cue-source.zip';a.download='cue-source.zip';a.click();},
  new:()=>modal('A fresh conversation.',`<p>Give your session a name. Export or save the current session first if you want to keep it.</p><label class="field"><span>Session name</span><input id="new-title" maxlength="100" value="General interview"></label><div class="form-actions"><button class="button" data-action="close-modal">Cancel</button><button class="button primary" data-action="confirm-new">Start session</button></div>`),
  'confirm-new':()=>{const title=$('#new-title').value.trim();$('#modal').close();newSession(title);},
  rename:()=>modal('Name this conversation.',`<label class="field"><span>Session name</span><input id="rename-title" maxlength="100" value="${esc(state.title)}"></label><div class="form-actions"><button class="button primary" data-action="confirm-rename">Save name</button></div>`),
  'confirm-rename':()=>{state.title=$('#rename-title').value.trim()||'General interview';$('#modal').close();render();},
  help:()=>modal('A little help.',`<p>Ask a question to get talking points. Add your context for grounded local AI suggestions. For microphone input, start listening, let the text appear, then press <strong>Get a cue</strong> when the full question is ready.</p><div class="key-row"><span>Submit question</span><kbd>⌘ / Ctrl + Enter</kbd></div><div class="key-row"><span>Close dialog</span><kbd>Esc</kbd></div><p>Microphone transcription uses consecutive ~3-second recordings and processes each while the next records. It has no speaker labels or system-audio capture in v0.1.</p><button class="text-link" data-action="full-settings">Open setup & settings ↗</button>`),
  mic:toggleMic,
  demo:()=>{if(state.busy)return;stopRecording();state.mode='demo';state.started=true;state.transcript=[{speaker:'Sample interviewer',text:sampleQuestion,time:formatTime(state.seconds)}];state.answer=sampleCues.join('\n');state.answerQuestion=sampleQuestion;state.answerSample=true;render();toast('Demo loaded. Try typing your own question below.');},
  'demo-mode':()=>{stopRecording();state.mode='demo';render();toast('Demo mode selected.');},
  regenerate:()=>ask(state.answerQuestion||sampleQuestion,false),
  copy:async()=>{try{await navigator.clipboard.writeText(state.answer||sampleCues.join('\n'));toast('Answer copied.');}catch{toast('Clipboard unavailable. Select the answer text and copy it.');}},
  style:()=>{state.style=({concise:'star',star:'technical',technical:'concise'})[state.style];const e=$('#style-label');if(e)e.textContent=({concise:'Keep it concise',star:'STAR structure',technical:'Technical depth'})[state.style];toast('Answer style updated. Ask a question to use it.');},
  save:saveSession,export:()=>exportSession(),check:()=>checkConnection(true),
  'save-context':()=>{state.context={resume:$('#resume').value,job:$('#job').value,instructions:$('#instructions').value};state.remember=$('#remember-context').checked;writeLocal('cue-remember',state.remember);if(state.remember)writeLocal('cue-context',state.context);else localStorage.removeItem('cue-context');toast('Context applied.');navigate('workspace');},
  'clear-context':()=>{state.context={resume:'',job:'',instructions:''};localStorage.removeItem('cue-context');render();toast('Context cleared.');},
  'clear-sessions':()=>modal('Delete saved sessions?',`<p>This removes all saved sessions from this browser. Export any you want to keep first.</p><div class="form-actions"><button class="button" data-action="close-modal">Cancel</button><button class="button danger" data-action="confirm-clear">Delete all sessions</button></div>`),
  'confirm-clear':()=>{if(writeLocal('cue-sessions',[])){state.sessions=[];state.savedSessionId=null;$('#modal').close();render();toast('Saved sessions deleted.');}},
  'next-question':nextPractice,feedback:practiceFeedback,
};
document.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.view){if($('#modal').open)$('#modal').close();navigate(button.dataset.view);return;}
  if(button.dataset.tab){state.tab=button.dataset.tab;$$('[data-tab]').forEach(b=>{const active=b.dataset.tab===state.tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});renderAnswer();return;}
  if(button.dataset.openSession){const s=state.sessions.find(x=>x.id===button.dataset.openSession);if(s){stopRecording();answerEpoch++;answerController?.abort();Object.assign(state,{...s,savedSessionId:s.id,busy:false,started:false});navigate('workspace');}return;}
  if(button.dataset.deleteSession){const sessions=state.sessions.filter(x=>x.id!==button.dataset.deleteSession);if(writeLocal('cue-sessions',sessions)){state.sessions=sessions;render();toast('Session deleted.');}return;}
  if(button.dataset.exportSession){const s=state.sessions.find(x=>x.id===button.dataset.exportSession);if(s)exportSession(s);return;}
  const action=actions[button.dataset.action];if(action){try{await action();}catch(err){toast(err.message||'Something went wrong. Try again.');}}
});
document.addEventListener('submit',e=>{if(e.target.id==='question-form'){e.preventDefault();const field=$('#question');const text=field.value.trim();if(!state.busy&&text){field.value='';ask(text);}}});
document.addEventListener('keydown',e=>{if(e.target.id==='question'&&e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();$('#question-form').requestSubmit();}});
document.addEventListener('input',e=>{if(e.target.id==='session-notes')state.notes=e.target.value;if(e.target.id==='practice-answer')state.practiceAnswer=e.target.value;});
document.addEventListener('change',async e=>{
  if(e.target.id==='practice-category'){state.category=e.target.value;state.practiceIndex=-1;await nextPractice();}
  if(e.target.id==='context-file'){
    const file=e.target.files[0];if(!file)return;
    if(!/\.(txt|md)$/i.test(file.name)||file.size>100000){toast('Choose a .txt or .md file below 100 KB.');return;}
    const text=await file.text();$('#resume').value=text.slice(0,20000);toast('Text imported. Apply context to use it.');
  }
  if(e.target.id==='remember-context'&&!e.target.checked){state.remember=false;writeLocal('cue-remember',false);localStorage.removeItem('cue-context');}
});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#modal').close();}});
window.addEventListener('beforeunload',()=>{stopRecording();answerController?.abort();practiceController?.abort();});
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(v!==state.view)navigate(v);});
setInterval(()=>{if(state.started){state.seconds++;const e=$('#timer');if(e)e.textContent=formatTime(state.seconds);}},1000);
decorate();navigate(location.hash.slice(1)||'workspace');checkConnection();
