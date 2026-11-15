(function(){
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nz=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let MEDS=[],EXN=[];const MBYID={};
const api=async(u,o)=>{const r=await fetch('/api/'+u,o&&{method:o.method,headers:{'Content-Type':'application/json'},body:JSON.stringify(o.body)});if(!r.ok)throw new Error(u+' '+r.status);return r.json()};
let catTmr=null;
async function loadCatalog(){
 try{const d=await api('catalog');MEDS=d.meds;MEDS.forEach(m=>{m._n=nz(m.n+' '+m.g+' '+m.b);MBYID[m.i]=m});EXN=d.exams.map(e=>({e,n:nz(e)}));
  $('#catInfo').textContent=MEDS.length+' medicamentos · '+EXN.length+' exames (base ao vivo)';
  rows.forEach(r=>{if(r.id&&!r.manual)recalc(r)});if(type==='base')drawBase();
 }catch(e){$('#catInfo').textContent='Sem conexão com a base — '+e.message}
}
let type='simple',mode='items',rows=[],lastAct=null;
const today=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())};
const brDate=v=>{if(!v)return'';const[p,m,d]=v.split('-');return d+'/'+m+'/'+p};
$('#date').value=today();

/* ---------- cálculo pediátrico (portado do ISLS) ---------- */
function limparTpl(t){return String(t||'').replace(/\s*\(\s*[^)]*dose[^)]*\)/gi,'').replace(/dose\s+por\s+kg[^.]*\./gi,'').replace(/dose\s+m[áa]xima[^.]*\./gi,'').replace(/\s+/g,' ').replace(/\s*\.\s*\./g,'.').trim()}
function calcF(f,peso,anos,meses){
 if(f.type==='fixed')return{ok:true,valor:''};
 if(f.type==='per_kg'){
  if(!peso||peso<=0)return{ok:false,erro:'Informe o peso (kg) para calcular a dose pediátrica.'};
  let d=Number(f.dosePerKg)*peso;if(!isFinite(d))return{ok:false,erro:'Dose por kg inválida na base.'};
  let lim=false;if(f.maxDose!=null&&Number(f.maxDose)>0&&d>Number(f.maxDose)){d=Number(f.maxDose);lim=true}
  if(f.round==='inteiro')d=Math.round(d);else if(f.round==='uma_casa')d=Math.round(d*10)/10;else d=Math.round(d*100)/100;
  return{ok:true,valor:String(d).replace('.',','),limitado:lim};
 }
 if(f.type==='per_age'){
  const y=Number(anos)||0,m=Number(meses)||0,arr=y>0?(f.doseByYear||[]):(f.doseByMonth||[]);
  if(!arr.length)return{ok:false,erro:'Faixa etária não estruturada para este item.'};
  const i=y>0?Math.min(arr.length-1,Math.max(0,y-1)):Math.min(arr.length-1,Math.max(0,m));const v=arr[i];
  if(v==null||v===0)return{ok:false,erro:'Sem dose de referência para esta idade — prescrever manualmente.'};
  return{ok:true,valor:String(v).replace('.',',')};
 }
 return{ok:false,erro:'Tipo de fórmula desconhecido.'};
}
const ctx=()=>({peso:parseFloat(String($('#peso').value).replace(',','.')),anos:$('#anos').value,meses:$('#meses').value});
function recalc(r){
 r.erro=false;r.cap=false;
 const m=r.id&&MBYID[r.id];if(!m)return;
 if(m.t==='p'){
  const f=m.f[r.fi||0];if(!f){r.sig='[Item sem fórmula de cálculo — prescrever manualmente]';r.erro=true;return}
  const c=ctx(),x=calcF(f,c.peso,c.anos,c.meses);
  if(!x.ok){r.sig='['+x.erro+']';r.erro=true;return}
  let t=limparTpl((f.template||'').replace(/\.\.\./g,x.valor));
  if(x.limitado){t+=' [dose limitada ao máximo seguro]';r.cap=true}
  r.sig=t;
 }else if(m.o&&m.o.length){r.sig=m.o[r.pi||0]||m.p||''}
}
function recalcAll(){rows.forEach(r=>{if(!r.manual)recalc(r)})}

/* ---------- alertas (não bloqueiam) ---------- */
const CL=[['penicilinas','penicilina benzilpenicilina benzatina amoxicilina amoxi ampicilina oxacilina piperacilina clavulanato clavulin tazobactam'],['cefalosporinas','cefalosporina cefalexina cefadroxila cefazolina cefalotina cefuroxima ceftriaxona cefotaxima ceftazidima cefepima'],['sulfas','sulfa sulfametoxazol trimetoprima bactrim sulfadiazina'],['AINEs','aine ibuprofeno diclofenaco cetoprofeno naproxeno nimesulida meloxicam tenoxicam piroxicam cetorolaco aas aspirina acetilsalicilico'],['dipirona','dipirona metamizol novalgina'],['paracetamol','paracetamol acetaminofeno'],['quinolonas','quinolona ciprofloxacino levofloxacino norfloxacino moxifloxacino'],['macrolideos','macrolideo azitromicina claritromicina eritromicina'],['opioides','opioide morfina tramadol codeina fentanil oxicodona metadona'],['vancomicina','vancomicina'],['metronidazol','metronidazol'],['clindamicina','clindamicina'],['anticonvulsivantes aromaticos','fenitoina carbamazepina fenobarbital lamotrigina'],['contraste iodado','contraste iodado'],['latex','latex']].map(([c,t])=>({c,t:t.split(' ')}));
function classes(s){const t=' '+nz(s)+' ';return CL.filter(x=>x.t.some(k=>t.indexOf(k)!==-1)).map(x=>x.c)}
function pesoMsg(p,a,m){
 if(!p||p<=0)return'';if(p>350||p<0.4)return'Peso '+p+' kg implausível — verifique a digitação.';
 const ha=String(a).trim()!=='',hm=String(m).trim()!=='';if(!ha&&!hm)return'';
 const y=parseInt(a,10)||0,mm=parseInt(m,10)||0,t=y*12+mm;let est=null;
 if(t<=0){return(p<1||p>7)?'Peso '+p+' kg incomum para recém-nascido — confirme peso e idade.':''}
 if(t<12)est=(t+9)/2;else if(t<=72)est=2*(t/12)+8;else if(t<=144)est=(7*(t/12)-5)/2;else return'';
 if(p<est*.5||p>est*2)return'Peso '+p+' kg incomum para '+(y?y+' ano(s)'+(mm?' e '+mm+' mês(es)':''):mm+' mês(es)')+' (estimativa usual ≈ '+(Math.round(est*10)/10)+' kg). Confirme peso e idade — erro de vírgula é comum.';
 return'';
}
function alerts(){
 const out=[],c=ctx(),pm=pesoMsg(c.peso,c.anos,c.meses);if(pm)out.push(pm);
 const al=$('#alergias').value.trim();
 if(al&&(type==='simple'||type==='control')){
  const ca=classes(al),txt=mode==='free'?$('#rxFree').value:rows.map(r=>r.name+' '+r.sig).join('\n');
  const lines=mode==='free'?txt.split('\n'):rows.map(r=>r.name+' '+r.sig);
  lines.forEach(l=>{if(!l.trim())return;classes(l).forEach(k=>{
   if(ca.includes(k))out.push('ALERGIA ('+al+'): "'+l.trim().slice(0,60)+'" → '+k);
   else if((k==='penicilinas'&&ca.includes('cefalosporinas'))||(k==='cefalosporinas'&&ca.includes('penicilinas')))out.push('Possível reatividade cruzada: "'+l.trim().slice(0,60)+'" → '+k)})});
 }
 const b=$('#alertBox');b.hidden=!out.length;b.textContent=out.join('\n');
 return out;
}

/* ---------- busca ---------- */
function search(list,q,get,lim){
 const t=nz(q).split(' ').filter(Boolean);if(!t.length)return[];const res=[];
 for(const x of list){const n=get(x);if(t.every(k=>n.indexOf(k)!==-1)){res.push([n.startsWith(t[0])?0:1,n.length,x]);}}
 res.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);return res.slice(0,lim).map(r=>r[2]);
}
function bindSearch(inp,box,find,render,pick){
 let cur=[],sel=-1;
 const upd=()=>{cur=find(inp.value);sel=-1;box.innerHTML=cur.map((x,i)=>'<div data-i="'+i+'">'+render(x)+'</div>').join('');box.classList.toggle('show',cur.length>0)};
 inp.addEventListener('input',upd);inp.addEventListener('focus',()=>{if(inp.value)upd()});
 inp.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,Math.min(cur.length-1,sel+(e.key==='ArrowDown'?1:-1)));[...box.children].forEach((c,i)=>c.classList.toggle('sel',i===sel));if(box.children[sel])box.children[sel].scrollIntoView({block:'nearest'})}
  else if(e.key==='Enter'){e.preventDefault();const x=cur[sel>=0?sel:0];if(x){pick(x);inp.value='';box.classList.remove('show')}}
  else if(e.key==='Escape')box.classList.remove('show');
 });
 box.addEventListener('mousedown',e=>{const d=e.target.closest('[data-i]');if(!d)return;e.preventDefault();pick(cur[+d.dataset.i]);inp.value='';box.classList.remove('show');inp.focus()});
 inp.addEventListener('blur',()=>setTimeout(()=>box.classList.remove('show'),150));
}
bindSearch($('#medBusca'),$('#medRes'),q=>search(MEDS,q,m=>m._n,40),m=>'<span>'+esc(m.n)+'</span>'+(m.t==='p'?'<span class="tag p">Pediátrico</span>':'')+'<small>'+esc(m.s)+'</small>',m=>addMed(m));
bindSearch($('#exBusca'),$('#exRes'),q=>search(EXN,q,x=>x.n,40),x=>esc(x.e),x=>{const t=$('#exams');t.value=(t.value.trim()?t.value.replace(/\n*$/,'\n'):'')+x.e;render()});

/* ---------- linhas de medicamento ---------- */
function addMed(m){
 const r={id:m.i,name:m.n,qty:m.q||'',sig:'',fi:0,pi:0,manual:false};
 if(m.t==='a'&&!(m.o&&m.o.length))r.sig=m.p||'';
 rows.push(r);recalc(r);drawRows();render();
}
function drawRows(){
 const L=$('#rxList');L.innerHTML='';
 rows.forEach((r,i)=>{
  const m=r.id&&MBYID[r.id],d=document.createElement('div');d.className='rx-editor';
  let sel='';
  if(m&&m.t==='p'&&m.f.length>1)sel='<select class="ind">'+m.f.map((f,k)=>'<option value="'+k+'"'+(k===(r.fi||0)?' selected':'')+'>'+esc((f.indication||'').split('(')[0].trim()||('Indicação '+(k+1)))+'</option>').join('')+'</select>';
  else if(m&&m.t==='a'&&m.o&&m.o.length>1)sel='<select class="ind">'+m.o.map((o,k)=>'<option value="'+k+'"'+(k===(r.pi||0)?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';
  d.innerHTML='<div class="rx-top"><strong>'+(i+1)+'. '+(m&&m.t==='p'?'Pediátrico (calculado)':'Medicamento')+'</strong><button type="button" class="icon-btn rm">Remover</button></div><div class="rx-grid"><input class="nm" placeholder="Medicamento / apresentação" value="'+esc(r.name)+'"><input class="qt" placeholder="Quantidade" value="'+esc(r.qty)+'"></div>'+sel+'<textarea class="sg" placeholder="Posologia">'+esc(r.sig)+'</textarea>';
  const sg=d.querySelector('.sg');sg.classList.toggle('calc-erro',!!r.erro);sg.classList.toggle('calc-capped',!!r.cap);
  d.querySelector('.rm').onclick=()=>{rows.splice(i,1);drawRows();render()};
  d.querySelector('.nm').oninput=e=>{r.name=e.target.value;render()};
  d.querySelector('.qt').oninput=e=>{r.qty=e.target.value;render()};
  sg.oninput=e=>{r.sig=e.target.value;r.manual=true;r.erro=false;r.cap=false;sg.classList.remove('calc-erro','calc-capped');render()};
  const s=d.querySelector('.ind');if(s)s.onchange=e=>{if(m.t==='p')r.fi=+e.target.value;else r.pi=+e.target.value;r.manual=false;recalc(r);drawRows();render()};
  L.appendChild(d);
 });
}
$('#addBlank').onclick=()=>{rows.push({name:'',qty:'',sig:'',manual:true});drawRows();render()};
$('#modeItems').onclick=()=>setMode('items');$('#modeFree').onclick=()=>setMode('free');
function setMode(m){mode=m;$('#modeItems').classList.toggle('on',m==='items');$('#modeFree').classList.toggle('on',m==='free');$('#rxItensWrap').hidden=m!=='items';$('#rxFreeWrap').hidden=m!=='free';render()}

/* ---------- atestado ---------- */
const MOD={afastamento:d=>'Atesto, para os devidos fins, que o(a) paciente necessita de afastamento de suas atividades por '+(d||'___')+' dia(s) a partir desta data, por motivo de saúde.',comparecimento:()=>'Atesto, para os devidos fins, que o(a) paciente compareceu a esta unidade de saúde nesta data para atendimento médico.',acompanhante:()=>'Atesto, para os devidos fins, que o(a) Sr(a). ___________________ acompanhou o(a) paciente em atendimento nesta unidade de saúde nesta data.',aptidao:()=>'Atesto, para os devidos fins, que o(a) paciente encontra-se apto(a), do ponto de vista clínico, para a atividade a que se destina.'};
$('#certModelo').onchange=e=>{const f=MOD[e.target.value];if(f){$('#certText').value=f($('#certDias').value);render()}};
$('#certDias').oninput=()=>{if($('#certModelo').value==='afastamento')$('#certText').value=MOD.afastamento($('#certDias').value);render()};

/* ---------- páginas ---------- */
const patientBlock=()=>{const p=$('#patient').value.trim(),d=brDate($('#date').value);return(p||d)?'<div class="prow">'+(p?'<div class="patient">PACIENTE: '+esc(p)+'</div>':'')+(d?'<div class="date"><b>Data:</b> '+d+'</div>':'')+'</div>':''};
const dateHtml=()=>'';
const titleHtml=t=>'<div class="doc-title">'+t+'</div>';
const REG='<div class="registry"><section><h3>Dados do comprador</h3>'+['Nome:','Identidade:','Órgão expedidor:','Endereço:','Cidade / UF:','Telefone:','Data:','Assinatura:'].map(x=>'<div class="rl"><span>'+x+'</span><i></i></div>').join('')+'</section><section><h3>Dados do fornecedor (farmácia)</h3>'+['Nome fantasia:','CNPJ:','Endereço:','Cidade / UF:','Telefone:','Data:','Assinatura do farmacêutico:','CRF:'].map(x=>'<div class="rl"><span>'+x+'</span><i></i></div>').join('')+'</section></div>';
const FOOT='<footer class="pfoot"><div class="fcont"><span><b>Telefone</b>(43) 99182-9535</span><span><b>E-mail</b>rodolfo@rtturini.com</span><span><b>Endereço</b>Rua Jandaia, 42<br>Ivaiporã - PR, CEP 86870-265</span></div><div class="fmotto">Ad scientiam per caritatem</div></footer>';

function docModel(){
 if(type==='simple'||type==='control'){
  let items;
  if(mode==='free')items=$('#rxFree').value.split('\n').map(l=>'<div class="free-line">'+(esc(l)||'&nbsp;')+'</div>');
  else{let n=0;items=rows.filter(r=>r.name.trim()||r.qty.trim()||r.sig.trim()).map(r=>{n++;return'<div class="rx-item"><div class="rx-line"><span class="rx-number">'+n+'.</span><span>'+esc(r.name)+(r.qty.trim()?' — '+esc(r.qty):'')+'</span></div>'+(r.sig.trim()?'<div class="rx-sig">'+esc(r.sig)+'</div>':'')+'</div>'})}
  return{area:type==='control'?'control-area':'simple-area',head:titleHtml('PRESCRIÇÃO MÉDICA')+patientBlock(),items,foot:dateHtml(),ctl:type==='control'};
 }
 if(type==='exams'){
  const lines=$('#exams').value.split(/\n+/).map(x=>x.trim()).filter(Boolean),obs=$('#examObs').value.trim();
  const items=lines.map((x,i)=>'<div class="exam-item">'+(i+1)+'. '+esc(x)+'</div>');
  if(obs)items.push('<div class="exam-obs"><strong>Indicação clínica / observações:</strong><br>'+esc(obs).replace(/\n/g,'<br>')+'</div>');
  return{area:'simple-area',head:titleHtml('PEDIDO DE EXAMES')+patientBlock(),items,foot:dateHtml()};
 }
 if(type==='certificate'){
  const t=$('#certText').value.trim(),c=$('#certCid').value.trim();
  return{area:'simple-area',head:titleHtml('ATESTADO MÉDICO')+patientBlock(),items:t?['<div class="cert-text">'+esc(t)+'</div>']:[],foot:(c?'<div class="cid">CID: '+esc(c)+'</div>':'')+dateHtml(),cert:true};
 }
 return null;
}
function pageEl(m,items,v,extra){
 const ctl=v!=='s',lab=v==='c1'?'1ª VIA – FARMÁCIA':v==='c2'?'2ª VIA – PACIENTE':'';
 return'<section class="page'+(ctl?' special':'')+'" '+(extra||'')+'><img class="lh" alt="" src="'+LH+'">'+(lab?'<div class="copy-label">'+lab+'</div>':'')+'<div class="overlay '+m.area+'">'+m.head+'<div class="body">'+items.join('')+'</div>'+m.foot+'</div><div class="sig"><span>Assinatura e carimbo</span></div>'+(ctl?REG:'')+FOOT+'</section>';
}
const over=b=>b.scrollHeight>b.clientHeight+1||b.scrollWidth>b.clientWidth+1;
function fit(pg){
 pg.classList.remove('overflow');const b=pg.querySelector('.body');if(!b)return true;
 b.style.fontSize='';b.querySelectorAll('.rx-line,.rx-sig').forEach(x=>x.style.fontSize='');
 let s=10.7,g=0;
 while(over(b)&&s>8.8&&g++<16){s-=.2;b.style.fontSize=s+'pt';b.querySelectorAll('.rx-line').forEach(x=>x.style.fontSize=(s+.35)+'pt');b.querySelectorAll('.rx-sig').forEach(x=>x.style.fontSize=Math.max(8.6,s-.15)+'pt')}
 if(over(b)){pg.classList.add('overflow');return false}return true;
}
function groups(m){
 const M=$('#measure'),V=m.ctl?'c1':'s';
 const test=its=>{M.innerHTML=pageEl(m,its,V);const ok=fit(M.firstChild);return ok};
 if(!m.items.length||test(m.items))return[m.items];
 if(m.cert)return[m.items];
 // paginação: preenchimento sequencial com fonte padrão (10,0 pt)
 const out=[];let cur=[];
 M.innerHTML=pageEl(m,[],V);const body=()=>M.querySelector('.body');body().style.fontSize='10pt';
 for(const it of m.items){
  body().insertAdjacentHTML('beforeend',it);
  if(over(body())&&cur.length){body().lastElementChild.remove();out.push(cur);cur=[];M.innerHTML=pageEl(m,[],V);body().style.fontSize='10pt';body().insertAdjacentHTML('beforeend',it)}
  cur.push(it);
 }
 if(cur.length)out.push(cur);M.innerHTML='';return out;
}
function build(){
 const m=docModel();if(!m)return{html:'',n:0};
 const gs=groups(m);let html='';
 gs.forEach((g,k)=>{
  const f=m.foot,pgTxt=gs.length>1?'':'';
  if(m.ctl){html+=pageEl(m,g,'c1','data-copy="1"')+pageEl(m,g,'c2','data-copy="2"')}
  else html+=pageEl(m,g,'s');
 });
 return{html,n:(m.ctl?gs.length*2:gs.length),groups:gs.length};
}

/* ---------- render / status ---------- */
let tmr=null;
function render(){
 if(type==='models'||type==='history'||type==='base'){$('#preview').innerHTML='';$('#pgInfo').textContent='';return}
 const b=build(),p=$('#preview');p.innerHTML=b.html;
 requestAnimationFrame(()=>{
  let ok=true;p.querySelectorAll('.page').forEach(pg=>{if(!fit(pg))ok=false});
  const al=alerts();
  const s=$('#status'),nErr=rows.filter(r=>r.erro).length;
  let t=type==='control'?'Controle especial: '+b.n+' página(s) A4 — cada folha impressa como 1ª VIA – FARMÁCIA seguida da 2ª VIA – PACIENTE.':b.n+' página(s) A4.';
  if(b.groups>1)t+=' Conteúdo dividido automaticamente em '+b.groups+' folhas.';
  if(!ok)t+=' ATENÇÃO: um item isolado excede a área útil; reduza o texto.';
  if(nErr)t+=' ATENÇÃO: '+nErr+' item(ns) pediátrico(s) sem dose calculada (verifique peso/idade).';
  s.textContent=t;s.className='status'+((!ok||nErr)?' warn':'');
  $('#pgInfo').textContent=b.n+' pág. · A4 retrato · 210 × 297 mm';
  saveDraft();
 });
}
function setType(t){
 type=t;$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.type===t));
 $('#rxForm').hidden=!(t==='simple'||t==='control');$('#exForm').hidden=t!=='exams';$('#certForm').hidden=t!=='certificate';
 $('#modelsForm').hidden=t!=='models';$('#baseForm').hidden=t!=='base';$('#histForm').hidden=t!=='history';
 $('#mainActions').hidden=(t==='models'||t==='history'||t==='base');$('#common').hidden=false;
 if(t==='models')drawModels();if(t==='base')drawBase();if(t==='history')drawHist();render();
}
$$('.tab').forEach(b=>b.onclick=()=>setType(b.dataset.type));
['patient','date','rxFree','exams','examObs','certText','certCid','alergias'].forEach(id=>$('#'+id).addEventListener('input',render));
['peso','anos','meses'].forEach(id=>$('#'+id).addEventListener('input',()=>{recalcAll();drawRows();render()}));

/* ---------- estado, modelos, histórico ---------- */
const snap=()=>({type,mode,patient:$('#patient').value,date:$('#date').value,peso:$('#peso').value,anos:$('#anos').value,meses:$('#meses').value,alergias:$('#alergias').value,rows:rows.map(r=>({...r})),rxFree:$('#rxFree').value,exams:$('#exams').value,examObs:$('#examObs').value,certModelo:$('#certModelo').value,certDias:$('#certDias').value,certText:$('#certText').value,certCid:$('#certCid').value});
function load(s,keepType){
 ['patient','date','peso','anos','meses','alergias','rxFree','exams','examObs','certDias','certText','certCid'].forEach(k=>{if(s[k]!=null)$('#'+k).value=s[k]});
 $('#certModelo').value=s.certModelo||'';rows=(s.rows||[]).map(r=>({...r}));setMode(s.mode||'items');drawRows();setType(keepType?type:(s.type||'simple'));
}
function saveDraft(){clearTimeout(tmr);tmr=setTimeout(()=>LS.set('rgt_draft',snap()),400)}
function drawModels(){
 api('models').then(d=>drawModelsFrom(d.models)).catch(()=>{});}
function drawModelsFrom(ms){const L=$('#modelList');L.innerHTML='';const ks=Object.keys(ms);
 if(!ks.length)L.innerHTML='<div style="cursor:default">Nenhum modelo salvo.</div>';
 ks.forEach(k=>{const d=document.createElement('div');d.innerHTML='<strong>'+esc(k)+'</strong> · '+ms[k].length+' item(ns) <button class="icon-btn" style="float:right">Excluir</button>';
  d.onclick=e=>{if(e.target.tagName==='BUTTON'){api('models',{method:'DELETE',body:{nome:k}}).then(drawModels);return}rows=ms[k].map(r=>({...r}));recalcAll();drawRows();setMode('items');setType('simple')};L.appendChild(d)});
}
$('#saveModel').onclick=()=>{const n=$('#modelNome').value.trim();if(!n||!rows.length){$('#status').textContent='Informe um nome e adicione itens à receita antes de salvar o modelo.';$('#status').className='status warn';return}
 api('models',{method:'POST',body:{nome:n,itens:rows.map(r=>({...r,manual:r.id?false:true}))}}).then(()=>{drawModels()});$('#modelNome').value='';$('#status').textContent='Modelo "'+n+'" salvo neste navegador. Itens pediátricos são recalculados pelo peso/idade do paciente.';$('#status').className='status'};
function drawHist(){
 api('history').then(d=>drawHistFrom(d.history.map(x=>({at:new Date(x.em).toLocaleString('pt-BR'),s:x.doc})))).catch(()=>{});}
function drawHistFrom(h){const L=$('#histList');L.innerHTML='';if(!h.length)L.innerHTML='<div style="cursor:default">Nenhum documento impresso ainda.</div>';
 h.forEach(x=>{const d=document.createElement('div');d.innerHTML='<strong>'+esc(({simple:'Receita',control:'Controle especial',exams:'Exames',certificate:'Atestado'})[x.s.type]||'')+'</strong> · '+esc(x.s.patient||'(sem nome)')+'<br><small>'+esc(x.at)+'</small>';d.onclick=()=>load(x.s);L.appendChild(d)});
}
function pushHist(){api('history',{method:'POST',body:{doc:snap()}}).catch(()=>{})}

/* ---------- base ao vivo ---------- */
function drawBase(){
 const L=$('#baseList');L.innerHTML='';
 MEDS.filter(m=>m.s==='RGT').forEach(m=>{const d=document.createElement('div');d.innerHTML='<strong>'+esc(m.n)+'</strong> · medicamento <button class="icon-btn" style="float:right">Excluir</button>';d.querySelector('button').onclick=()=>api('meds',{method:'DELETE',body:{id:m.i}});L.appendChild(d)});
 if(!L.children.length)L.innerHTML='<div style="cursor:default">Nenhum item próprio cadastrado.</div>';
}
$('#addMed').onclick=()=>{const n=$('#bmNome').value.trim();if(!n)return;api('meds',{method:'POST',body:{nome:n,generico:$('#bmGen').value,qt:$('#bmQt').value,pos:$('#bmPos').value}}).then(()=>{['bmNome','bmGen','bmQt','bmPos'].forEach(i=>$('#'+i).value='')})};
$('#addExam').onclick=()=>{const n=$('#bxNome').value.trim();if(!n)return;api('exams',{method:'POST',body:{nome:n}}).then(()=>{$('#bxNome').value=''})};
/* ---------- impressão ---------- */
$('#printBtn').onclick=()=>{
 const al=alerts(),nErr=rows.filter(r=>r.erro).length;
 let msg='';if(nErr)msg+=nErr+' item(ns) pediátrico(s) sem dose calculada.\n';if(al.length)msg+='Alertas:\n'+al.join('\n')+'\n';
 if(msg&&!confirm(msg+'\nImprimir mesmo assim?'))return;
 const b=build(),pa=$('#printArea');pa.innerHTML=b.html;pa.style.display='block';
 pa.querySelectorAll('.page').forEach(fit);pa.style.display='';
 pushHist();
 const st=$('#status'),btn=$('#printBtn'),html=pa.innerHTML;
 const w=window.open('','_blank');
 btn.disabled=true;st.className='status';st.textContent='Gerando PDF A4…';
 api('pdf',{method:'POST',body:{html}}).then(r=>{
  if(w)w.location.href=r.url;else location.href=r.url;
  st.innerHTML='PDF A4 gerado. Se não abriu, <a href="'+r.url+'" target="_blank" rel="noopener">toque aqui</a>. No PDF, use Compartilhar/Imprimir (escala 100%).';
 }).catch(()=>{
  if(w)w.close();st.textContent='Não foi possível gerar o PDF no servidor; abrindo a impressão do navegador.';st.className='status warn';setTimeout(()=>window.print(),60);
 }).finally(()=>{btn.disabled=false});
};
$('#clearBtn').onclick=()=>{
 ['patient','peso','anos','meses','alergias','rxFree','exams','examObs','certText','certCid','certDias'].forEach(id=>$('#'+id).value='');$('#date').value=today();$('#certModelo').value='';rows=[];drawRows();render();
};
window.RGT={setType,render,state:snap,pages:()=>$$('#preview .page').length,addMed:id=>{addMed(MBYID[id])},valid:()=>!$('#preview .page.overflow')};
const d=LS.get('rgt_draft',null);if(d)load(d);else{setType('simple')}
loadCatalog();
try{const ev=hatchable.events.connect();const ch=ev.channel('rgt');
 ch.on('catalog',()=>{clearTimeout(catTmr);catTmr=setTimeout(loadCatalog,300)});
 ch.on('models',()=>{if(type==='models')drawModels()});ch.on('history',()=>{if(type==='history')drawHist()});ch.on('$reset',loadCatalog);
}catch(e){}
})();
