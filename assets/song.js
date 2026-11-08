/* Страница песни: игра «Собираем» и «Поём». Песня берётся из songs/<id>.json
   (song.html?song=<id>) или из черновика конструктора (song.html?preview). */
const VCOL = ['#D9734E','#4E8FC9','#6FA350','#9A72C4','#D9A23B','#C9576E'];
const CONF = ['#D8473C','#F2CB65','#86B25B','#4F8ECF','#EF9548','#EBA2B4','#9A7CC9'];
let song = null, verses = [];
let view = 0, mode = 'build', pos = 0, placed = [], tray = [], miss = 0, wrong = 0, hintT = null,
    lastText = '', done = false, showText = false, justPlaced = -1;

const L = () => view < 0 ? verses.flat() : verses[view];
const same = (a,b) => a.pictures.join() === b.pictures.join();
const say = line => line.text || captionOf(line);
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a }

function reset(){
  stopAll(); pos=0; placed=[]; miss=0; wrong=0; hintT=null; lastText=''; done=false; showText=false; justPlaced=-1;
  if(mode==='build'){ const n=L().length; tray=shuffle([...Array(n).keys()]); if(n>2 && tray.every((t,i)=>t===i)) tray.reverse(); }
}

function render(){
  if(view >= verses.length) view = 0;
  if(view < 0) mode = 'sing';
  const lines = L(), n = lines.length;
  $('#sub').textContent = verses.length > 1 ? (view < 0 ? 'Вся песня' : `Куплет ${view+1} из ${verses.length}`) : '';
  $('#verses').innerHTML = verses.length > 1
    ? verses.map((_,i)=>`<button class="vbtn" style="background:${VCOL[i%VCOL.length]}" data-view="${i}" aria-pressed="${view===i}" aria-label="Куплет ${i+1}">${i+1}</button>`).join('')
      + `<button class="vbtn all" data-view="-1" aria-pressed="${view<0}">Вся песня</button>` : '';
  $('#modes').hidden = view < 0;
  document.querySelectorAll('.mode').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode===mode)));

  const tile = (l,i) => {
    let on, cur=false, mark='';
    if(mode==='build'){ on=!!placed[i]; cur=i===pos&&!done; if(on) mark=`<span class="mark${i===justPlaced?' pop':''}"></span>`; }
    else { on=true; cur=i===pos&&!done; if(i<pos||done) mark='<span class="mark"></span>'; }
    const tag = mode==='sing'&&cur ? 'button' : 'div';
    return `<${tag} class="tile${on?' on':''}${cur?' cur':''}"${tag==='button'?' data-act="next"':''} aria-label="Строчка ${i+1}">${on?picsHTML(l):`<span class="slot">${i+1}</span>`}${mark}</${tag}>`;
  };
  if(view < 0){ let off=0; $('#grid').innerHTML = verses.map((v,vi)=>{ const h=`<h3 class="vh">Куплет ${vi+1}</h3><div class="grid">${v.map((l,j)=>tile(l,off+j)).join('')}</div>`; off+=v.length; return h; }).join(''); }
  else $('#grid').innerHTML = `<div class="grid">${lines.map(tile).join('')}</div>`;

  const c = $('#ctrl'), hasNext = view >= 0 && view < verses.length-1;
  if(mode==='build'){
    if(done) c.innerHTML = `<p class="big">Молодец!</p><p>Рисунок собран${miss?'':' без единой ошибки'}. Теперь споём по картинкам.</p><div class="row"><button class="btn primary" data-act="tosing">Поём!</button><button class="btn" data-act="again">Собрать ещё раз</button></div>`;
    else c.innerHTML = `<p class="line${lastText?'':' quiet'}">${lastText?esc(lastText):'Какая картинка дальше?'}</p>
      <div class="tray">${tray.map(t=>`<button class="tile on tt${hintT===t?' hint':''}" data-t="${t}" aria-label="Картинка">${picsHTML(lines[t])}</button>`).join('')}</div>
      <p class="tip">Нажимайте картинки по порядку, как поётся песня. Правильная встаёт на рисунок и получает зелёную галочку.</p>`;
  } else {
    if(done) c.innerHTML = `<p class="big">Ура!</p><p>${view<0||verses.length===1?'Вся песня спета!':'Куплет спет.'}</p><div class="row">${hasNext?'<button class="btn primary" data-act="nextverse">Следующий куплет</button>':''}<button class="btn${hasNext?'':' primary'}" data-act="again">Спеть ещё раз</button></div>`;
    else c.innerHTML = `<p class="line${showText?'':' quiet'}">${showText?esc(say(lines[pos])):'Пой строчку по картинке в жёлтой рамке'}</p>
      <div class="row"><button class="btn" data-act="hint">Подсказать</button><button class="btn primary" data-act="next">Дальше</button></div>
      <div class="row"><button class="btn" data-act="${playing?'stop':'listen'}">${playing?'Стоп':(view<0||verses.length===1?'Послушать всю песню':'Послушать весь куплет')}</button></div>`;
  }
  fit();
  if(view<0 && !done && pos>0){ const cur=document.querySelector('#grid .cur'); if(cur) try{ cur.scrollIntoView({block:'center',behavior:'smooth'}) }catch(e){} }
}


/* размер картинок подбирается так, чтобы рисунок и кнопки помещались на экран */
function fit(){
  const root = document.documentElement, grid = document.querySelector('#grid .grid');
  if(!grid || $('#play').hidden) return;
  const area = $('#grid').clientWidth, gap = 8;
  const byW = Math.floor((area - 3*gap) / 4);
  if(view < 0){ const t = Math.min(byW, 110); root.style.setProperty('--t', t+'px'); root.style.setProperty('--tt', '64px'); return; }
  const rows = Math.ceil(L().length / 4);
  for(let pass = 0; pass < 2; pass++){
    const top = grid.getBoundingClientRect().top + window.scrollY;
    const bottomSpace = $('#ctrl').offsetHeight + 10 + 8;
    const byH = Math.floor((window.innerHeight - top - bottomSpace - (rows-1)*gap) / rows);
    const t = Math.max(56, Math.min(byW, byH, 150));
    root.style.setProperty('--t', t+'px');
    root.style.setProperty('--tt', Math.max(52, Math.min(88, Math.round(t*.72)))+'px');
  }
}
window.addEventListener('resize', fit);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

function burst(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box=$('#confetti');
  for(let i=0;i<34;i++){ const s=document.createElement('span'); s.style.left=Math.random()*100+'%'; s.style.background=CONF[i%CONF.length]; s.style.animationDelay=(Math.random()*.4)+'s'; box.appendChild(s); }
  setTimeout(()=>box.innerHTML='',2300);
}

$('#play').addEventListener('click', e => {
  const v=e.target.closest('[data-view]'); if(v){ view=+v.dataset.view; mode=view<0?'sing':'build'; reset(); render(); return; }
  const m=e.target.closest('[data-mode]'); if(m){ mode=m.dataset.mode; reset(); render(); return; }
  const lines=L(), n=lines.length;
  const t=e.target.closest('[data-t]');
  if(t && mode==='build' && !done){
    const idx=+t.dataset.t;
    if(same(lines[idx],lines[pos])){
      placed[pos]=true; justPlaced=pos; lastText=say(lines[pos]); speak(lastText);
      tray.splice(tray.indexOf(idx),1); pos++; wrong=0; hintT=null;
      if(pos>=n){ done=true; burst(); statsEvent(`sobrali-kuplet-${view+1}`, `Собрали куплет ${view+1}`); }
      render();
    } else {
      miss++; wrong++; t.classList.remove('no'); void t.offsetWidth; t.classList.add('no');
      if(wrong>=2){ hintT=tray.find(x=>same(lines[x],lines[pos])); const b=document.querySelector(`[data-t="${hintT}"]`); if(b) b.classList.add('hint'); }
    }
    return;
  }
  const a=e.target.closest('[data-act]'); if(!a) return;
  switch(a.dataset.act){
    case 'next': if(done) return; stopAll(); showText=false; pos++; if(pos>=n){ done=true; burst(); statsEvent(view<0?'speli-vsyu-pesnyu':`speli-kuplet-${view+1}`, view<0?'Спели всю песню':`Спели куплет ${view+1}`); } break;
    case 'hint': showText=true; speak(say(lines[pos])); break;
    case 'listen': statsEvent('poslushali-golosom', 'Послушали голосом'); pos=0; done=false; speakAll(lines.map(say), i=>{ pos=i; showText=true; render(); }, ()=>{ pos=n; done=true; burst(); render(); }); break;
    case 'stop': stopAll(); break;
    case 'again': reset(); break;
    case 'tosing': mode='sing'; reset(); break;
    case 'nextverse': view++; mode='build'; reset(); break;
  }
  render();
});

/* ---------- голос и печать ---------- */
function fillVoices(){
  const sel=$('#voiceSel');
  if(!canSpeak || !voices.length){ sel.innerHTML='<option>Русских голосов на этом устройстве не найдено</option>'; sel.disabled=true; return; }
  sel.disabled=false; const cv=currentVoice();
  sel.innerHTML=voices.map(v=>`<option value="${esc(v.name)}"${cv&&v.name===cv.name?' selected':''}>${esc(v.name)}</option>`).join('');
}
document.addEventListener('voiceschanged', fillVoices);
$('#voiceSel').addEventListener('change', e => { voiceSet.voice=e.target.value; saveVoice(); });
$('#rateIn').addEventListener('input', e => { voiceSet.rate=+e.target.value; saveVoice(); });
$('#testVoice').addEventListener('click', () => speak('Привет! Давай вместе нарисуем песню.'));
$('#openSettings').addEventListener('click', () => { stopAll(); fillVoices(); $('#rateIn').value=voiceSet.rate||.85; $('#settings').hidden=false; $('#play').hidden=true; $('#foot').hidden=true; });
$('#closeSettings').addEventListener('click', () => { $('#settings').hidden=true; $('#play').hidden=false; $('#foot').hidden=false; render(); });
$('#printText').addEventListener('change', buildPrint);
$('#printBtn').addEventListener('click', () => { buildPrint(); statsEvent('pechat', 'Распечатали песню'); window.print(); });
$('#listen').addEventListener('click', () => statsEvent('zapis-hora', 'Открыли запись хора'));

function buildPrint(){
  const withText = $('#printText').checked;
  $('#printView').innerHTML = `<h1>${esc(song.title)}</h1>${song.credits?`<p class="pv-cr">(${esc(song.credits)})</p>`:''}<p class="pv-sub">Пой по картинкам: слева направо, строчка за строчкой.</p>` +
    verses.map((v,i)=>`<div class="pv-v">${verses.length>1?`<p class="pv-h">Куплет ${i+1}</p>`:''}<div class="pv-g">${v.map(l=>`<div class="pv-c">${picsHTML(l)}${withText&&l.text?`<div class="pv-t">${esc(l.text)}</div>`:''}</div>`).join('')}</div></div>`).join('');
}

/* ---------- запуск ---------- */
function normalizeSong(s){
  return (s.verses||[]).map(v => (Array.isArray(v) ? v : v.lines||[]).map(l => ({
    text: (l.text||'').trim(),
    pictures: (l.pictures && l.pictures.length) ? l.pictures : guessPictures(l.text||''),
    caption: l.caption || ''
  }))).filter(v => v.length);
}
function showError(msg){ const e=$('#error'); e.hidden=false; e.innerHTML=msg; }

(async function start(){
  let id = '';
  try{
    await loadPictures();
    const params = new URLSearchParams(location.search);
    if(params.has('preview')){
      try{ song = JSON.parse(localStorage.getItem('pesni-v-kartinkah-draft')||'null') }catch(e){ song=null }
      if(!song) throw new Error('Черновик не найден. Откройте конструктор и нажмите «Посмотреть, как получится».');
    } else {
      const list = await getJSON('songs/index.json');
      if(list.length > 1) $('#back').hidden = false;
      id = params.get('song') || (list[0] && list[0].id);
      if(!id) throw new Error('Список песен пуст.');
      if(!/^[a-z0-9-]+$/i.test(id)) throw new Error('В ссылке неправильное имя песни.');
      song = await getJSON(`songs/${id}.json`);
    }
    verses = normalizeSong(song);
    if(!verses.length) throw new Error('В файле песни нет ни одной строчки.');
    document.title = song.title || 'Песня в картинках';
    $('#title').textContent = song.title || 'Песня в картинках';
    if(song.credits){ $('#credits').textContent = `(${song.credits})`; $('#credits').hidden=false; }
    if(song.listen && song.listen.url){ const a=$('#listen'); a.href=song.listen.url; a.querySelector('span').textContent=song.listen.label||'Послушать песню'; a.hidden=false; }
    $('#play').hidden=false; $('#foot').hidden=false;
    statsPage(params.has('preview') ? 'chernovik' : id, song.title || '');
    reset(); render(); buildPrint();
  }catch(err){
    showError(`<b>Песня не открылась.</b><br>${esc(err.message)}`);
  }
})();
