// Unit tests, using a minimal DOM double. This is not a browser layout test.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {webcrypto} = require('node:crypto');
class Element {
  constructor(){this.innerHTML='';this.textContent='';this.value='';this.checked=false;this.dataset={};this.className='';this.open=false;this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(){} setAttribute(){} showModal(){this.open=true;} close(){this.open=false;} click(){}
}
const nodes = new Map();
const storage = new Map();
const context = vm.createContext({
  console, Blob, URL, TextDecoder, AbortController, AbortSignal, Response, ReadableStream,
  crypto:webcrypto, setTimeout:()=>1, clearTimeout(){}, setInterval(){},
  location:{hostname:'demo.example',hash:''},window:{addEventListener(){}},navigator:{},
  document:{querySelector:s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);},querySelectorAll:()=>[],addEventListener(){},createElement:()=>new Element()},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8'),context);
const run = code => vm.runInContext(code,context);
(async()=>{
  assert.equal(run('state.mode'),'demo');
  assert.match(nodes.get('#view').innerHTML,/Live conversation/);
  assert.equal(storage.size,0,'No automatic session or context persistence');
  assert.equal(run('escapeHTML("<img onerror=alert(1)>")'),'&lt;img onerror=alert(1)&gt;');
  await run('ask("Explain SQL joins")');
  assert.equal(run('state.transcript.length'),1);
  assert.equal(run('state.answerSample'),true);
  assert.match(run('state.answer'),/grain/);
  assert.equal(run('state.busy'),false);
  assert.equal(storage.size,0);
  run('saveSession()');
  assert.equal(JSON.parse(storage.get('cue-sessions')).length,1);
  run('saveSession()');
  assert.equal(JSON.parse(storage.get('cue-sessions')).length,1,'Saving updates the existing session');
  run('state.context.resume="<script>alert(1)</script>"');
  assert(!run('contextView()').includes('<script>'),'Context text must not become markup');
  run('state.practiceAnswer="I checked the input data before joining it."');
  context.document.querySelector('#practice-answer').value='I checked the input data before joining it.';
  await run('practiceFeedback()');
  assert.match(run('state.feedback'),/NOT AN AI ASSESSMENT/);
  run('newSession("Fresh")');
  assert.equal(run('state.answer'),'');
  assert.equal(run('state.transcript.length'),0);
  assert.equal(run('state.sessions.length'),1);
  context.fetch=async()=>new Response(new ReadableStream({start(controller){
    for(const part of ['{"tok','en":"one "}\n{"token":"two"}\n','{"done":true}\n'])controller.enqueue(new TextEncoder().encode(part));
    controller.close();
  }}));
  run('globalThis.collected=""');
  await run('streamRequest("/api/answer",{},t=>{collected+=t})');
  assert.equal(run('collected'),'one two','NDJSON parser handles arbitrary transport chunk boundaries');
  context.fetch=async()=>new Response('{"error":"Model unavailable"}\n');
  await assert.rejects(run('streamRequest("/api/answer",{},()=>{})'),/Model unavailable/);
  context.fetch=async()=>new Response('{"done":true}\n');
  await assert.rejects(run('streamRequest("/api/answer",{},()=>{})'),/empty response/);
  assert.equal(run('formatTime(125)'),'02:05');
  context.MediaRecorder=class {
    static isTypeSupported(){return true;}
    constructor(stream,options){this.stream=stream;this.mimeType=options?.mimeType||'audio/webm';this.state='inactive';}
    start(){this.state='recording';}
    stop(){this.state='inactive';}
  };
  context.navigator.mediaDevices={getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})};
  run("location.hostname='127.0.0.1';state.backend=true;state.connected=false;state.mode='demo'");
  await run('toggleMic()');
  assert.equal(run('state.recording'),true,'Whisper microphone works without an Ollama model');
  run('stopRecording()');
  console.log('Frontend unit checks passed: demo flow, escaping, persistence, practice and streaming.');
})().catch(error=>{console.error(error);process.exitCode=1;});
