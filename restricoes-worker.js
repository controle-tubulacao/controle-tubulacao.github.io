const C={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400'},K='lista';
const J=(o,s)=>new Response(JSON.stringify(o),{status:s||200,headers:{...C,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const t=v=>typeof v==='string'?v.slice(0,600):null;
export default{async fetch(q,e){
if(q.method==='OPTIONS')return new Response(null,{headers:C});
if(!new URL(q.url).pathname.startsWith('/r'))return J({ok:true,servico:'restricoes'});
const L=async()=>{try{return JSON.parse(await e.RESTR.get(K)||'[]')}catch(x){return[]}};
if(q.method==='GET')return J({items:await L()});
if(q.method==='POST'){let r;try{r=await q.json()}catch(x){return J({erro:'json invalido'},400)}
if(!r||!r.id||!r.nm)return J({erro:'faltou id ou descricao'},400);
const c={id:t(r.id),tp:r.tp==='a'?'a':'r',nm:t(r.nm),re:t(r.re),pz:t(r.pz),ds:t(r.ds),ar:t(r.ar),sis:t(r.sis),ln:t(r.ln),dis:t(r.dis),esc:r.esc==='peca'?'peca':'linha',nv:Number.isFinite(r.nv)?r.nv|0:null,pc:Number.isFinite(r.pc)?Math.max(0,Math.min(100,r.pc|0)):null,el:Number.isFinite(r.el)?r.el|0:null,xyz:Array.isArray(r.xyz)?r.xyz.slice(0,3).map(Number):null,st:r.st==='ok'?'ok':'ab',quem:t(r.quem),em:t(r.em),fim:t(r.fim)};
const l=await L(),i=l.findIndex(z=>z.id===c.id);
if(i<0)l.push(c);else if(l[i].em===c.em&&l[i].quem===c.quem)l[i]=c;else{const p=(c.id||'R')[0];let n=0;for(const z of l){const m=new RegExp('^'+p+'-(\\d+)$').exec(z.id||'');if(m)n=Math.max(n,+m[1])}c.id=p+'-'+String(n+1).padStart(3,'0');l.push(c)}
if(l.length>5000)l.splice(0,l.length-5000);
await e.RESTR.put(K,JSON.stringify(l));return J({ok:true,id:c.id,n:l.length})}
return J({erro:'metodo nao suportado'},405)}};
