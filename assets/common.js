/* Песни в картинках — общие функции: загрузка, картинки, голос. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

async function getJSON(url){
  const r = await fetch(url, {cache:'no-cache'});
  if(!r.ok) throw new Error(`Не удалось открыть ${url} (код ${r.status})`);
  return r.json();
}

/* ---------- картинки ---------- */
let PICS = {};
async function loadPictures(){ PICS = await getJSON('images/pictures.json'); return PICS; }
// Картинка задаётся либо коротким именем из images/pictures.json ("mom"),
// либо путём к своему файлу ("images/moi/kot.png").
const isFile = p => /[\/.]/.test(p);
const picSrc = p => isFile(p) ? p : (PICS[p] ? PICS[p].file : 'images/star.svg');
const picLabel = p => PICS[p] ? PICS[p].label : String(p).replace(/^.*\//,'').replace(/\.[a-z0-9]+$/i,'').replace(/[-_]/g,' ');
const captionOf = line => line.caption || (line.pictures||[]).map(picLabel).join(' и ');
const picsHTML = (line, withCap=true) =>
  `<span class="pics${line.pictures.length>1?' two':''}">${line.pictures.map(p=>`<img src="${esc(picSrc(p))}" alt="">`).join('')}</span>` +
  (withCap ? `<span class="cap">${esc(captionOf(line))}</span>` : '');

const norm = s => s.toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function guessPictures(text){
  const words = norm(text).split(' '); const out = [];
  for(const [name, p] of Object.entries(PICS)){
    if(out.length >= 2) break;
    const hit = (p.exact||[]).some(x => words.includes(x)) || (p.keywords||[]).some(k => words.some(w => w.startsWith(k)));
    if(hit && !out.includes(name)) out.push(name);
  }
  return out.length ? out : ['star'];
}

/* ---------- голос ---------- */
const VOICE_KEY = 'pesni-v-kartinkah-voice';
let voiceSet = {}; try{ voiceSet = JSON.parse(localStorage.getItem(VOICE_KEY)||'{}')||{} }catch(e){}
const saveVoice = () => { try{ localStorage.setItem(VOICE_KEY, JSON.stringify(voiceSet)) }catch(e){} };
const canSpeak = 'speechSynthesis' in window;
let voices = [];
function rankVoice(v){
  const n = (v.name+' '+v.voiceURI).toLowerCase(); let s = 0;
  if(/(milena|милена|katya|катя|svetlana|светлана|dariya|дария|alena|алена|алёна|irina|ирина|ekaterina|екатерина|polina|полина|anna|анна|female|женск)/.test(n)) s += 50;
  if(/(natural|neural|online|enhanced|premium|улучш)/.test(n)) s += 30;
  if(/google/.test(n)) s += 15;
  if(/(yuri|юрий|maxim|максим|pavel|павел|dmitry|дмитрий|male|мужск)/.test(n) && !/female/.test(n)) s -= 60;
  return s;
}
function loadVoices(){
  if(!canSpeak) return;
  try{ voices = speechSynthesis.getVoices().filter(v=>/^ru/i.test(v.lang)).sort((a,b)=>rankVoice(b)-rankVoice(a)) }catch(e){ voices = [] }
  document.dispatchEvent(new Event('voiceschanged'));
}
if(canSpeak){ loadVoices(); try{ speechSynthesis.onvoiceschanged = loadVoices }catch(e){} }
const currentVoice = () => voices.find(v=>v.name===voiceSet.voice) || voices[0] || null;
/* Словарь произношения: pronounce.json в корне сайта (слово → как читать, с ударением) */
let PRON = {};
fetch('pronounce.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : {}).then(d => { PRON = d || {}; }).catch(() => {});
function pronounce(t){
  return String(t).replace(/[А-Яа-яЁё]+/g, w => {
    const v = PRON[w.toLowerCase()] ?? PRON[w.toLowerCase().replace(/ё/g,'е')];
    if(!v || typeof v !== 'string') return w;
    return w[0] === w[0].toUpperCase() ? v[0].toUpperCase() + v.slice(1) : v;
  });
}
function utter(t){
  const u = new SpeechSynthesisUtterance(pronounce(t)); u.lang = 'ru-RU';
  const v = currentVoice(); if(v) u.voice = v;
  u.rate = voiceSet.rate || .85; u.pitch = 1.05; return u;
}
function speak(t){ if(!canSpeak||!t) return; try{ speechSynthesis.cancel(); speechSynthesis.speak(utter(t)) }catch(e){} }
let playing = false;
function speakAll(list, onEach, onEnd){
  if(!canSpeak) return; try{ speechSynthesis.cancel() }catch(e){}
  playing = true; let i = 0;
  const next = () => {
    if(!playing) return;
    if(i >= list.length){ playing = false; onEnd && onEnd(); return; }
    onEach(i); const u = utter(list[i]); let fired = false;
    const go = () => { if(fired) return; fired = true; i++; setTimeout(next, 350); };
    u.onend = go; u.onerror = go;
    setTimeout(go, Math.max(2500, list[i].length*160/(voiceSet.rate||.85)));
    try{ speechSynthesis.speak(u) }catch(e){ go() }
  };
  next();
}
function stopAll(){ playing = false; try{ speechSynthesis.cancel() }catch(e){} }

/* ---------- разбор текста песни (для конструктора) ---------- */
function parseLyrics(t){
  const verses = []; let cur = [], marker = false;
  const flush = () => { if(cur.length) verses.push(cur); cur = []; };
  const all = t.replace(/\r/g,'').split('\n');
  const isMarker = l => /^\s*(\d+\s*(-?й)?\s*куплет|куплет\s*\d+|припев)\s*[.:]?\s*$/i.test(l);
  const hasMarkers = all.some(l => isMarker(l) || /^\s*\d+\s*[.)]\s*\S/.test(l));
  for(let l of all){
    l = l.trim();
    if(!l){ if(!hasMarkers && (verses.length||cur.length)) flush(); continue; }
    if(/^(слова|музыка|муз\.|сл\.)/i.test(l)) continue;
    if(isMarker(l)){ if(!marker) cur = []; else flush(); marker = true; continue; }
    const m = l.match(/^(\d+)\s*[.)]\s*(.+)$/);
    if(m){ if(!marker) cur = []; else flush(); marker = true; cur.push(m[2].trim()); continue; }
    cur.push(l);
  }
  flush();
  return verses.map(v=>v.map(x=>x.replace(/[,.;:!]+$/,''))).filter(v=>v.length);
}
