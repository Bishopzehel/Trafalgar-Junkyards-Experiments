(() => {
  'use strict';
  const API='https://darkstat.dd84ai.com/api';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const money=v=>v===null?'—':'$'+Math.round(v).toLocaleString('en-GB');
  const rows=b=>Array.isArray(b?.shop_items??b?.shopItems??b?.goods)?(b.shop_items??b.shopItems??b.goods):[];
  const nm=i=>String(i?.name??i?.good_name??i?.commodity_name??i?.nickname??i?.good??'Unknown');
  const key=i=>n(nm(i));
  const buys=i=>i?.price_base_buys_for!==undefined?num(i.price_base_buys_for):num(i?.sell_price??i?.price_to_sell_to_base??i?.price_sell);
  const sells=i=>i?.price_base_sells_for!==undefined?(i?.base_sells===false?null:num(i.price_base_sells_for)):num(i?.price??i?.price_to_buy_from_base??i?.buy_price??i?.price_buy);
  const q=i=>num(i?.quantity??i?.amount??i?.stock);
  const bn=b=>String(b?.display_name??b?.name??b?.base_name??b?.nickname??'Unknown base');
  const loc=b=>[b?.region_name??b?.region,b?.system_name??b?.system].filter(Boolean).join(' / ')||'Location not reported';
  const tabs=document.getElementById('tabs'), frame=document.querySelector('.command-frame');
  if(!tabs||!frame)return;
  const css=document.createElement('style');
  css.textContent='.trade-routes{margin-top:16px;border:1px solid var(--line-hot);background:rgba(5,5,6,.9)}.trade-routes-head,.trade-controls,.trade-legend{padding:14px 17px;border-bottom:1px solid var(--line)}.trade-routes-head h2{margin:0;color:var(--gold);font:22px Oxanium,sans-serif}.trade-routes-head p,.trade-legend{color:var(--muted);font-size:10px;line-height:1.6}.trade-controls{display:flex;align-items:end;gap:12px;flex-wrap:wrap}.trade-controls label{display:grid;gap:6px;color:var(--rose);font:9px Oxanium,sans-serif}.trade-controls select,.trade-controls button{min-height:40px;padding:0 12px;border:1px solid var(--line-hot);color:var(--text);background:#080708;font:10px Oxanium,sans-serif}.trade-controls button{cursor:pointer}.trade-status{margin-left:auto;color:var(--gold-soft);font:8px Oxanium,sans-serif}.trade-wrap{overflow:auto}.trade-table{width:100%;min-width:740px;border-collapse:collapse;text-align:left}.trade-table th{padding:10px;color:var(--gold-soft);font:8px Oxanium,sans-serif;letter-spacing:.08em;border-bottom:1px solid var(--line)}.trade-table td{padding:11px;border-bottom:1px solid rgba(255,255,255,.06);color:var(--text);font-size:10px}.trade-table strong{display:block;color:var(--gold);font:600 10px Oxanium,sans-serif}.trade-table small{display:block;margin-top:4px;color:var(--muted);font-size:8px}.trade-margin{color:var(--good)!important}.trade-empty{padding:20px;color:var(--muted);font-size:10px;line-height:1.6}';
  document.head.append(css);
  if(!tabs.querySelector('[data-view="trade-routes"]')){const b=document.createElement('button');b.className='tab';b.type='button';b.dataset.view='trade-routes';b.innerHTML='<span>04</span>TRADE ROUTES';tabs.append(b);}
  const panel=document.createElement('section');panel.id='tradeRoutesView';panel.className='view trade-routes';panel.hidden=true;
  panel.innerHTML='<header class="trade-routes-head"><p class="section-kicker">TRAFALGAR JUNKYARDS // MARKET INTELLIGENCE</p><h2>Trade Route Finder</h2><p>Price comparisons for commodities stocked at Trafalgar across player-owned bases in the live Darkstat feed.</p></header><div class="trade-controls"><label>COMMODITY IN TRAFALGAR STOCK<select id="tradeCommodity"></select></label><button id="tradeRefresh" type="button">REFRESH MARKET</button><span class="trade-status" id="tradeStatus" role="status"></span></div><div class="trade-legend"><b>BASE BUYS</b> = what the base pays you. &nbsp; <b>BASE SELLS</b> = what you pay. Margin is per unit before costs; travel time is Freighter estimate if Darkstat returns it.</div><div id="tradeResults"></div>';
  frame.insertBefore(panel,document.getElementById('errorView')||null);
  let host=null,market=[],selected='',status='LOADING MARKET',times=new Map(),serial=0;
  const opts=()=>{const m=new Map();rows(host||{}).forEach(i=>{if(key(i)&&!m.has(key(i)))m.set(key(i),{key:key(i),label:nm(i),item:i});});return [...m.values()].sort((a,b)=>a.label.localeCompare(b.label));};
  const hostFrom=s=>{const found=s?.bases instanceof Map&&s.bases.get('trafalgar-junkyards')||((s?.data||[]).find(b=>n([b?.name,b?.nickname,b?.base_name,b?.display_name].join(' ')).includes('trafalgar junkyards'))||null);return found?{...found,_dtrPob:true}:null;};
  const enc=b=>{const raw=String(b?.nickname??b?.base_name??b?.name??'');if(!b?._dtrPob)return raw;try{return btoa(unescape(encodeURIComponent(raw)));}catch{return raw;}};
  function paint(){
    const select=panel.querySelector('#tradeCommodity'), results=panel.querySelector('#tradeResults'), statusNode=panel.querySelector('#tradeStatus');
    const options=opts(); if(!options.some(o=>o.key===selected))selected=options[0]?.key||'';
    select.innerHTML=options.length?options.map(o=>'<option value="'+esc(o.key)+'">'+esc(o.label)+'</option>').join(''):'<option value="">No Trafalgar stock loaded</option>';select.value=selected;select.disabled=!options.length;
    statusNode.textContent=status;
    if(!host){results.innerHTML='<div class="trade-empty">Waiting for Trafalgar telemetry. Confirm the base is present in the live Darkstat feed.</div>';return;}
    if(!market.length){results.innerHTML='<div class="trade-empty">No other POB price quotes were found in the live feed.</div>';return;}
    const item=options.find(o=>o.key===selected), out=[];
    if(item) market.forEach(b=>{
      if(n(bn(b))===n(bn(host)))return;
      const other=rows(b).find(x=>key(x)===item.key); if(!other)return;
      const hb=buys(item.item), hs=sells(item.item), ob=buys(other), os=sells(other);
      if(hs!==null&&ob!==null)out.push({direction:'SELL FROM TRAFALGAR',from:host,to:b,buy:hs,sell:ob,margin:ob-hs,stock:q(item.item),time:times.get(enc(host)+'>'+enc(b))});
      if(os!==null&&hb!==null)out.push({direction:'BUY ELSEWHERE → TRAFALGAR',from:b,to:host,buy:os,sell:hb,margin:hb-os,stock:q(other),time:times.get(enc(b)+'>'+enc(host))});
    });
    out.sort((a,b)=>b.margin-a.margin);
    const winners=out.filter(x=>x.margin>0), shown=(winners.length?winners:out).slice(0,40);
    if(!shown.length){results.innerHTML='<div class="trade-empty">No matching quotes for this commodity at other bases.</div>';return;}
    const timeText=s=>Number.isFinite(s)?(Math.floor(s/3600)?Math.floor(s/3600)+'h '+Math.round(s%3600/60)+'m':Math.max(1,Math.round(s/60))+'m'):'Not reported';
    results.innerHTML=(winners.length?'':'<div class="trade-empty">No positive spread right now. Closest comparisons shown.</div>')+'<div class="trade-wrap"><table class="trade-table"><thead><tr><th>ROUTE</th><th>COMMODITY / STOCK</th><th>BUY AT</th><th>SELL TO</th><th>BUY PRICE</th><th>SELL PRICE</th><th>MARGIN / UNIT</th><th>FREIGHTER</th></tr></thead><tbody>'+shown.map(x=>'<tr><td><strong>'+esc(x.direction)+'</strong><small>'+esc(loc(x.from))+' → '+esc(loc(x.to))+'</small></td><td><strong>'+esc(item?.label||'')+'</strong><small>Recorded stock: '+(x.stock===null?'—':x.stock.toLocaleString('en-GB'))+'</small></td><td><strong>'+esc(bn(x.from))+'</strong><small>BASE SELLS</small></td><td><strong>'+esc(bn(x.to))+'</strong><small>BASE BUYS</small></td><td>'+money(x.buy)+'</td><td>'+money(x.sell)+'</td><td><strong class="trade-margin">'+(x.margin>0?'+':'')+money(x.margin)+'</strong><small>per unit before costs</small></td><td>'+timeText(x.time)+'</td></tr>').join('')+'</tbody></table></div>';
  }
  async function loadTimes(){
    const pairs=[];market.forEach(b=>{if(b===host)return;pairs.push({from:enc(host),to:enc(b)},{from:enc(b),to:enc(host)});});
    if(!pairs.length)return;
    status='FETCHING FREIGHTER TIMES…';paint();
    try{const r=await fetch(API+'/graph/paths',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pairs),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const body=await r.json(),list=Array.isArray(body)?body:(body.data||body.results||[]);list.forEach((x,i)=>{const t=num(x?.time?.freighter??x?.route?.time?.freighter??x?.freighter??x?.time_freighter);if(t!==null&&t<2147483647)times.set(pairs[i].from+'>'+pairs[i].to,t);});}catch{}status='LIVE PRICE COMPARISON';paint();
  }
  async function refresh(){
    const id=++serial;status='REFRESHING MARKET…';paint();
    try{
      const [pobResponse,baseResponse]=await Promise.all([fetch(API+'/pobs',{cache:'no-store',signal:AbortSignal.timeout(18000)}),fetch(API+'/npc_bases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({}),cache:'no-store',signal:AbortSignal.timeout(18000)})]);
      if(!pobResponse.ok)throw Error('POB market HTTP '+pobResponse.status);
      const pobData=await pobResponse.json(), pobs=(Array.isArray(pobData)?pobData:(pobData.pobs||pobData.data||[])).map(b=>({...b,_dtrPob:true}));
      let npc=[];
      if(baseResponse.ok){
        const baseData=await baseResponse.json(), allBases=Array.isArray(baseData)?baseData:(baseData.bases||baseData.data||[]);
        const candidates=allBases.filter(b=>b?.is_pob!==true&&b?.is_pob!==1&&b?.is_pob!=='true'&&b?.nickname);
        for(let i=0;i<candidates.length;i+=150){
          const chunk=candidates.slice(i,i+150), rr=await fetch(API+'/npc_bases/market_goods',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(chunk.map(b=>b.nickname)),signal:AbortSignal.timeout(18000)});
          if(!rr.ok)continue;const answers=await rr.json();
          (Array.isArray(answers)?answers:[]).forEach(answer=>{
            const meta=chunk.find(b=>String(b.nickname)===String(answer.nickname));if(!meta)return;
            const goods=Array.isArray(answer.market_goods)?answer.market_goods:[];
            npc.push({...meta,shop_items:goods.map(g=>({...g,name:g.name??g.good_name??g.nickname,base_sells:g.base_sells,price_base_buys_for:g.price_base_buys_for,price_base_sells_for:g.price_base_sells_for}))});
          });
        }
      }
      if(id!==serial)return;market=[...pobs,...npc];times.clear();status='MARKET UPDATED // '+pobs.length+' POBS + '+npc.length+' NPC BASES';paint();void loadTimes();
    }catch(e){if(id!==serial)return;status='NPC FEED UNAVAILABLE // USING POB QUOTES';try{const r=await fetch(API+'/pobs',{cache:'no-store',signal:AbortSignal.timeout(18000)});const data=await r.json();market=(Array.isArray(data)?data:(data.pobs||data.data||[])).map(b=>({...b,_dtrPob:true}));paint();void loadTimes();}catch{market=[];paint();}}
  }
  function sync(){const s=window.DTRApp?.getState?.();if(!s)return;host=hostFrom(s);if(Array.isArray(s.data)&&s.data.length){market=s.data;status='LIVE FEED // '+market.length+' POBS';}paint();}
  tabs.addEventListener('click',e=>{const tab=e.target.closest('.tab[data-view="trade-routes"]');if(!tab)return;document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='tradeRoutesView');tabs.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===tab));sync();if(!market.length)void refresh();});
  panel.querySelector('#tradeCommodity').addEventListener('change',e=>{selected=e.target.value;paint();});
  panel.querySelector('#tradeRefresh').addEventListener('click',()=>{sync();void refresh();});
  window.addEventListener('dtr:statechange',sync);sync();void refresh();
})();