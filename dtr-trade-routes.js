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
  const buys=i=>{const v=i?.price_base_buys_for!==undefined?num(i.price_base_buys_for):num(i?.sell_price??i?.price_to_sell_to_base??i?.price_sell);return v!==null&&v>0?v:null;};
  const sells=i=>{const v=i?.price_base_sells_for!==undefined?(i?.base_sells===false?null:num(i.price_base_sells_for)):num(i?.price??i?.price_to_buy_from_base??i?.buy_price??i?.price_buy);return v!==null&&v>0?v:null;};
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
  panel.innerHTML='<header class="trade-routes-head"><p class="section-kicker">TRAFALGAR JUNKYARDS // MARKET INTELLIGENCE</p><h2>Trade Route Finder</h2><p>Trade opportunities for every commodity found across NPC and player-owned markets. Compare buy and sell prices, stock, locations, and per-unit margin.</p></header><div class="trade-controls"><label>MARKET COMMODITY<select id="tradeCommodity"></select></label><button id="tradeRefresh" type="button">REFRESH MARKET</button><span class="trade-status" id="tradeStatus" role="status"></span></div><div class="trade-legend"><b>BASE BUYS</b> = what the base pays you. &nbsp; <b>BASE SELLS</b> = what you pay. Margin is per unit before costs; travel time is Freighter estimate if Darkstat returns it.</div><div id="tradeResults"></div>';
  frame.insertBefore(panel,document.getElementById('errorView')||null);
  let host=null,market=[],selected='',status='LOADING MARKET',times=new Map(),serial=0,marketLoaded=false;
  const opts=()=>{
    const m=new Map();
    market.forEach(b=>rows(b).forEach(i=>{
      const k=key(i);
      if(k&&!m.has(k))m.set(k,{key:k,label:nm(i)});
    }));
    return [...m.values()].sort((a,b)=>a.label.localeCompare(b.label));
  };
  const hostFrom=s=>{const found=s?.bases instanceof Map&&s.bases.get('trafalgar-junkyards')||((s?.data||[]).find(b=>n([b?.name,b?.nickname,b?.base_name,b?.display_name].join(' ')).includes('trafalgar junkyards'))||null);return found?{...found,_dtrPob:true}:null;};
  const enc=b=>{const raw=String(b?.nickname??b?.base_name??b?.name??'');if(!b?._dtrPob)return raw;try{return btoa(unescape(encodeURIComponent(raw)));}catch{return raw;}};
  const baseKey=b=>String(b?.nickname??b?.base_name??b?.name??b?.display_name??'').trim().toLowerCase();
  function paint(){
    const select=panel.querySelector('#tradeCommodity'), results=panel.querySelector('#tradeResults'), statusNode=panel.querySelector('#tradeStatus');
    const options=opts();
    if(selected!=='all'&&!options.some(o=>o.key===selected))selected='all';
    select.innerHTML='<option value="all">ALL COMMODITIES ('+options.length+')</option>'+options.map(o=>'<option value="'+esc(o.key)+'">'+esc(o.label)+'</option>').join('');
    select.value=selected;select.disabled=!options.length;
    statusNode.textContent=status;
    if(!market.length){results.innerHTML='<div class="trade-empty">Waiting for market telemetry from the Darkstat feed.</div>';return;}
    if(!options.length){results.innerHTML='<div class="trade-empty">The live market feed has no commodity price records yet.</div>';return;}
    const chosen=selected==='all'?options:options.filter(o=>o.key===selected), out=[];
    chosen.forEach(item=>{
      const quotes=[];
      market.forEach(b=>{
        const good=rows(b).find(x=>key(x)===item.key);
        if(!good)return;
        const buyFromBase=sells(good), sellToBase=buys(good);
        quotes.push({base:b,good,buyFromBase,sellToBase,stock:q(good)});
      });
      const routes=[];
      quotes.forEach(from=>{
        if(from.buyFromBase===null)return;
        quotes.forEach(to=>{
          if(baseKey(from.base)===baseKey(to.base)||to.sellToBase===null)return;
          routes.push({commodity:item.label,from:from.base,to:to.base,buy:from.buyFromBase,sell:to.sellToBase,margin:to.sellToBase-from.buyFromBase,stock:from.stock});
        });
      });
      routes.sort((a,b)=>b.margin-a.margin);
      const profitable=routes.filter(x=>x.margin>0);
      const ranked=profitable.length?profitable:routes;
      const limit=selected==='all'?3:40;
      if(!ranked.length)out.push({commodity:item.label,unavailable:true});
      else out.push(...ranked.slice(0,limit));
    });
    out.sort((a,b)=>b.margin-a.margin);
    if(!out.length){results.innerHTML='<div class="trade-empty">Market records are present, but no commodity has a matching buy-at and sell-to price pair yet.</div>';return;}
    const timeText=()=> 'Not reported';
    results.innerHTML='<div class="trade-empty">'+(selected==='all'?'Showing up to three strongest routes for each commodity. Select one commodity to see more route comparisons.':'Showing up to 40 route comparisons for this commodity.')+' A route buys where BASE SELLS and sells where BASE BUYS; margin is per unit before travel and other costs. Recorded stock is shown for the source base.</div><div class="trade-wrap"><table class="trade-table"><thead><tr><th>COMMODITY</th><th>ROUTE / LOCATION</th><th>BUY AT</th><th>SELL TO</th><th>BUY PRICE</th><th>SELL PRICE</th><th>STOCK AT SOURCE</th><th>MARGIN / UNIT</th><th>FREIGHTER</th></tr></thead><tbody>'+out.map(x=>x.unavailable?'<tr><td><strong>'+esc(x.commodity)+'</strong></td><td colspan="8" class="trade-empty">No matching two-sided price quotes are available in the current market feed.</td></tr>':'<tr><td><strong>'+esc(x.commodity)+'</strong></td><td><strong>'+esc(bn(x.from))+' → '+esc(bn(x.to))+'</strong><small>'+esc(loc(x.from))+' → '+esc(loc(x.to))+'</small></td><td><strong>'+esc(bn(x.from))+'</strong><small>BASE SELLS</small></td><td><strong>'+esc(bn(x.to))+'</strong><small>BASE BUYS</small></td><td>'+money(x.buy)+'</td><td>'+money(x.sell)+'</td><td>'+(x.stock===null?'—':x.stock.toLocaleString('en-GB'))+'</td><td><strong class="trade-margin">'+(x.margin>0?'+':'')+money(x.margin)+'</strong><small>per unit before costs</small></td><td>'+timeText()+'</td></tr>').join('')+'</tbody></table></div>';
  }
  async function loadTimes(){}\n  async function refresh(){
    const id=++serial;status='REFRESHING MARKET…';paint();
    try{
      const [pobResponse,baseResponse]=await Promise.all([fetch(API+'/pobs',{cache:'no-store',signal:AbortSignal.timeout(18000)}),fetch(API+'/npc_bases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({}),cache:'no-store',signal:AbortSignal.timeout(18000)})]);
      if(!pobResponse.ok)throw Error('POB market HTTP '+pobResponse.status);
      const pobData=await pobResponse.json(), pobs=(Array.isArray(pobData)?pobData:(pobData.pobs||pobData.data||[])).map(b=>({...b,_dtrPob:true}));
      let npc=[];
      if(baseResponse.ok){
        const baseData=await baseResponse.json(), allBases=Array.isArray(baseData)?baseData:(baseData.bases||baseData.data||[]);
        const candidates=allBases.filter(b=>((b?.is_pob??b?.IsPob??b?.isPob)!==true)&&((b?.is_pob??b?.IsPob??b?.isPob)!==1)&&((b?.is_pob??b?.IsPob??b?.isPob)!=='true')&&b?.nickname);
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
      if(id!==serial)return;market=[...pobs,...npc];marketLoaded=true;times.clear();status='MARKET UPDATED // '+market.length+' MARKETS';paint();
    }catch(e){if(id!==serial)return;status='NPC FEED UNAVAILABLE // USING POB QUOTES';try{const r=await fetch(API+'/pobs',{cache:'no-store',signal:AbortSignal.timeout(18000)});const data=await r.json();market=(Array.isArray(data)?data:(data.pobs||data.data||[])).map(b=>({...b,_dtrPob:true}));marketLoaded=true;paint();}catch{market=[];paint();}}
  }
  function sync(){const s=window.DTRApp?.getState?.();if(!s)return;host=hostFrom(s);if(!marketLoaded&&Array.isArray(s.data)&&s.data.length){market=s.data;status='LIVE FEED // '+market.length+' POBS';}paint();}
  tabs.addEventListener('click',e=>{const tab=e.target.closest('.tab[data-view="trade-routes"]');if(!tab)return;document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='tradeRoutesView');tabs.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===tab));sync();if(!market.length)void refresh();});
  panel.querySelector('#tradeCommodity').addEventListener('change',e=>{selected=e.target.value;paint();});
  panel.querySelector('#tradeRefresh').addEventListener('click',()=>{sync();void refresh();});
  window.addEventListener('dtr:statechange',sync);sync();void refresh();
})();