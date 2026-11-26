// Customer management and neighborhood search. No account or cloud data is accessed.
import {valid} from './files.mjs';
export const stateOf=s=>s.serviceState||s.legacyServiceState||'confirmed';
export const isPermanent=s=>stateOf(s)==='confirmed'&&s.permanent===true;
export const normalize=s=>String(s||'').toLowerCase().replace(/\b(street|road|drive|avenue|lane|court|trail|boulevard|place|circle|terrace)\b/g,w=>({street:'st',road:'rd',drive:'dr',avenue:'ave',lane:'ln',court:'ct',trail:'trl',boulevard:'blvd',place:'pl',circle:'cir',terrace:'ter'}[w])).replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function matchesAddress(address,query){const a=normalize(address),q=normalize(query);return !!q&&q.split(' ').every(t=>a.includes(t));}
export function makeStop(p,address,permanent=false){
 if(!valid(p.lat,p.lon)||!String(address||'').trim())throw Error('Enter a valid address and map location.');
 return {id:crypto.randomUUID?.()||('stop-'+Date.now()+'-'+Math.random().toString(36).slice(2)),address:String(address).trim(),lat:p.lat,lon:p.lon,status:'Pending',serviceState:permanent?'confirmed':'candidate',permanent};
}
export const duplicate=(stops,p)=>stops.some(s=>normalize(s.address)===normalize(p.address)&&Math.abs(s.lat-p.lat)<0.00025&&Math.abs(s.lon-p.lon)<0.00025);
export function restoreOrder(stops,imported){
 const byId=new Map(stops.map(s=>[s.id,s]));const result=[];
 for(const old of imported){if(byId.has(old.id)){result.push(byId.get(old.id));byId.delete(old.id);}}
 return result.concat([...byId.values()]);
}
export async function searchGIS(bounds,query,signal){
 const [west,south,east,north]=bounds;
 if(east-west>.045||north-south>.045)throw Error('Zoom closer to the neighborhood before searching online.');
 const result=[],seen=new Set();let limited=false;
 for(let offset=0;offset<1000;offset+=200){
  const params=new URLSearchParams({f:'json',where:'1=1',geometry:JSON.stringify({xmin:west,ymin:south,xmax:east,ymax:north,spatialReference:{wkid:4326}}),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outSR:'4326',outFields:'adr_num,adr_num_comp,pstr_fulnam,pre_dir,pstr_nam,pstr_type,psuf_dir,adr_unit_typ,adr_unit_id',returnGeometry:'true',resultOffset:String(offset),resultRecordCount:'200'});
  const r=await fetch('https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Location/FeatureServer/14/query?'+params,{signal});
  if(!r.ok)throw Error('Arkansas GIS returned HTTP '+r.status);
  const j=await r.json();if(j.error||!Array.isArray(j.features))throw Error(j.error?.message||'Invalid GIS response');
  for(const f of j.features){const a=f.attributes||{},lat=f.geometry?.y,lon=f.geometry?.x;const number=String(a.adr_num_comp||a.adr_num||'').trim(),street=String(a.pstr_fulnam||[a.pre_dir,a.pstr_nam,a.pstr_type,a.psuf_dir].filter(Boolean).join(' ')).trim(),address=[number,street,a.adr_unit_typ,a.adr_unit_id].filter(Boolean).join(' ');
   if(!number||!street||!valid(lat,lon)||!matchesAddress(address,query))continue;
   const k=normalize(address)+':'+lat.toFixed(5)+':'+lon.toFixed(5);if(seen.has(k))continue;seen.add(k);result.push({address,lat,lon});
  }
  if(j.features.length<200&&!j.exceededTransferLimit)return {items:result,limited:false};
  if(!j.features.length)break;limited=true;
 }
 return {items:result,limited};
}
