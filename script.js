const KEY='kos_unissula_v2',R=300,C={ok:'#2e9e4f',no:'#d93a3a',na:'#8a93a6',buf:'#3a7bd5',fix:'#f2a900'};
const JENIS=['Kos','Kontrakan','Asrama','Lainnya'],BANG=['Bangunan kos bertingkat','Bangunan kos satu lantai','Tidak dapat dipastikan'],PARK=['Tersedia','Tidak terlihat tersedia'],
 AKS=['Dapat dilalui motor dan mobil','Jalan sempit'],HARGA=['Di bawah Rp500.000','Rp500.000–Rp750.000','Rp750.000–Rp1.000.000','Di atas Rp1.000.000','Tidak diketahui'];
const KF=[['nama_lokasi','Nama kos','text'],['jenis_hunian','Jenis hunian','sel',JENIS],['wilayah','Wilayah / kelurahan','text'],['alamat','Alamat atau jalan','text'],['kondisi_bangunan','Kondisi bangunan','sel',BANG],['parkir','Parkir','sel',PARK],['akses_jalan','Akses jalan','sel',AKS],['kisaran_harga','Kisaran harga sewa','sel',HARGA],['catatan','Catatan','text']];
const HF=[['nama_halte','Nama halte','text'],['koridor','Koridor','text']];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const map=L.map('map',{zoomControl:false}).setView([-6.9524,110.4593],15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
L.control.scale({metric:true,imperial:false}).addTo(map);
L.control.zoom({position:'topright'}).addTo(map);
const gLn=L.layerGroup().addTo(map),gKos=L.layerGroup().addTo(map),gHal=L.layerGroup().addTo(map),gBuf=L.layerGroup().addTo(map),gGrid=L.layerGroup().addTo(map);
L.control.layers(null,{'Kos dan hunian':gKos,'Halte BRT':gHal,'Buffer 300 m':gBuf,'Garis lintang-bujur':gGrid},{collapsed:window.innerWidth<760}).addTo(map);
const lg=L.control({position:'bottomright'});
lg.onAdd=()=>{const d=L.DomUtil.create('div','legend');d.innerHTML=`<span class="dot" style="background:${C.ok}"></span>Terjangkau (≤ 300 m)<br><span class="dot" style="background:${C.no}"></span>Tidak terjangkau<br><span class="dot" style="background:${C.na}"></span>Belum ada halte<br><span class="dot" style="background:#fff;border:2px solid ${C.fix}"></span>Koordinat diperbaiki<br><span class="sq"></span>Halte BRT<br><span class="dot" style="background:${C.buf};opacity:.4"></span>Buffer 300 m`;return d};lg.addTo(map);
const cp=L.control({position:'topright'});
cp.onAdd=()=>{const d=L.DomUtil.create('div','compass');d.title='Arah mata angin (peta selalu menghadap utara)';
 d.innerHTML='<svg viewBox="0 0 72 72" width="58" height="58" role="img" aria-label="Arah mata angin: utara di atas"><circle class="cr" cx="36" cy="36" r="33"/><path class="cd" d="M36 17L40 32 55 36 40 40 36 55 32 40 17 36 32 32Z" transform="rotate(45 36 36)"/><path class="cg" d="M36 58L41 36 31 36Z"/><path class="cg" d="M58 36L36 31 36 41Z"/><path class="cg" d="M14 36L36 31 36 41Z"/><path d="M36 14L41 36 31 36Z" fill="#d93a3a"/><circle cx="36" cy="36" r="2.2" fill="#fff" stroke="#999" stroke-width=".6"/><text x="36" y="10" text-anchor="middle">U</text><text x="36" y="69" text-anchor="middle">S</text><text x="65" y="39" text-anchor="middle">T</text><text x="7" y="39" text-anchor="middle">B</text></svg>';
 L.DomEvent.disableClickPropagation(d);return d};cp.addTo(map);
const reg={k:{},h:{}};
let S={kos:[],halte:[]},addMode=null,pendAcc=null,gridStep=0.001;
const STEPS=[0.00005,0.0001,0.0002,0.0005,0.001,0.002,0.005,0.01,0.02,0.05,0.1];
const lab=(t,c)=>L.divIcon({className:'gl '+c,html:t,iconSize:[0,0]});
function drawGrid(){
 gGrid.clearLayers();if(!map.hasLayer(gGrid))return;
 const b=map.getBounds(),pxDeg=256*Math.pow(2,map.getZoom())/360;
 gridStep=STEPS.find(v=>v*pxDeg>=90)||0.1;
 const dec=(String(gridStep).split('.')[1]||'').length,st={color:'#555',weight:1,opacity:.45,interactive:false},s=b.getSouth(),n=b.getNorth(),w=b.getWest(),e=b.getEast();
 for(let i=Math.ceil(w/gridStep);i<=Math.floor(e/gridStep);i++){const v=+(i*gridStep).toFixed(dec);L.polyline([[s,v],[n,v]],st).addTo(gGrid);L.marker([n-(n-s)*.02,v],{icon:lab(v.toFixed(dec),'gx'),interactive:false}).addTo(gGrid)}
 for(let i=Math.ceil(s/gridStep);i<=Math.floor(n/gridStep);i++){const v=+(i*gridStep).toFixed(dec);L.polyline([[v,w],[v,e]],st).addTo(gGrid);L.marker([v,w+(e-w)*.01],{icon:lab(v.toFixed(dec),'gy'),interactive:false}).addTo(gGrid)}
 $('snapinfo').textContent='(grid '+gridStep+'°, maks. geser ≈ '+Math.round(gridStep*111320*0.7071)+' m)';
}
const ro=L.control({position:'bottomleft'});ro.onAdd=()=>{const d=L.DomUtil.create('div','legend');d.id='ro';d.textContent='Gerakkan kursor atau klik peta untuk melihat koordinat';return d};ro.addTo(map);
const snapPt=p=>$('snap').checked?L.latLng(Math.round(p.lat/gridStep)*gridStep,Math.round(p.lng/gridStep)*gridStep):p;
map.on('mousemove',e=>{$('ro').textContent='Lintang '+e.latlng.lat.toFixed(6)+'   Bujur '+e.latlng.lng.toFixed(6)});
map.on('moveend overlayadd overlayremove',drawGrid);
const get=n=>fetch('data/'+n+'.geojson').then(r=>{if(!r.ok)throw new Error(n);return r.json()});
const store=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
Promise.all([get('kos'),get('halte')]).then(([k,h])=>{let t=null;try{t=JSON.parse(localStorage.getItem(KEY))}catch(e){}S=t&&t.kos?t:{kos:k.features,halte:h.features};start()})
 .catch(e=>{$('stats').textContent='Gagal memuat data/'+e.message+'.geojson. Jalankan lewat local server (python -m http.server).'});
const ll=f=>[f.geometry.coordinates[1],f.geometry.coordinates[0]];
function calc(){S.kos.forEach(f=>{let m=Infinity,id=null,hn=null;S.halte.forEach(h=>{const d=map.distance(ll(f),ll(h));if(d<m){m=d;id=h.properties.id_halte;hn=h.properties.nama_halte}});const p=f.properties;
 if(id){p.jarak_halte=Math.round(m*10)/10;p.id_halte_terdekat=id;p.nama_halte_terdekat=hn;p.status_akses=m<=R?'terjangkau':'tidak_terjangkau'}else{p.jarak_halte=null;p.id_halte_terdekat=null;p.nama_halte_terdekat=null;p.status_akses='belum_ada_halte'}})}
const nextId=(arr,k,pre)=>pre+String(Math.max(0,...arr.map(f=>parseInt(String(f.properties[k]).replace(/\D/g,''))||0))+1).padStart(3,'0');
function start(){
 map.on('click',e=>{const p=snapPt(e.latlng);if(addMode){openForm(addMode,null,p);addMode=null;$('map').classList.remove('adding')}else{const t=p.lat.toFixed(6)+', '+p.lng.toFixed(6);$('ro').textContent='Dipilih: '+t+' (disalin)';try{navigator.clipboard.writeText(t)}catch(_){}}});
 $('addG').onclick=()=>{if(!navigator.geolocation){alert('Browser tidak mendukung GPS.');return}$('hint').textContent='Mengambil lokasi GPS...';
  navigator.geolocation.getCurrentPosition(p=>{pendAcc=Math.round(p.coords.accuracy);const at=L.latLng(p.coords.latitude,p.coords.longitude);map.setView(at,19);openForm('kos',null,at);$('hint').textContent='Akurasi GPS ±'+pendAcc+' m. '+(pendAcc>15?'Di atas 15 m: tunggu atau pindah ke area terbuka.':'')},
  ()=>alert('Lokasi tidak bisa diambil. Izinkan akses lokasi dan buka lewat HTTPS atau localhost.'),{enableHighAccuracy:true,timeout:20000})};
 map.on('popupopen',e=>{if(mobile())setSheet(0);const el=e.popup.getElement();el.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>act(b.dataset.act,b.dataset.kind,b.dataset.id,el))});
 $('addK').onclick=()=>arm('kos');$('addH').onclick=()=>arm('halte');$('autoH').onclick=()=>autoHalte(false);
 $('exG').onclick=()=>{dl('kos.geojson',fc(S.kos));setTimeout(()=>dl('halte.geojson',fc(S.halte)),300)};
 $('exC').onclick=()=>{const cols=['id_kos','nama_lokasi','jenis_hunian','wilayah','alamat','kondisi_bangunan','parkir','akses_jalan','kisaran_harga','nama_halte_terdekat','jarak_halte','status_akses','status_koordinat','sumber_data','akurasi_gps','tanggal_survei','catatan'];
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';dl('kos.csv','\ufeff'+['lat','lon',...cols].join(',')+'\n'+S.kos.map(f=>[f.geometry.coordinates[1],f.geometry.coordinates[0],...cols.map(c=>q(f.properties[c]))].join(',')).join('\n'),'text/csv')};
 $('imp').onclick=()=>$('file').click();
 $('file').onchange=ev=>{const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result),fs=(j.features||[]).filter(f=>f.geometry&&f.geometry.type==='Point');
  const isH=fs.length&&fs.every(f=>f.properties&&(f.properties.nama_halte||f.properties.id_halte||f.properties.highway==='bus_stop'||f.properties.public_transport));
  if(!fs.length||!confirm('Ganti seluruh data '+(isH?'halte':'kos')+' dengan '+fs.length+' titik dari file ini?'))return;
  fs.forEach(f=>{f.properties=f.properties||{}});if(isH)fs.forEach(f=>{f.properties.nama_halte=f.properties.nama_halte||f.properties.name||'Halte tanpa nama'});S[isH?'halte':'kos']=fs;if(isH)fs.forEach(f=>{f.properties.id_halte=f.properties.id_halte||nextId(fs,'id_halte','HLT-')});else fs.forEach(f=>{f.properties.id_kos=f.properties.id_kos||nextId(fs,'id_kos','K')});
  store();render()}catch(e){alert('File tidak valid: '+e.message)}};r.readAsText(ev.target.files[0]);ev.target.value=''};
 $('rst').onclick=()=>{if(confirm('Hapus perubahan di browser ini dan kembali ke data awal?')){try{localStorage.removeItem(KEY)}catch(e){}location.reload()}};
 ['input','change'].forEach(ev=>['st','kl'].forEach(id=>$(id).addEventListener(ev,()=>{render();const p=rowsNow().map(ll);if(p.length)fitTo(p,17)})));
 let tq;$('q').addEventListener('input',()=>{clearTimeout(tq);tq=setTimeout(searchGo,250)});
 $('q').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(tq);searchGo();if(mobile())setSheet(0)}});
 $('q').addEventListener('focus',()=>{if(mobile()&&sheetI===0)setSheet(1)});
 $('hasil').addEventListener('click',e=>{const b=e.target.closest('.res');if(b)goTo(b.dataset.t,b.dataset.id)});
 render();fitTo(S.kos.map(ll),16);drawGrid();if(!S.halte.length)autoHalte(true);
}
const fc=a=>JSON.stringify({type:'FeatureCollection',features:a},null,1);
function dl(n,t,ty='application/geo+json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:ty}));a.download=n;a.click()}

const OVP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
async function autoHalte(silent){
 if(!S.kos.length&&!silent){alert('Belum ada data kos untuk menentukan wilayah pencarian.');return}
 const b=S.kos.length?L.geoJSON(S.kos).getBounds().pad(.35):map.getBounds(),bb=[b.getSouth(),b.getWest(),b.getNorth(),b.getEast()].map(v=>v.toFixed(5)).join(',');
 const q=`[out:json][timeout:25];(nwr["highway"="bus_stop"](${bb});nwr["public_transport"~"platform|station"]["bus"="yes"](${bb});nwr["amenity"="bus_station"](${bb});nwr["public_transport"]["network"~"Trans ?Semarang|BRT",i](${bb}););out center tags;`;
 if(!silent&&S.halte.some(h=>h.properties.sumber_data==='osm')){if(!confirm('Ganti halte hasil OSM sebelumnya dengan hasil terbaru? Halte tambahan manual tetap dipertahankan.'))return;S.halte=S.halte.filter(h=>h.properties.sumber_data!=='osm')}
 $('hint').textContent='Mengambil halte BRT dari OpenStreetMap...';
 let js=null;
 for(const u of OVP){try{const r=await fetch(u,{method:'POST',body:'data='+encodeURIComponent(q)});if(r.ok){js=await r.json();break}}catch(e){}}
 if(!js){render();$('hint').textContent='Gagal mengambil halte otomatis (cek internet). Coba lagi dengan tombol “Ambil halte otomatis (OSM)” atau impor GeoJSON halte.';return}
 let n=0;
 const isS=el=>/trans ?semarang|brt/i.test(((el.tags||{}).network||'')+' '+((el.tags||{}).operator||'')),els=js.elements||[],pakaiStrict=els.some(isS);
 els.forEach(el=>{
  const t=el.tags||{},la=el.lat??(el.center&&el.center.lat),lo=el.lon??(el.center&&el.center.lon);if(la==null||lo==null)return;
  const nm=t.name||t['name:id']||'Halte tanpa nama';
  if(S.halte.some(h=>h.properties.osm_id===el.type+'/'+el.id||(h.properties.nama_halte===nm&&map.distance(ll(h),[la,lo])<40)))return;
  const strict=/trans ?semarang|brt/i.test((t.network||'')+' '+(t.operator||''));
  S.halte.push({type:'Feature',geometry:{type:'Point',coordinates:[+lo.toFixed(7),+la.toFixed(7)]},properties:{id_halte:nextId(S.halte,'id_halte','HLT-'),nama_halte:nm,koridor:t.route_ref||t.ref||'',sumber_data:'osm',osm_id:el.type+'/'+el.id,
   catatan:strict?'':'Halte bus di OSM tanpa tag Trans Semarang, belum tentu BRT. Periksa atau hapus.'}});n++});
 store();render();if(n)fitTo([...S.kos.map(ll),...S.halte.map(ll)],17);
 $('hint').textContent=n?('Ditambahkan '+n+' halte dari OpenStreetMap. Periksa titik berlabel “perlu dicek”, lalu Ekspor GeoJSON untuk menyimpan permanen.'):'Tidak ada halte baru ditemukan di OpenStreetMap untuk area ini. Tambahkan manual lewat “+ Tambah halte”.';
}
function arm(k){if(mobile())setSheet(0);addMode=k;$('map').classList.add('adding');$('hint').textContent='Klik lokasi di peta untuk menambah '+(k==='kos'?'kos':'halte')+'.'}
function openForm(kind,f,at){
 const p=f?f.properties:{},F=kind==='kos'?KF:HF,[la,lo]=(f?ll(f):[at.lat,at.lng]).map(v=>+(+v).toFixed(7));
 const inp=([n,l,t,o])=>`<label>${l}</label>`+(t==='sel'?`<select data-f="${n}">${o.map(x=>`<option${p[n]===x?' selected':''}>${esc(x)}</option>`).join('')}</select>`:`<input data-f="${n}" value="${esc(p[n])}">`);
 L.popup({maxWidth:300}).setLatLng([la,lo]).setContent(`<div class="pf"><b>${f?'Ubah':'Tambah'} ${kind==='kos'?'kos':'halte'}</b>${F.map(inp).join('')}
 <label>Lintang</label><input data-f="lat" type="number" step="any" value="${la}"><label>Bujur</label><input data-f="lon" type="number" step="any" value="${lo}">
 <div class="row"><button data-act="save" data-kind="${kind}" data-id="${f?esc(p[kind==='kos'?'id_kos':'id_halte']):''}">Simpan</button><button data-act="cancel">Batal</button></div></div>`).openOn(map);
}
function act(a,kind,id,el){
 const arr=S[kind==='kos'?'kos':'halte'],key=kind==='kos'?'id_kos':'id_halte',f=arr.find(x=>x.properties[key]===id);
 if(a==='cancel'){map.closePopup()}
 else if(a==='edit'){openForm(kind,f)}
 else if(a==='del'){if(confirm('Hapus '+id+'?')){S[kind==='kos'?'kos':'halte']=arr.filter(x=>x!==f);store();map.closePopup();render()}}
 else if(a==='save'){
  const v={};el.querySelectorAll('[data-f]').forEach(i=>v[i.dataset.f]=i.value.trim());const la=parseFloat(v.lat),lo=parseFloat(v.lon);
  if(!(la>=-7.2&&la<=-6.8&&lo>=110.3&&lo<=110.6)){alert('Koordinat di luar kisaran Semarang. Lintang negatif (mis. -6.95), bujur sekitar 110.4.');return}
  if(!v[kind==='kos'?'nama_lokasi':'nama_halte']){alert('Nama wajib diisi.');return}
  let t=f;if(!t){t={type:'Feature',properties:{},geometry:{type:'Point',coordinates:[0,0]}};t.properties[key]=nextId(arr,key,kind==='kos'?'K':'HLT-');arr.push(t);
   if(kind==='kos'){t.properties.sumber_data='input_pengguna';t.properties.status_koordinat='asli';t.properties.tanggal_survei=new Date().toISOString().slice(0,10);if(pendAcc!=null){t.properties.akurasi_gps=pendAcc;pendAcc=null}}}
  else if(Math.abs(t.geometry.coordinates[1]-la)>1e-7||Math.abs(t.geometry.coordinates[0]-lo)>1e-7){if(kind==='kos')t.properties.status_koordinat='diubah_pengguna'}
  delete v.lat;delete v.lon;Object.assign(t.properties,v);t.geometry.coordinates=[lo,la];store();map.closePopup();reveal(kind,t)}
}
const btns=(k,id)=>`<div class="row" style="display:flex;gap:6px;margin-top:8px"><button data-act="edit" data-kind="${k}" data-id="${esc(id)}">Ubah</button><button data-act="del" data-kind="${k}" data-id="${esc(id)}" class="warn">Hapus</button></div>`;
function showLine(f){gLn.clearLayers();const h=S.halte.find(x=>x.properties.id_halte===f.properties.id_halte_terdekat);if(h)L.polyline([ll(f),ll(h)],{color:'#000',weight:2,dashArray:'5 5',interactive:false}).addTo(gLn)}
map.on('popupclose',()=>gLn.clearLayers());
function rowsNow(){const q=$('q').value.trim().toLowerCase(),st=$('st').value,kl=$('kl').value;return S.kos.filter(f=>{const p=f.properties;return(!st||p.status_akses===st)&&(!kl||(p.wilayah||'-')===kl)&&(!q||[p.nama_lokasi,p.alamat,p.id_kos,p.wilayah].join(' ').toLowerCase().includes(q))})}
function render(){
 calc();gKos.clearLayers();gHal.clearLayers();gBuf.clearLayers();reg.k={};reg.h={};$('hint').textContent='Perubahan tersimpan di browser ini. Ekspor GeoJSON untuk menyimpannya permanen.';
 S.halte.forEach(h=>{const p=h.properties;L.circle(ll(h),{radius:R,color:C.buf,weight:1,fillColor:C.buf,fillOpacity:.2,interactive:false}).addTo(gBuf);
  reg.h[p.id_halte]=L.marker(ll(h),{icon:L.divIcon({className:'',html:'<div class="hal">B</div>',iconSize:[20,20]})}).addTo(gHal).bindPopup(`<b>${esc(p.nama_halte)}</b><br>ID: ${esc(p.id_halte)}<br>Koridor: ${esc(p.koridor||'-')}${p.catatan?`<br><span class="badge">perlu dicek</span> <small>${esc(p.catatan)}</small>`:''}${p.sumber_data==='osm'?'<br><small>Sumber: OpenStreetMap '+esc(p.osm_id)+'</small>':''}${btns('halte',p.id_halte)}`)});
 const wl=[...new Set(S.kos.map(f=>f.properties.wilayah||'-'))].sort(),cur=$('kl').value;
 $('kl').innerHTML='<option value="">Semua</option>'+wl.map(w=>`<option${w===cur?' selected':''}>${esc(w)}</option>`).join('');
 const rows=rowsNow();
 rows.forEach(f=>{const p=f.properties,col=p.status_akses==='terjangkau'?C.ok:p.status_akses==='tidak_terjangkau'?C.no:C.na,fx=p.status_koordinat==='diperbaiki'||p.status_koordinat==='diubah_pengguna';
  const lab={terjangkau:'Terjangkau',tidak_terjangkau:'Tidak terjangkau',belum_ada_halte:'Belum ada halte'}[p.status_akses];
  const foto=/^https:\/\/drive\.google\.com\//.test(p.foto_url||'')?`<br><a href="${esc(p.foto_url)}" target="_blank" rel="noopener">Foto lokasi</a>`:'';
  reg.k[p.id_kos]=L.circleMarker(ll(f),{radius:8,color:fx?C.fix:'#fff',weight:fx?3:1.5,fillColor:col,fillOpacity:.95}).addTo(gKos).bindPopup(
   `<b>${esc(p.nama_lokasi)}</b> ${fx?'<span class="badge">koordinat belum diverifikasi</span>':''}<br>ID: ${esc(p.id_kos)} · ${esc(p.jenis_hunian)}<br>Wilayah: ${esc(p.wilayah)}<br>Alamat: ${esc(p.alamat)}<br>Bangunan: ${esc(p.kondisi_bangunan)}<br>Parkir: ${esc(p.parkir)} · Akses: ${esc(p.akses_jalan)}<br>Harga: ${esc(p.kisaran_harga)}<br>Halte terdekat: <b>${esc(p.nama_halte_terdekat||'-')}</b> (${esc(p.id_halte_terdekat||'-')})<br>Jarak lurus: ${p.jarak_halte==null?'-':esc(p.jarak_halte)+' m'}<br>Status: <b>${lab}</b><br><small>Sumber: ${esc(p.sumber_data)} · ${esc(p.tanggal_survei)}</small>${foto}${btns('kos',p.id_kos)}`).on('popupopen',()=>showLine(f))});
 const n=rows.length,t=rows.filter(f=>f.properties.status_akses==='terjangkau').length,na=rows.filter(f=>f.properties.status_akses==='belum_ada_halte').length;
 const cards=na?[['Kos',n,''],['Halte',S.halte.length,''],['Terjangkau','-','ok'],['Persen','-','']]:[['Kos',n,''],['Terjangkau',t,'ok'],['Tidak',n-t,'no'],['Persen',n?(100*t/n).toFixed(1)+'%':'-','']];
 $('stats').innerHTML='<div class="sg">'+cards.map(([a,b,c])=>`<div class="${c}"><b>${b}</b><span>${a}</span></div>`).join('')+'</div>'+(na||!n?'':`<div class="prog" role="img" aria-label="${(100*t/n).toFixed(0)} persen kos terjangkau"><i style="width:${(100*t/n).toFixed(1)}%"></i></div>`);
 const g={};rows.forEach(f=>{const k=f.properties.wilayah||'-';g[k]=g[k]||[0,0];g[k][0]++;if(f.properties.status_akses==='terjangkau')g[k][1]++});
 $('tb').tBodies[0].innerHTML=Object.entries(g).sort().map(([k,[a,b]])=>`<tr><td>${esc(k)}</td><td>${a}</td><td>${na?'-':b}</td><td>${na?'-':`<span class="pct" style="--p:${(100*b/a).toFixed(0)}%">${(100*b/a).toFixed(1)}</span>`}</td></tr>`).join('');
}


// ===== Pencarian, fokus ke titik, dan penanda baru =====
function padOpts(){
 if(mobile()){const M=$('map').offsetHeight;return{paddingTopLeft:[16,24],paddingBottomRight:[70,Math.min(snaps()[sheetI]+16,M*.6)]}}
 const c=document.body.classList.contains('pclosed');return{paddingTopLeft:[c?70:392,24],paddingBottomRight:[80,24]}}
function fitTo(p,z=17){if(!p.length)return;map.fitBounds(L.latLngBounds(p),Object.assign(padOpts(),{maxZoom:z}))}
function pulse(at){const m=L.marker(at,{icon:L.divIcon({className:'pulse',html:'<i></i>',iconSize:[0,0]}),interactive:false,keyboard:false}).addTo(map);setTimeout(()=>m.remove(),3300)}
function goTo(t,id){const f=(t==='k'?S.kos:S.halte).find(x=>x.properties[t==='k'?'id_kos':'id_halte']===id);if(!f)return;
 if(!map.hasLayer(t==='k'?gKos:gHal))(t==='k'?gKos:gHal).addTo(map);
 fitTo([ll(f)],18);pulse(ll(f));setTimeout(()=>{const m=(t==='k'?reg.k:reg.h)[id];if(m)m.openPopup()},450);if(mobile())setSheet(0)}
function reveal(kind,f){['q','st','kl'].forEach(id=>$(id).value='');$('hasil').innerHTML='';render();goTo(kind==='kos'?'k':'h',f.properties[kind==='kos'?'id_kos':'id_halte'])}
function searchGo(){
 render();const q=$('q').value.trim(),box=$('hasil');
 if(!q){box.innerHTML='';return}
 const ql=q.toLowerCase(),k=rowsNow(),h=S.halte.filter(x=>[x.properties.nama_halte,x.properties.id_halte,x.properties.koridor].join(' ').toLowerCase().includes(ql));
 const items=[...h.map(f=>['h',f]),...k.map(f=>['k',f])],idOf=([t,f])=>f.properties[t==='k'?'id_kos':'id_halte'];
 box.innerHTML=items.length?items.slice(0,6).map(it=>{const[t,f]=it,p=f.properties;return`<button type="button" class="res" data-t="${t}" data-id="${esc(idOf(it))}"><span class="tag ${t}">${t==='k'?'Kos':'Halte'}</span><b>${esc(t==='k'?p.nama_lokasi:p.nama_halte)}</b><small>${esc(t==='k'?(p.wilayah||p.alamat||''):(p.koridor?'Koridor '+p.koridor:p.id_halte))}</small></button>`}).join('')+(items.length>6?`<p class="sub">+${items.length-6} hasil lain ikut tampil di peta</p>`:''):'<p class="sub">Tidak ada hasil. Coba kata kunci lain.</p>';
 if(!items.length)return;
 fitTo(items.map(([,f])=>ll(f)),items.length===1?18:17);
 if(items.length===1){const it=items[0];pulse(ll(it[1]));setTimeout(()=>{const m=(it[0]==='k'?reg.k:reg.h)[idOf(it)];if(m)m.openPopup()},450)}
}

// ===== Panel geser: drawer di desktop, bottom sheet di HP =====
const mq=window.matchMedia('(max-width:760px)'),mobile=()=>mq.matches,panel=$('panel');
let sheetI=0;
const snaps=()=>{const H=panel.offsetHeight,M=$('map').offsetHeight;return[Math.min(92,H),Math.min(Math.round(M*.52),H),H]};
function setSheet(i,anim=true){if(!mobile())return;sheetI=i;panel.style.transition=anim?'':'none';panel.style.transform='translateY('+(panel.offsetHeight-snaps()[i])+'px)';panel.dataset.s=i}
function setOpen(o){document.body.classList.toggle('pclosed',!o);$('tog').setAttribute('aria-expanded',o);$('tog').setAttribute('aria-label',o?'Tutup panel':'Buka panel')}
$('tog').onclick=()=>setOpen(document.body.classList.contains('pclosed'));
(()=>{
 const cur=()=>{const m=/translateY\(([-\d.]+)px\)/.exec(panel.style.transform);return m?+m[1]:panel.offsetHeight-snaps()[0]};
 let x0=0,y0=0,t0=0,drag=false,moved=false;
 [$('grab'),document.querySelector('.hd')].forEach(el=>{
  el.addEventListener('pointerdown',e=>{drag=true;moved=false;x0=e.clientX;y0=e.clientY;t0=mobile()?cur():0;try{el.setPointerCapture(e.pointerId)}catch(_){}if(mobile())panel.style.transition='none'});
  el.addEventListener('pointermove',e=>{if(!drag||!mobile())return;const dy=e.clientY-y0;if(Math.abs(dy)>5)moved=true;const H=panel.offsetHeight;panel.style.transform='translateY('+Math.min(H-snaps()[0],Math.max(0,t0+dy))+'px)'});
  const end=e=>{if(!drag)return;drag=false;const dx=e.clientX-x0,dy=e.clientY-y0;
   if(!mobile()){if(dx<-60&&Math.abs(dy)<Math.abs(dx))setOpen(false);return}
   if(!moved){setSheet(sheetI===0?1:0);return}
   const H=panel.offsetHeight,s=snaps(),vis=H-Math.min(H-s[0],Math.max(0,t0+dy))-dy*.5;
   setSheet(s.reduce((b,v,i)=>Math.abs(v-vis)<Math.abs(s[b]-vis)?i:b,0))};
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)});
 $('grab').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSheet(sheetI===0?1:0)}else if(e.key==='ArrowUp')setSheet(Math.min(2,sheetI+1));else if(e.key==='ArrowDown')setSheet(Math.max(0,sheetI-1))});
 // layar sentuh desktop/tablet: geser kiri pada panel untuk menutup, geser kanan dari tepi kiri untuk membuka
 let tx=0,ty=0;const ts=e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY};
 panel.addEventListener('touchstart',ts,{passive:true});$('map').addEventListener('touchstart',ts,{passive:true});
 panel.addEventListener('touchend',e=>{if(mobile())return;const t=e.changedTouches[0],dx=t.clientX-tx,dy=t.clientY-ty;if(dx<-70&&Math.abs(dy)<Math.abs(dx)*.6)setOpen(false)},{passive:true});
 $('map').addEventListener('touchend',e=>{if(mobile()||!document.body.classList.contains('pclosed'))return;const t=e.changedTouches[0],dx=t.clientX-tx;if(tx<28&&dx>60)setOpen(true)},{passive:true});
 const sync=()=>{panel.style.transform='';panel.style.transition='';if(mobile())setSheet(sheetI,false)};
 mq.addEventListener('change',sync);window.addEventListener('resize',()=>{if(mobile())setSheet(sheetI,false)});sync();
})();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mobile()&&sheetI>0&&!document.querySelector('.leaflet-popup'))setSheet(0)});
