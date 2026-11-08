/* Конструктор новой песни: текст → строчки с картинками → JSON-файл для папки songs. */
let draft = []; // [[{text, pictures, caption}]]
let openPicker = null; // "v-l"

const TR = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
const slug = s => s.toLowerCase().split('').map(c => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);

$('#fTitle').addEventListener('input', () => { if(!$('#fId').dataset.touched) $('#fId').value = slug($('#fTitle').value); updateOut(); });
$('#fId').addEventListener('input', () => { $('#fId').dataset.touched = '1'; updateOut(); });
['#fCredits','#fUrl','#fListen'].forEach(s => $(s).addEventListener('input', updateOut));

$('#parseBtn').addEventListener('click', () => {
  const verses = parseLyrics($('#fText').value);
  if(!verses.length){ alert('Не нашлось ни одной строчки. Вставьте текст песни.'); return; }
  draft = verses.map(v => v.map(text => ({text, pictures: guessPictures(text), caption: ''})));
  openPicker = null; renderLines(); updateOut();
  $('#linesPanel').hidden = false; $('#outPanel').hidden = false;
  $('#linesPanel').scrollIntoView({behavior:'smooth'});
});

function renderLines(){
  $('#lines').innerHTML = draft.map((v,vi) => `<h3>Куплет ${vi+1}</h3>` + v.map((l,li) => {
    const key = `${vi}-${li}`;
    return `<div class="mline">
      <div class="mline-top">
        <button class="chosen" data-pick="${key}" aria-expanded="${openPicker===key}" title="Выбрать картинку" style="background:none;border:0;padding:0;cursor:pointer">${l.pictures.map(p=>`<img src="${esc(picSrc(p))}" alt="${esc(picLabel(p))}">`).join('')}</button>
        <input type="text" data-text="${key}" value="${esc(l.text)}" aria-label="Строчка">
      </div>
      ${openPicker===key ? `<div class="picker">${Object.entries(PICS).map(([name,p]) => `<button class="pk" data-k="${key}" data-p="${name}" aria-pressed="${l.pictures.includes(name)}"><img src="${esc(p.file)}" alt="">${esc(p.label)}</button>`).join('')}</div>
        <div class="field"><label>Своя картинка (путь к файлу)</label><input type="text" data-own="${key}" placeholder="images/kot.png" value="${esc(l.pictures.filter(isFile).join(', '))}"></div>` : ''}
      <div class="field"><label>Подпись под картинкой</label><input type="text" data-cap="${key}" placeholder="${esc(l.pictures.map(picLabel).join(' и '))}" value="${esc(l.caption)}"></div>
    </div>`;
  }).join('')).join('');
}
const at = key => { const [v,l] = key.split('-').map(Number); return draft[v][l]; };

$('#lines').addEventListener('click', e => {
  const pick = e.target.closest('[data-pick]');
  if(pick){ openPicker = openPicker===pick.dataset.pick ? null : pick.dataset.pick; renderLines(); return; }
  const pk = e.target.closest('.pk');
  if(pk){
    const line = at(pk.dataset.k), name = pk.dataset.p;
    let cur = [...line.pictures];
    if(cur.includes(name)){ if(cur.length>1) cur = cur.filter(x=>x!==name); }
    else { cur.push(name); if(cur.length>2) cur.shift(); }
    // строчки с тем же текстом (например, припев) получают те же картинки
    draft.flat().forEach(l => { if(norm(l.text)===norm(line.text)) l.pictures = [...cur]; });
    renderLines(); updateOut();
  }
});
$('#lines').addEventListener('input', e => {
  const t = e.target;
  if(t.dataset.text){ at(t.dataset.text).text = t.value; updateOut(); }
  if(t.dataset.cap){ at(t.dataset.cap).caption = t.value; updateOut(); }
});
$('#lines').addEventListener('change', e => {
  const t = e.target;
  if(t.dataset.own){
    const files = t.value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,2);
    const line = at(t.dataset.own);
    line.pictures = files.length ? files : line.pictures.filter(p=>!isFile(p)).concat(line.pictures.length?[]:['star']);
    if(!line.pictures.length) line.pictures = ['star'];
    renderLines(); updateOut();
  }
});

function buildSong(){
  const s = { title: $('#fTitle').value.trim() || 'Новая песня' };
  if($('#fCredits').value.trim()) s.credits = $('#fCredits').value.trim();
  if($('#fUrl').value.trim()) s.listen = { label: $('#fListen').value.trim() || 'Послушать песню', url: $('#fUrl').value.trim() };
  s.verses = draft.map(v => v.map(l => { const o = {text: l.text.trim(), pictures: l.pictures}; if(l.caption.trim()) o.caption = l.caption.trim(); return o; }));
  return s;
}
function songJSON(s){
  const j = x => JSON.stringify(x);
  let out = `{\n  "title": ${j(s.title)},\n`;
  if(s.credits) out += `  "credits": ${j(s.credits)},\n`;
  if(s.listen) out += `  "listen": ${j(s.listen)},\n`;
  out += `  "verses": [\n` + s.verses.map(v => `    [\n` + v.map(l => `      ${j(l)}`).join(',\n') + `\n    ]`).join(',\n') + `\n  ]\n}\n`;
  return out;
}
function updateOut(){
  if(!draft.length) return;
  const s = buildSong(), id = $('#fId').value.trim() || 'novaya-pesnya';
  $('#outSong').value = songJSON(s);
  $('#fileHint').innerHTML = `Создайте в репозитории файл <code>songs/${esc(id)}.json</code> и вставьте в него этот текст.`;
  const first = draft[0] && draft[0].find(l => !l.pictures.includes('drawing')) || draft[0][0];
  const entry = {id, title: s.title}; if(s.credits) entry.credits = s.credits; entry.cover = first.pictures[0];
  $('#outIndex').value = '  ' + JSON.stringify(entry);
  try{ localStorage.setItem('pesni-v-kartinkah-draft', JSON.stringify(s)) }catch(e){}
}

$('#previewBtn').addEventListener('click', () => { updateOut(); window.open('song.html?preview', '_blank'); });
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-copy]'); if(!b) return;
  const ta = $('#'+b.dataset.copy);
  try{ await navigator.clipboard.writeText(ta.value); b.textContent = 'Скопировано'; }
  catch(err){ ta.focus(); ta.select(); b.textContent = 'Выделено — нажмите Ctrl+C'; }
  setTimeout(() => b.textContent = 'Скопировать', 2000);
});

loadPictures().catch(err => alert('Не удалось загрузить картинки: ' + err.message));
