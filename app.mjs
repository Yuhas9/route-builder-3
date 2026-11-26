import {RouteMap} from './map.mjs';import {parseCSV,parseGPX,exportCSV,valid} from './files.mjs';import {sequence,distance} from './sequence.mjs';
const $=id=>document.getElementById(id), KEY='route-builder-3-foundation-v1',THEME='route-builder-3-theme';let library=[],active=null,proposal=null,selected=null,tab='routes',timer=null;
const current=()=>library.find(r=>r.id===active);
const notice=s=>$('notice').textContent=s;
let db=null,storageError='',saving=false;
function openLibraryDB(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('route-builder-3-library',1);
  let blocked=false;
  request.onupgradeneeded=()=>{const d=request.result;if(!d.objectStoreNames.contains('state'))d.createObjectStore('state');};
  request.onsuccess=()=>{const d=request.result;if(blocked){d.close();return;}d.onversionchange=()=>{d.close();db=null;notice('Library database changed in another tab. Reload before editing.');};resolve(d);};
  request.onerror=()=>reject(request.error||Error('Cannot open local database.'));
  request.onblocked=()=>{blocked=true;reject(Error('Close other Route Builder 3.0 tabs, then reload.'));};
 });
}
function readLibraryDB(d){
 return new Promise((resolve,reject)=>{
  const tx=d.transaction('state','readonly'),request=tx.objectStore('state').get('library');
  tx.oncomplete=()=>resolve(request.result);
  tx.onabort=tx.onerror=()=>reject(tx.error||request.error||Error('Cannot read local database.'));
 });
}
function writeLibraryDB(d,state){
 return new Promise((resolve,reject)=>{
  const tx=d.transaction('state','readwrite');
  tx.oncomplete=()=>resolve(true);
  tx.onabort=tx.onerror=()=>reject(tx.error||Error('Local database write failed.'));
  tx.objectStore('state').put(state,'library');
 });
}
try{
 db=await openLibraryDB();
 const state=await readLibraryDB(db);
 if(state!==undefined){
  if(!state||!Array.isArray(state.library))throw Error('Stored library has an unexpected format. No data overwritten.');
  library=state.library;active=state.active;
 }else{
  // Migrate only the earlier 3.0 library. Never read or clear the original website's keys.
  const raw=localStorage.getItem(KEY);
  if(raw){const previous=JSON.parse(raw);if(!Array.isArray(previous.library))throw Error('Earlier 3.0 library has an unexpected format.');library=previous.library;active=previous.active;await writeLibraryDB(db,{library,active});}
 }
}catch(e){storageError=e.message||'Local database unavailable.';if(db)db.close();db=null;}
async function save(){
 if(!db||saving){notice('Local library could not be saved. Export a backup before closing. '+(storageError||'Reload this page and try again.'));return false;}
 saving=true;const main=document.querySelector('main');main.inert=true;
 try{await writeLibraryDB(db,{library,active});return true;}
 catch(e){notice('Local database save failed: '+(e.message||'Storage unavailable')+'. Export a backup before closing.');return false;}
 finally{saving=false;main.inert=false;}
}
function button(text,fn,cls=''){let b=document.createElement('button');b.textContent=text;b.className=cls;b.onclick=fn;return b;}function text(el,t,cls){let p=document.createElement('div');p.textContent=t;if(cls)p.className=cls;el.append(p);return p;}function clearProposal(){proposal=null;$('accept').disabled=true;$('discard').disabled=true;$('result').replaceChildren();}function stopReplay(){clearInterval(timer);timer=null;map.replay=null;$('play').textContent='Replay recorded path';$('scrub').value=0;}function invalidate(){clearProposal();stopReplay();selected=null;}const map=new RouteMap($('map'),id=>{selected=id;showTab('stops');render();});
function showTab(t){tab=t;document.querySelectorAll('section').forEach(s=>s.hidden=s.id!==t);document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));document.querySelector('main').classList.toggle('mapOnly',t==='map');if(t==='stops')renderStops();}document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
function render(){let r=current();$('routeTitle').textContent=r?`${r.name} · ${r.kind}`:'No route selected';$('library').replaceChildren();for(const item of library){let b=button(`${item.name} · ${item.stops.length} stops`,async()=>{invalidate();active=item.id;if(!await save()){render();return;}render();map.fit();notice('Route opened.');},'routeItem'+(item.id===active?' active':''));$('library').append(b);}$('foot').textContent=r?`${r.stops.length} stops · ${r.tracks.reduce((n,t)=>n+t.length,0)} track points · Local library`:'Local library · no Google API';$('maphint').textContent=r?(proposal?'Proposed sequence • orange = needs review':'Recorded path • blue line · pink stop pins'):'Create a route to begin';let shown=proposal?proposal.stops:r?.stops||[];map.selected=selected;map.setData(r?.tracks||[],shown);renderStops();let miles=(r?.tracks||[]).reduce((a,t)=>a+t.slice(1).reduce((v,p,i)=>v+distance(t[i],p),0),0)/1609.344;$('stats').textContent=r?`${r.stops.length} customers · ${miles.toFixed(2)} recorded miles · ${r.tracks.length} track segment(s)`:'No route selected';for(const id of ['gpx','csv','rename','sequence','original','exportCSV','exportGPX','play'])$(id).disabled=!r;for(const id of ['exportGPX','play'])$(id).disabled=!r?.gpx;}
function renderStops(){let r=current(),list=proposal?proposal.stops:r?.stops||[],q=$('search').value.trim().toLowerCase(),el=$('stopList');$('count').textContent=`(${list.length})`;el.replaceChildren();for(let i=0;i<list.length;i++){let s=list[i];if(q&&!s.address.toLowerCase().includes(q)&&String(i+1)!==q)continue;let b=button('',()=>{selected=s.id;map.selected=s.id;map.center={lat:s.lat,lon:s.lon};map.z=Math.max(map.z,18);map.draw();renderStops();},'stopItem'+(s.id===selected?' active':''));let num=document.createElement('b');num.textContent=String(i+1);b.append(num);let span=document.createElement('span');span.textContent=s.address+(s.flags?.length?' ⚠':'');b.append(span);el.append(b);}const box=$('selected');box.replaceChildren();let i=list.findIndex(s=>s.id===selected);if(i<0)return;let s=list[i];text(box,`#${i+1} · ${s.address}`);if(s.flags?.length)text(box,s.flags.join(' · '),'flag');if(!proposal){const line=document.createElement('div');line.className='line';let input=document.createElement('input');input.type='number';input.min=1;input.max=list.length;input.value=i+1;input.setAttribute('aria-label','New stop number');line.append(input,button('Move',async()=>{let n=Number(input.value);if(!Number.isInteger(n)||n<1||n>list.length){notice('Enter a valid stop number.');return;}r.stops.splice(i,1);r.stops.splice(n-1,0,s);if(!await save()){render();return;}render();notice('Stop moved; all affected numbers updated. Recorded path unchanged.');}));box.append(line);}else text(box,'Preview only. Apply or discard in Build.');}
$('search').oninput=renderStops;$('create').onclick=async()=>{let name=$('newName').value.trim();if(!name){notice('Enter a route name first.');return;}invalidate();let r={id:crypto.randomUUID?.()||String(Date.now()),name,kind:$('kind').value,tracks:[],stops:[],imported:[],gpx:''};library.push(r);active=r.id;$('newName').value='';if(!await save()){render();return;}render();notice('New route created. Import GPX, CSV or both.');};$('rename').onclick=async()=>{let r=current();if(!r)return;let n=prompt('Route name',r.name)?.trim();if(n){r.name=n;if(!await save()){render();return;}render();}};
function importFile(id,fn){$(id).onchange=async()=>{let file=$(id).files[0],r=current();$(id).value='';if(!file)return;try{if(!r)throw Error('Create or select a route first.');let raw=await file.text();if(current()!==r)throw Error('Route changed during import. Please retry.');fn(r,raw);invalidate();if(!await save()){render();return;}render();map.fit();notice('Import complete. Original file data retained.');}catch(e){notice(e.message);}};}
importFile('gpx',(r,raw)=>{let parsed=parseGPX(raw);if(r.gpx&&!confirm('Replace the recorded GPX? Back up the library first if you need the old recording.'))throw Error('Import cancelled.');r.tracks=parsed.tracks;r.gpx=raw;if(!r.stops.length&&parsed.stops.length){r.stops=parsed.stops;r.imported=structuredClone(parsed.stops);}});importFile('csv',(r,raw)=>{let stops=parseCSV(raw);if(!stops.length)throw Error('CSV contains no customer rows.');if(r.stops.length&&!confirm(`Replace ${r.stops.length} existing stops with ${stops.length} CSV stops?`))throw Error('Import cancelled.');r.stops=stops;r.imported=structuredClone(stops);});
$('sequence').onclick=async()=>{let r=current();if(!r?.stops.length){notice('Import customer stops first.');return;}clearProposal();$('sequence').disabled=true;notice('Calculating recorded-pass matches…');await new Promise(resolve=>setTimeout(resolve,30));try{let result=sequence(r.tracks,r.stops,{rightSide:$('right').checked}),byId=new Map(r.stops.map(s=>[s.id,s])),stops=result.matches.map(m=>({...byId.get(m.id),flags:m.flags}));if(current()!==r)throw Error('Route changed during calculation.');proposal={stops,result};let changed=stops.filter((s,i)=>s.id!==r.stops[i].id).length;let box=$('result');box.className='summary';text(box,`${stops.length} stops retained · ${changed} positions changed`);text(box,`${result.flagged} flagged, including ${result.unmatched} without a nearby pass`,'flag');text(box,'Review orange pins before applying. Unmatched stops appear at the end of this proposal; their placement is unknown.');$('accept').disabled=false;$('discard').disabled=false;render();notice('Proposal ready. Original track and saved order unchanged.');}catch(e){notice(e.message);}finally{$('sequence').disabled=!current();}};
$('accept').onclick=async()=>{let r=current();if(!proposal||!r)return;if(proposal.result.flagged&&!confirm(`${proposal.result.flagged} stops need review. Apply this provisional sequence anyway? It is not verified for collection.`))return;r.stops=proposal.stops;clearProposal();if(!await save()){render();return;}render();notice('Proposed order applied. Recorded GPX unchanged.');};$('discard').onclick=()=>{clearProposal();render();notice('Proposal discarded.');};$('original').onclick=async()=>{let r=current();if(!r)return;if(!confirm('Restore the imported customer order?'))return;invalidate();r.stops=structuredClone(r.imported);if(!await save()){render();return;}render();notice('Imported stop order restored.');};
function download(name,content,type){let a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}const safeName=r=>r.name.replace(/[^a-z0-9_-]+/gi,'_');$('exportCSV').onclick=()=>{let r=current();if(r)download(safeName(r)+'_customers.csv',exportCSV(r.stops),'text/csv');};$('exportGPX').onclick=()=>{let r=current();if(r?.gpx)download(safeName(r)+'_original.gpx',r.gpx,'application/gpx+xml');};$('backup').onclick=()=>download('route-builder-3-backup.json',JSON.stringify({format:'RB3-foundation-1',library,active}),'application/json');
// Legacy V24 library backups contain flat Leaflet [lat,lon] points and ordered stops.
// Never read the old account's local storage automatically; use an explicitly selected backup.
function importLegacyLibrary(rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('The old backup has no routes.');
 const kinds={residential:'Residential Side Loader',commercial:'Commercial Front Loader',rolloff:'Roll-Off','roll-off':'Roll-Off',rearloader:'Residential Rear Loader'};
 const result=[];let originals=0,missing=0;
 function coords(p,label){
  const lat=Array.isArray(p)?p[0]:p?.lat,lon=Array.isArray(p)?p[1]:(p?.lon??p?.lng);
  if(!valid(lat,lon))throw Error(label+': invalid or missing coordinates. No routes imported.');
  return {lat,lon};
 }
 function points(raw,label){if(!Array.isArray(raw))throw Error(label+': invalid track. No routes imported.');return raw.map(p=>coords(p,label));}
 const uuid=()=>crypto.randomUUID?.()||('legacy-'+Date.now()+'-'+Math.random().toString(36).slice(2));
 function add(row,name,track,source){
  if(!Array.isArray(row.stops))throw Error(name+': missing stop list. No routes imported.');
  const stops=row.stops.map((s,i)=>{
   const address=typeof s.address==='string'&&s.address.trim()?s.address.trim():('Unnamed stop '+(i+1));
   if(!s.address?.trim?.())missing++;
   return {...coords(s,name+' stop '+(i+1)),id:'c'+(i+1),address,order:i+1,status:typeof s.status==='string'?s.status:'Pending',sourceIndex:i,legacyServiceState:s.serviceState??null,legacyPickupMode:s.pickupMode??null};
  });
  const gpx=track.length?'<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Route Builder 3.0 legacy backup conversion" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>'+track.map(p=>'<trkpt lat="'+p.lat+'" lon="'+p.lon+'"/>').join('')+'</trkseg></trk></gpx>':'';
  result.push({id:uuid(),name,kind:kinds[row.mode]|| (['Residential Side Loader','Residential Rear Loader','Commercial Front Loader','Roll-Off'].includes(row.kind)?row.kind:'Residential Side Loader'),tracks:track.length?[track]:[],stops,imported:structuredClone(stops),gpx,legacySource:source});
 }
 for(const row of rows){
  if(!row||!row.id||typeof row.name!=='string')throw Error('Invalid legacy route record. No routes imported.');
  const track=points(row.points,row.name);
  add(row,row.name,track,'saved path from old backup');
  const root=rows.find(r=>r?.id===(row.rbVersionRoot||row.optimizedFrom))||row;
  const saved=row.rbRecordedPoints||root.rbRecordedPoints||root.rbOriginalSnapshot?.points;
  if(Array.isArray(saved)&&saved.length){
   const original=points(saved,row.name+' recorded track');
   if(original.length!==track.length||original.some((p,i)=>p.lat!==track[i].lat||p.lon!==track[i].lon)){
    add(row,row.name+' — recorded path',original,'recorded path from old backup; current saved customer order');
    originals++;
   }
  }
 }
 return {routes:result,originals,missing};
}
$('restore').onchange=async()=>{let f=$('restore').files[0];$('restore').value='';if(!f)return;try{let b=JSON.parse(await f.text());if(Array.isArray(b)){const converted=importLegacyLibrary(b);const count=converted.routes.reduce((n,r)=>n+r.stops.length,0);if(!confirm('Import '+b.length+' old routes plus '+converted.originals+' separate recorded-path copies ('+count+' total stop entries)? Existing 3.0 routes stay intact. Saved coordinates and stop order are copied; old accounts, history and driver progress are not migrated. GPX files are reconstructed from saved coordinates.'))return;const previous=library,previousActive=active;invalidate();library=[...library,...converted.routes];active=converted.routes[0].id;if(!await save()){library=previous;active=previousActive;render();throw Error('Could not save the imported library in the browser database. Nothing imported. Keep the original backup and check browser storage permissions.');}render();map.fit();notice('Imported '+b.length+' old routes and '+converted.originals+' recorded-path copies.'+(converted.missing?' '+converted.missing+' stop entries have no address.':'')+' Keep your old backup; no account or cloud sync yet.');return;}const check=s=>Array.isArray(s)&&s.every(x=>typeof x.id==='string'&&typeof x.address==='string'&&valid(x.lat,x.lon));if(b.format!=='RB3-foundation-1'||!Array.isArray(b.library)||!b.library.every(r=>typeof r.id==='string'&&typeof r.name==='string'&&typeof r.kind==='string'&&typeof r.gpx==='string'&&check(r.stops)&&check(r.imported)&&Array.isArray(r.tracks)&&r.tracks.every(t=>Array.isArray(t)&&t.every(p=>valid(p.lat,p.lon)))))throw Error('Not a valid Route Builder backup.');if(!confirm('Replace the entire local 3.0 library with this backup?'))return;const previous=library,previousActive=active;invalidate();library=b.library;active=library.some(r=>r.id===b.active)?b.active:library[0]?.id;if(!await save()){library=previous;active=previousActive;render();throw Error('Could not save the restored library in the browser database. Existing library unchanged.');}render();map.fit();notice('Backup restored.');}catch(e){notice(e.message);}};
function scrub(){let r=current(),points=r?.tracks.flat()||[];if(!points.length)return;let i=Math.round(Number($('scrub').value)/1000*(points.length-1));map.replay=points[i];map.draw();} $('scrub').oninput=scrub;$('play').onclick=()=>{if(timer){clearInterval(timer);timer=null;$('play').textContent='Resume replay';return;}if(Number($('scrub').value)>=1000)$('scrub').value=0;$('play').textContent='Pause replay';timer=setInterval(()=>{let n=Math.min(1000,Number($('scrub').value)+2);$('scrub').value=n;scrub();if(n===1000){clearInterval(timer);timer=null;$('play').textContent='Replay recorded path';}},50);};$('plus').onclick=()=>map.zoom(1);$('minus').onclick=()=>map.zoom(-1);$('fit').onclick=()=>map.fit();$('labels').onclick=()=>{map.labels=map.labels==='auto'?'always':map.labels==='always'?'off':'auto';$('labels').textContent='Numbers: '+map.labels;map.draw();};let theme='dark';try{theme=localStorage.getItem(THEME)||'dark';}catch{}function applyTheme(){document.body.classList.toggle('light',theme==='light');$('theme').textContent=theme==='dark'?'☀ Light':'☾ Dark';}applyTheme();$('theme').onclick=()=>{theme=theme==='dark'?'light':'dark';try{localStorage.setItem(THEME,theme);}catch{}applyTheme();};render();if(storageError)notice('Browser database unavailable: '+storageError+' Reload or allow site storage before importing.');setTimeout(()=>map.fit(),100);
