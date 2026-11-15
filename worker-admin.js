const OWNER="wheretobuylinks",REPO="wheretobuy-web",BRANCH="main",FILE="posts.json",ALLOWED_ORIGIN="https://wheretobuy-web.pages.dev";
export default {async fetch(request,env){
 const cors={"Access-Control-Allow-Origin":ALLOWED_ORIGIN,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
 if(request.method==="OPTIONS")return new Response(null,{headers:cors});
 if(request.headers.get("Origin")!==ALLOWED_ORIGIN)return new Response("Origin not allowed",{status:403,headers:cors});
 if(request.method!=="POST")return new Response("Use POST",{status:405,headers:cors});
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
 try{
 const body=await request.json();if(!env.ADMIN_PASSWORD||body.password!==env.ADMIN_PASSWORD)return json({error:"Clave incorrecta"},401);
 const api=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`,headers={Authorization:`Bearer ${env.GITHUB_TOKEN}`,"X-GitHub-Api-Version":"2022-11-28",Accept:"application/vnd.github+json","Content-Type":"application/json","User-Agent":"WhereToBuyAdmin"};
 const get=await fetch(api+`?ref=${BRANCH}`,{headers});if(!get.ok)return json({error:"No se pudo leer posts.json en GitHub."},502);
 const current=await get.json();let posts;try{const b=atob(current.content.replace(/\s/g,""));posts=JSON.parse(new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0))))}catch{return json({error:"No se pudo interpretar posts.json."},502)}
 const write=async(next,msg)=>{const content=btoa(unescape(encodeURIComponent(JSON.stringify(next,null,2))));const put=await fetch(api,{method:"PUT",headers,body:JSON.stringify({message:msg,content,branch:BRANCH,sha:current.sha})});if(!put.ok)return json({error:"GitHub no pudo guardar. Revisá permisos del token."},502);return json({ok:true,message:msg})};
 if(body.action==="list")return json({ok:true,posts});
 if(body.action==="delete"){if(!body.id)return json({error:"Falta el ID de publicación."},400);const next=posts.filter(p=>p.id!==body.id);if(next.length===posts.length)return json({error:"Publicación no encontrada."},404);return write(next,"Eliminar publicación desde panel")}
 if(body.action!=="save")return json({error:"Acción no reconocida."},400);
 const p=body.post||{},id=p.id||crypto.randomUUID();
 const post={id,type:String(p.type||"article").slice(0,30),category:String(p.category||"General").slice(0,60),title:String(p.title||"").trim().slice(0,180),subtitle:String(p.subtitle||"").trim().slice(0,240),excerpt:String(p.excerpt||"").trim().slice(0,400),coverImage:safeUrl(p.coverImage),body:String(p.body||"").slice(0,20000),sections:Array.isArray(p.sections)?p.sections.slice(0,20).map(s=>({heading:String(s.heading||"").slice(0,120),text:String(s.text||"").slice(0,4000),image:safeUrl(s.image)})):[],videoUrl:safeUrl(p.videoUrl),socialUrl:safeUrl(p.socialUrl),tags:Array.isArray(p.tags)?p.tags.slice(0,12).map(x=>String(x).slice(0,35)):[],product:p.product&&typeof p.product==="object"?{name:String(p.product.name||"").slice(0,160),price:String(p.product.price||"").slice(0,80),details:String(p.product.details||"").slice(0,2000),links:Array.isArray(p.product.links)?p.product.links.slice(0,12).map(l=>({label:String(l.label||"Comprar").slice(0,80),url:safeUrl(l.url)})).filter(l=>l.url):[]}:null,createdAt:p.createdAt||new Date().toISOString()};
 if(!post.title)return json({error:"El título es obligatorio."},400);if((p.coverImage&&!post.coverImage)||(p.videoUrl&&!post.videoUrl)||(p.socialUrl&&!post.socialUrl))return json({error:"Los enlaces deben ser URL https válidas."},400);
 const idx=posts.findIndex(x=>x.id===id);if(idx>=0){post.createdAt=posts[idx].createdAt||post.createdAt;posts[idx]=post}else posts.unshift(post);
 return write(posts,idx>=0?"Actualizar publicación desde panel":"Crear publicación desde panel");
 }catch{return json({error:"Error inesperado al guardar."},500)}
}};
function safeUrl(v){if(!v)return "";try{const u=new URL(String(v));return u.protocol==="https:"?u.href:""}catch{return ""}}