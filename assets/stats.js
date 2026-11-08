/* Статистика посещений через GoatCounter (goatcounter.com).
   Впишите сюда имя своего счётчика — ту часть адреса, что стоит перед .goatcounter.com.
   Например, для адреса https://poem-po-kartinkam.goatcounter.com впишите 'poem-po-kartinkam'.
   Пока строка пустая, статистика не собирается. */
const GOATCOUNTER_CODE = 'anastasia-chernaya';

(function(){
  const queue = [];
  let ready = false;
  // Просмотр страницы песни считаем сами (после загрузки песни), остальные страницы — автоматически.
  const manual = !!document.querySelector('[data-stats-manual]');
  window.goatcounter = { no_onload: manual };

  function flush(){
    if(!window.goatcounter || typeof window.goatcounter.count !== 'function') return false;
    ready = true;
    while(queue.length) try{ window.goatcounter.count(queue.shift()) }catch(e){}
    return true;
  }
  function send(opts){
    if(!GOATCOUNTER_CODE) return;
    queue.push(opts);
    if(ready) flush();
  }

  /* Просмотр песни: путь /pesnya/<имя>, заголовок — название песни */
  window.statsPage = (id, title) => send({ path: '/pesnya/' + id, title: title });
  /* Событие: собрали куплет, спели песню, нажали кнопку и т. п. */
  window.statsEvent = (name, title) => send({ path: name, title: title || name, event: true });

  if(!GOATCOUNTER_CODE) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  s.onload = () => { if(!flush()){ const t = setInterval(() => { if(flush()) clearInterval(t) }, 300); setTimeout(() => clearInterval(t), 10000); } };
  document.head.appendChild(s);
})();
