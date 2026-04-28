const COUNTRIES = [
  {id:'AL',name:'Albania',  artist:'Shkodra Elektronike',song:'Zjerm'},
  {id:'AU',name:'Australia',artist:'Voyager',            song:'Galaxy of Light'},
  {id:'AT',name:'Austria',  artist:'JJ',                 song:'Wasted Love'},
  {id:'BE',name:'Belgium',  artist:'Red Sebastian',      song:'Strobe Lights'},
  {id:'HR',name:'Croatia',  artist:'Baby Lasagna',       song:'Rim Tim Tagi Dim'},
  {id:'CY',name:'Cyprus',   artist:'Silia Kapsis',       song:'Liar'},
  {id:'EE',name:'Estonia',  artist:'Tommy Cash',         song:'Espresso Macchiato'},
  {id:'FI',name:'Finland',  artist:'Käärijä',            song:'Cha Cha Boom'},
  {id:'FR',name:'France',   artist:'Louane',             song:'maman'},
  {id:'DE',name:'Germany',  artist:'Abor & Tynna',       song:'Baller'},
  {id:'GR',name:'Greece',   artist:'Klavdia',            song:'Asteromáta'},
  {id:'IS',name:'Iceland',  artist:'Væb',                song:'RÓA'},
  {id:'IE',name:'Ireland',  artist:'Emmy',               song:'Laika Party'},
  {id:'IL',name:'Israel',   artist:'Yuval Raphael',      song:'New Day Will Rise'},
  {id:'IT',name:'Italy',    artist:'Lucio Corsi',        song:'Volevo essere un duro'},
  {id:'LV',name:'Latvia',   artist:'Tautumeitas',        song:'Bur man laimi'},
  {id:'LT',name:'Lithuania',artist:'Katarsis',           song:'Tavo akys'},
  {id:'MT',name:'Malta',    artist:'Miriana Conte',      song:'Serving'},
  {id:'MD',name:'Moldova',  artist:'Spectrum',           song:"I'm Overstimulated"},
  {id:'NL',name:'Netherlands',artist:'Claude',           song:"C'est la vie"},
  {id:'NO',name:'Norway',   artist:'Kyle Alessandro',    song:'Lighter'},
  {id:'PL',name:'Poland',   artist:'Justyna Steczkowska',song:'GAJA'},
  {id:'PT',name:'Portugal', artist:'Napa',               song:'Deslocado'},
  {id:'RS',name:'Serbia',   artist:'Princ',              song:'Mila moja'},
  {id:'ES',name:'Spain',    artist:'Melody',             song:'Esa diva'},
  {id:'SE',name:'Sweden',   artist:'KAJ',                song:'Bara bada bastu'},
]

function flagUrl(id){ return `https://flagcdn.com/w40/${id.toLowerCase()}.png` }

let top   = [null,null,null,null,null]
let worst = [null,null,null,null,null]
let activeZone = 'top'
let poolOrder  = [...COUNTRIES].sort((a,b)=>a.name.localeCompare(b.name))
let filterMode = 'all'

function setActiveZone(z){
  activeZone = z
  document.getElementById('tab-top').classList.toggle('act',z==='top')
  document.getElementById('tab-worst').classList.toggle('act',z==='worst')
  const h = document.getElementById('zone-hint')
  h.textContent = z==='top' ? '↑ adding to Top 5' : '↓ adding to Worst 5'
  h.classList.add('show')
}
window.setActiveZone = setActiveZone

function isUsed(id){ return top.includes(id)||worst.includes(id) }
function zoneOf(id){ return top.includes(id)?'top':worst.includes(id)?'worst':null }
function addTo(zone,id){ const a=zone==='top'?top:worst; const i=a.indexOf(null); if(i===-1)return false; a[i]=id; return true }

function removeSlot(zone,idx){ (zone==='top'?top:worst)[idx]=null; render() }
window.removeSlot = removeSlot

function handleClick(id){
  if(isUsed(id)){
    const z=zoneOf(id); const a=z==='top'?top:worst; a[a.indexOf(id)]=null
  } else {
    const mob = window.innerWidth<=860
    const pref = mob ? activeZone : (top.includes(null)?'top':'worst')
    if(!addTo(pref,id)) addTo(pref==='top'?'worst':'top',id)
  }
  render()
}
window.handleClick = handleClick

function heartFlag(id, size='md'){
  const cls = size==='sm' ? 'heart-flag-sm' : 'heart-flag'
  return `<div class="${cls}"><img src="${flagUrl(id)}" alt="" loading="lazy"></div>`
}

function renderSlots(cid, zone){
  const arr = zone==='top'?top:worst
  const el = document.getElementById(cid)
  el.innerHTML = arr.map((id,i)=>{
    if(!id) return `<div class="slot" data-zone="${zone}" data-idx="${i}">
      <span class="slot-num">${i+1}</span>
      <span class="slot-empty-hint">tap a country →</span>
    </div>`
    const c = COUNTRIES.find(x=>x.id===id)
    return `<div class="slot filled" draggable="true" ondragstart="dragStart(event,'${zone}',${i})">
      <span class="slot-num">${i+1}</span>
      ${heartFlag(id,'sm')}
      <span class="slot-name">${c.name}</span>
      <button class="slot-remove" onclick="removeSlot('${zone}',${i})">✕</button>
    </div>`
  }).join('')
  el.querySelectorAll('.slot:not(.filled)').forEach(s=>{
    s.addEventListener('dragover',e=>{e.preventDefault();s.classList.add('drag-over')})
    s.addEventListener('dragleave',()=>s.classList.remove('drag-over'))
    s.addEventListener('drop',e=>{e.preventDefault();s.classList.remove('drag-over');dragDrop(zone,+s.dataset.idx)})
  })
}

let dragSrc=null
function dragStart(e,zone,idx){dragSrc={zone,idx}}
window.dragStart = dragStart

function dragDrop(tz,ti){
  if(!dragSrc)return
  const fA=dragSrc.zone==='top'?top:worst, tA=tz==='top'?top:worst
  const v=fA[dragSrc.idx]; fA[dragSrc.idx]=tA[ti]; tA[ti]=v
  dragSrc=null; render()
}

function renderPool(){
  let view = poolOrder
  if(filterMode==='top')   view=poolOrder.filter(c=>top.includes(c.id))
  else if(filterMode==='worst') view=poolOrder.filter(c=>worst.includes(c.id))
  document.getElementById('pool').innerHTML = view.map(c=>{
    const used=isUsed(c.id), zone=zoneOf(c.id)
    const cls = used?(zone==='top'?'in-top':'in-worst'):''
    return `<div class="card ${cls} ${used?'used':''}" onclick="handleClick('${c.id}')">
      <div class="card-country">
        ${heartFlag(c.id,'md')}
        <span class="card-cname">${c.name}</span>
      </div>
      <div class="card-artist">
        <span class="card-icon">🎤</span>
        <span class="card-text">${c.artist}</span>
        <span class="card-arr">›</span>
      </div>
      <div class="card-song">
        <span class="card-icon">🎵</span>
        <span class="card-text">${c.song}</span>
        <span class="card-arr">›</span>
      </div>
    </div>`
  }).join('')
}

function renderPreviews(){
  const mk=(arr,elId)=>{
    document.getElementById(elId).innerHTML=Array.from({length:5},(_,i)=>{
      const id=arr[i]
      if(!id) return `<div class="pf-empty"></div>`
      return `<div class="pf-wrap"><img src="${flagUrl(id)}" loading="lazy"></div>`
    }).join('')
  }
  mk(top,'preview-top'); mk(worst,'preview-worst')
  const n=top.filter(Boolean).length+worst.filter(Boolean).length
  document.getElementById('pts-badge').textContent=`${n} / 10 picked`
  document.getElementById('submit-btn').classList.toggle('ready',n===10)
}

function sortPool(t){
  if(t==='az') poolOrder.sort((a,b)=>a.name.localeCompare(b.name))
  else if(t==='za') poolOrder.sort((a,b)=>b.name.localeCompare(a.name))
  else poolOrder=[...COUNTRIES].sort(()=>Math.random()-.5)
  render()
}
window.sortPool = sortPool

function filterPool(mode){
  filterMode=mode
  ;['ft','fw','fall'].forEach(k=>document.getElementById('btn-'+k).classList.remove('act'))
  document.getElementById(mode==='top'?'btn-ft':mode==='worst'?'btn-fw':'btn-fall').classList.add('act')
  render()
}
window.filterPool = filterPool

function render(){ renderSlots('slots-top','top'); renderSlots('slots-worst','worst'); renderPool(); renderPreviews() }

render()
