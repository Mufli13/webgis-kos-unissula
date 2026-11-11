# Membersihkan dan mengaudit Data_Survei_Kos...xlsx (ekspor Google Form), lalu menulis
# data/kos.geojson dan Audit_Data_Survei_Kos_UNISSULA.xlsx. Jalankan ulang setiap ada respons baru:
#   python proses_survei.py [path_xlsx]
import re, json, sys, math, datetime, os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
SRC=sys.argv[1] if len(sys.argv)>1 else "sumber/Data_Survei_Kos_dan_Hunian_Mahasiswa_UNISSULA.xlsx"
REF=(-6.954194,110.4585)   # titik acuan perkiraan sekitar kampus (dari data simulasi); ganti jika punya titik resmi
LAT=(-7.2,-6.8); LON=(110.3,110.6); JAUH_KM=3.0
DMS=re.compile(r"(\d+)\s*°\s*(\d+)\s*[′']\s*(\d+(?:[.,]\d+)?)\s*[″\"]\s*([A-Za-z]+)")
NUM=re.compile(r"[-+]?\d+(?:[.,]\d+)?")
def parse(v):
    if v is None or str(v).strip()=="": return None,"kosong"
    if isinstance(v,(int,float)): return float(v),""
    s=str(v); m=DMS.search(s)
    if m:
        d,mi,se,h=m.groups(); x=int(d)+int(mi)/60+float(se.replace(",","."))/3600
        return (-x if h.upper() in("S","LS") else x),"dikonversi dari derajat-menit-detik"
    m=NUM.search(s)
    if not m: return None,"tidak terbaca"
    return float(m.group().replace(",",".")),"teks dibersihkan"
def fix(x,rng,kind):
    if x is None: return None,""
    ok=lambda v: rng[0]<=v<=rng[1]
    if ok(x): return x,""
    if kind=="lat" and ok(-x): return -x,"tanda negatif hilang"
    for k in range(1,10):
        y=x/10**k
        if ok(y): return y,"titik desimal hilang"
        if kind=="lat" and ok(-y): return -y,"tanda negatif dan titik desimal hilang"
    return None,"di luar rentang Semarang"
def hav(a,b,c,d):
    p=math.pi/180; h=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 12742*math.asin(math.sqrt(h))
ws=openpyxl.load_workbook(SRC).active
out=[]; seen={}
for i,r in enumerate(ws.iter_rows(min_row=2,values_only=True),start=2):
    if not r[2] or not isinstance(r[1],datetime.datetime): continue
    nama=str(r[2]).strip(); wil=str(r[4] or "").strip()
    la0,ln0=r[10],r[11]
    la,n1=parse(la0); ln,n2=parse(ln0)
    la,f1=fix(la,LAT,"lat"); ln,f2=fix(ln,LON,"lon")
    ctt=[t for t in (n1,n2,f1,f2) if t]; per=[]
    if la is None or ln is None: st="tidak_valid"; per.append("koordinat tidak dapat dipulihkan; wajib survei ulang titik GPS")
    else:
        key=(round(la,5),round(ln,5))
        if key in seen: st="duplikat"; per.append("koordinat sama dengan "+seen[key])
        elif f1 or f2: st="diperbaiki"; per.append("koordinat diperbaiki dengan asumsi; verifikasi di lapangan/peta")
        else: st="valid"
        if st!="duplikat": seen[key]=f"K{i-1:03d}"
    dk=round(hav(REF[0],REF[1],la,ln),2) if la is not None and ln is not None else None
    if dk is not None and dk>JAUH_KM: per.append(f"jauh dari kampus ({dk} km); cek batas AOI")
    if nama.lower()==wil.lower() or len(nama)<3: per.append("nama kemungkinan bukan nama kos")
    if re.search(r"\d",wil): per.append("isian kelurahan memuat nomor/jalan; isi kelurahan resmi")
    if re.search(r"\b(pak|bu|mbak)\b",nama.lower()): per.append("nama memuat nama orang; putuskan boleh dipublikasikan atau tidak")
    ct=str(r[13] or "").strip()
    if "Biaya & Listrik" in ct: ct=""; per.append("kolom catatan berisi teks panduan formulir, dikosongkan")
    if ct in ("-",".","--_--"): ct=""
    out.append(dict(id=f"K{i-1:03d}",nama=nama,wil=wil.title(),wil0=wil,alamat=str(r[5] or "").strip().lstrip(": ").strip(),
      jenis=r[3],bang=r[6],park=r[7],akses=r[8],harga=r[9],lat=la,lon=ln,la0=str(la0),ln0=str(ln0),st=st,ctt="; ".join(ctt),per="; ".join(per),dk=dk,
      foto=(str(r[12] or "").split(",")[0].strip()),tgl=r[1].date().isoformat(),catatan=ct))
feat=[]
for o in out:
    if o["st"] not in("valid","diperbaiki"): continue
    feat.append({"type":"Feature","geometry":{"type":"Point","coordinates":[round(o["lon"],7),round(o["lat"],7)]},"properties":{
      "id_kos":o["id"],"nama_lokasi":o["nama"],"jenis_hunian":o["jenis"],"wilayah":o["wil"],"alamat":o["alamat"],"kondisi_bangunan":o["bang"],
      "parkir":o["park"],"akses_jalan":o["akses"],"kisaran_harga":o["harga"],"catatan":o["catatan"],"foto_url":o["foto"],"tanggal_survei":o["tgl"],
      "sumber_data":"survei_gform","status_koordinat":"diperbaiki" if o["st"]=="diperbaiki" else "asli","jarak_kampus_km":o["dk"]}})
os.makedirs("data",exist_ok=True)
json.dump({"type":"FeatureCollection","features":feat},open("data/kos.geojson","w"),ensure_ascii=False)
if not os.path.exists("data/halte.geojson"): json.dump({"type":"FeatureCollection","features":[]},open("data/halte.geojson","w"))
# ---- workbook audit ----
wb=openpyxl.Workbook(); A=Font(name="Arial",size=10); H=Font(name="Arial",size=10,bold=True,color="FFFFFF"); fill=PatternFill("solid",fgColor="1F3A5F")
d=wb.active; d.title="Data_Bersih"
hd=["ID","Nama","Wilayah (isian)","Alamat","Lat asli","Lon asli","Lat bersih","Lon bersih","Status data","Jenis perbaikan","Jarak ke acuan (km)","Peringatan","Kisaran harga","Tanggal survei"]
d.append(hd)
for o in out: d.append([o["id"],o["nama"],o["wil0"],o["alamat"],o["la0"],o["ln0"],o["lat"],o["lon"],o["st"],o["ctt"],o["dk"],o["per"],o["harga"],o["tgl"]])
for c in d[1]: c.font=H; c.fill=fill; c.alignment=Alignment(wrap_text=True,vertical="center")
for row in d.iter_rows(min_row=2):
    for c in row: c.font=A; c.alignment=Alignment(wrap_text=True,vertical="top")
    row[6].number_format="0.000000"; row[7].number_format="0.000000"
for col,w in zip("ABCDEFGHIJKLMN",(7,26,18,40,22,22,12,12,13,28,12,50,22,12)): d.column_dimensions[col].width=w
d.freeze_panes="C2"; n=len(out)+1
s=wb.create_sheet("Ringkasan",0)
rows=[("Ringkasan audit data survei kos UNISSULA",None),("Jumlah respons terbaca",f"=COUNTA(Data_Bersih!A2:A{n})"),
("Valid (koordinat asli)",f'=COUNTIF(Data_Bersih!I2:I{n},"valid")'),("Diperbaiki (perlu verifikasi)",f'=COUNTIF(Data_Bersih!I2:I{n},"diperbaiki")'),
("Duplikat (dikecualikan)",f'=COUNTIF(Data_Bersih!I2:I{n},"duplikat")'),("Tidak valid (dikecualikan)",f'=COUNTIF(Data_Bersih!I2:I{n},"tidak_valid")'),
("Masuk peta (valid + diperbaiki)","=B3+B4"),("Persen koordinat valid asli dari seluruh respons","=IF(B2=0,0,B3/B2)"),("Target tugas: minimal titik survei",25),
("Selisih terhadap target (negatif = kurang)","=B7-B9")]
for r in rows: s.append(list(r))
s["A1"].font=Font(name="Arial",size=12,bold=True)
for r in range(2,11): s[f"A{r}"].font=A; s[f"B{r}"].font=A
s["B8"].number_format="0.0%"; s["B9"].font=Font(name="Arial",size=10,color="0000FF"); s["C9"]="Asumsi: ketentuan tugas (min. 25 titik survei), dari prompt pengguna"; s["C9"].font=A
s.column_dimensions["A"].width=48; s.column_dimensions["B"].width=14; s.column_dimensions["C"].width=60
a=wb.create_sheet("Aturan_Audit")
for t in ["Rentang valid: lat -7,2 s/d -6,8; lon 110,3 s/d 110,6 (sekitar Kota Semarang). Di luar rentang = tidak valid.",
"Koordinat derajat-menit-detik (mis. 6° 57′ 52″ LS) dikonversi ke desimal.",
"Titik desimal hilang (mis. -69671274 yang seharusnya -6,9671274) diperbaiki dengan membagi 10^k sampai masuk rentang. Ini ASUMSI: status 'diperbaiki', wajib diverifikasi.",
"Lintang positif (mis. 6,967) diubah menjadi negatif karena Semarang di belahan selatan. Status 'diperbaiki'.",
"Koordinat yang sama dengan baris sebelumnya = duplikat, dikecualikan.",
f"Jarak ke titik acuan perkiraan {REF} dihitung dengan haversine; > {JAUH_KM} km hanya diberi peringatan. Batas AOI ditentukan peneliti.",
"Isian kelurahan dari formulir tidak dijadikan kelurahan resmi. Kelurahan resmi harus berasal dari overlay dengan batas administrasi.",
"Tidak ada koordinat yang ditebak untuk baris tidak valid; baris itu perlu disurvei ulang."]: a.append([t])
a.column_dimensions["A"].width=140
for r in a.iter_rows():
    for c in r: c.font=A
wb.save("Audit_Data_Survei_Kos_UNISSULA.xlsx")
from collections import Counter; print(Counter(o["st"] for o in out), len(feat),"masuk peta")
for o in out: print(o["id"],o["st"],o["lat"],o["lon"],"|",o["ctt"],"|",o["per"])
