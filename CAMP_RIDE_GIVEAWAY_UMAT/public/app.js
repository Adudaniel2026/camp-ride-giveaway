const $ = s => document.querySelector(s);
let csrf = '';
async function request(url, options={}) {
  const response = await fetch(url, { credentials:'same-origin', ...options, headers:{'Content-Type':'application/json', ...(options.headers||{})} });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function message(text, error=false) { $('#message').textContent=text; $('#message').classList.toggle('error',error); }
async function init() { const c=await request('/api/config'); csrf=c.csrfToken; }
$('#accept').onclick=()=>{$('#menu').hidden=true;$('#registration').hidden=false;message('Please complete your details.');};
$('#cancel').onclick=()=>{message('You cancelled. No registration was submitted.');};
$('#back').onclick=()=>{$('#registration').hidden=true;$('#menu').hidden=false;message('');};
$('#registration').onsubmit=async e=>{
  e.preventDefault(); const f=new FormData(e.currentTarget);
  try { const data=await request('/api/register',{method:'POST',body:JSON.stringify({fullName:f.get('fullName'),studentId:f.get('studentId'),phone:f.get('phone'),consent:f.get('consent')==='on'})}); message(data.message); e.currentTarget.reset(); e.currentTarget.hidden=true; $('#menu').hidden=false; }
  catch(err){message(err.message,true);}
};
async function loadDashboard(){
  const [summary,list]=await Promise.all([request('/api/admin/summary'),request('/api/admin/registrations')]);
  $('#total').textContent=summary.total;
  $('#rows').replaceChildren(...list.registrations.map(r=>{const tr=document.createElement('tr');[r.fullName,r.studentId,r.phone,r.createdAt].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});return tr;}));
}
$('#login').onsubmit=async e=>{
  e.preventDefault();
  try {const data=await request('/api/admin/login',{method:'POST',headers:{'x-csrf-token':csrf},body:JSON.stringify({password:new FormData(e.currentTarget).get('password')})});csrf=data.csrfToken;$('#login').hidden=true;$('#dashboard').hidden=false;await loadDashboard();}
  catch(err){message(err.message,true);}
};
$('#refresh').onclick=()=>loadDashboard().catch(e=>message(e.message,true));
$('#logout').onclick=async()=>{try{await request('/api/admin/logout',{method:'POST',headers:{'x-csrf-token':csrf}});location.reload();}catch(e){message(e.message,true);}};
init().catch(e=>message(e.message,true));
