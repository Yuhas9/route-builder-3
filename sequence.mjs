// Pure geometry; never creates or edits driving paths.
export const distance=(a,b)=>{const k=Math.PI/180,p=a.lat*k,q=b.lat*k,d=(b.lon-a.lon)*k;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin((q-p)/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(d/2)**2)))};
export const streetOf=a=>a.toLowerCase().split(',')[0].replace(/^\s*\d+[a-z]?\s+/, '').replace(/\b(street|road|drive|avenue|lane|court|trail|boulevard|place|circle|terrace)\b/g,x=>({street:'st',road:'rd',drive:'dr',avenue:'ave',lane:'ln',court:'ct',trail:'trl',boulevard:'blvd',place:'pl',circle:'cir',terrace:'ter'}[x])).replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
export function sequence(tracks,stops,{rightSide=true,maxDistance=75}={}){
 const anchor=tracks.flat()[0]; if(!anchor||!tracks.some(t=>t.length>1)) throw Error('Import a recorded GPX track first.');
 const c=Math.cos(anchor.lat*Math.PI/180),xy=p=>[(p.lon-anchor.lon)*111195*c,(p.lat-anchor.lat)*111195];
 const segs=[];let progress=0;
 for(const t of tracks){for(let i=1;i<t.length;i++){let a=xy(t[i-1]),b=xy(t[i]),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<.25)continue;segs.push({a,dx,dy,len,progress,heading:Math.atan2(dy,dx),index:segs.length});progress+=len;}}
 const groups=new Map();for(const s of stops){let key=streetOf(s.address||'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push({...s,xy:xy(s),number:parseInt(s.address)});}
 const results=[];
 for(const group of groups.values())for(const s of group){
 const near=group.filter(p=>p.id!==s.id&&Number.isFinite(s.number)&&p.number%2===s.number%2).map(p=>({p,d:Math.hypot(p.xy[0]-s.xy[0],p.xy[1]-s.xy[1])})).filter(p=>p.d>8&&p.d<120).sort((a,b)=>a.d-b.d).slice(0,4);
 // Street orientation inferred from nearby same-parity addresses, not verified road names.
 let ax=0,ay=0;for(const {p,d} of near){let a=Math.atan2(p.xy[1]-s.xy[1],p.xy[0]-s.xy[0]);ax+=Math.cos(2*a)/d;ay+=Math.sin(2*a)/d;}let axis=Math.atan2(ay,ax)/2,axisKnown=near.length>0&&Math.hypot(ax,ay)/near.reduce((v,p)=>v+1/p.d,0)>.72;
 let cand=[];for(const g of segs){const vx=s.xy[0]-g.a[0],vy=s.xy[1]-g.a[1],raw=(vx*g.dx+vy*g.dy)/(g.len*g.len),t=Math.max(0,Math.min(1,raw)),d=Math.hypot(vx-t*g.dx,vy-t*g.dy);if(d>maxDistance)continue;const side=(g.dx*vy-g.dy*vx)/g.len,alignment=axisKnown?Math.abs(Math.cos(axis-g.heading)):1;let score=d+(rightSide&&side>2?55:0)+(axisKnown?36*(1-alignment):0)+(raw<0||raw>1?8:0);cand.push({d,side,alignment,score,at:g.progress+t*g.len,heading:g.heading,point:{lat:anchor.lat+(g.a[1]+t*g.dy)/111195,lon:anchor.lon+(g.a[0]+t*g.dx)/(111195*c)}});}
 cand.sort((a,b)=>a.score-b.score||a.at-b.at);let best=cand[0];let flags=[];
 if(!best){results.push({id:s.id,at:null,flags:['No nearby recorded pass']});continue;}
 if(rightSide&&best.side>2)flags.push('Opposite collection side');if(best.d>45)flags.push('Far from recorded road');if(axisKnown&&best.alignment<.72)flags.push('Possible cross-street match');if(!axisKnown)flags.push('Street direction unverified');
 const alternative=cand.find(a=>Math.abs(a.at-best.at)>100&&a.score-best.score<9);if(alternative)flags.push('Multiple plausible passes');
 results.push({id:s.id,at:best.at,d:best.d,side:best.side,point:best.point,flags});
 }
 results.sort((a,b)=>(a.at??Infinity)-(b.at??Infinity));return {matches:results,length:progress,unmatched:results.filter(x=>x.at===null).length,flagged:results.filter(x=>x.flags.length).length};
}
