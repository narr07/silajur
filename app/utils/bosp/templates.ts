// Template naskah surat BOSP (RKAS, SK Tim BOSP, pengadaan, honor, transparansi).
// Dipindahkan dari Ceklis SD supaya semua administrasi BOSP ada di SiLajur.
import type { Block, Sign } from "./blocks";
import type { ProfilSurat as Profil } from "./profil";
import { namaSekolahPendek } from "./profil";
import { hariTgl, rp as rupiah, ejaAngka as terbilang, tglPanjang, tglTerbilang } from "./tanggal";

export type PeranBosp = "kepsek" | "bendahara";

export type FieldType = "text" | "date" | "textarea" | "number";
export interface Field {
	key: string
	label: string
	type?: FieldType
	/** Nilai bawaan; fungsi menerima profil dan tahun anggaran aktif. */
	default?: string | ((p: Profil, ta: number) => string)
	hint?: string
}
export type Values = Record<string, string>;

export interface Template {
	id: string
	judul: string
	kategori: "RKAS" | "SK" | "Keuangan" | "Pengadaan"
	peran: PeranBosp[]
	deskripsi: string
	fields: Field[]
	build: (p: Profil, v: Values) => Block[]
}

export interface Paket {
	id: string
	judul: string
	deskripsi: string
	isi: string[]
	fields: Field[]
}

/* ───────────── helper ───────────── */
const TITIK = "..............................";
const isi = (s?: string) => (s && s.trim()) ? s.trim() : TITIK;
const baris = (s?: string) => (s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const kolom = (s?: string) => baris(s).map((r) => r.split("|").map((c) => c.trim()));
const BUKAN_ANGKA = /[^\d-]/g;
const BUKAN_DESIMAL = /[^\d.]/g;
const SAMPAI_SELESAI = /s\.d\..*/i;
const angka = (s?: string) => Number(String(s || "0").replace(BUKAN_ANGKA, "")) || 0;
const S = (p: Profil) => namaSekolahPendek(p);

function kepsek(p: Profil, atas?: string, pre = ""): Sign {
	return { atas, jabatan: `${pre}Kepala ${S(p)}`, nama: p.kepsek, nip: p.nipKepsek };
}
function bendahara(p: Profil, atas?: string, pre = ""): Sign {
	return { atas, jabatan: `${pre}Bendahara BOSP`, nama: isi(p.bendahara), nip: p.nipBendahara || TITIK };
}
function komite(p: Profil, nama?: string, pre = ""): Sign {
	return { jabatan: `${pre}Ketua Komite Sekolah`, nama: isi(nama || p.komite) };
}
const tempatTgl = (p: Profil, iso: string) => `${p.kota}, ${tglPanjang(iso)}`;

/** Kerangka Surat Keputusan */
function sk(p: Profil, o: { nomor: string, tentang: string, menimbang: string[], mengingat: string[], diktum: [string, string][], tgl: string, lampiran?: Block[] }): Block[] {
	const abc = (xs: string[]) => xs.map((x, i) => `${String.fromCharCode(97 + i)}. ${x}`).join("\n");
	const num = (xs: string[]) => xs.map((x, i) => `${i + 1}. ${x}`).join("\n");
	const out: Block[] = [
		{ t: "kop" },
		{ t: "title", text: `KEPUTUSAN KEPALA ${p.sekolah}`, sub: `NOMOR: ${o.nomor}` },
		{ t: "p", text: "TENTANG", align: "center", bold: true },
		{ t: "p", text: o.tentang.toUpperCase(), align: "center", bold: true },
		{ t: "p", text: `KEPALA ${p.sekolah},`, align: "center", bold: true },
		{ t: "meta", rows: [["Menimbang", abc(o.menimbang)], ["Mengingat", num(o.mengingat)]] },
		{ t: "p", text: "MEMUTUSKAN:", align: "center", bold: true },
		{ t: "meta", rows: [["Menetapkan", o.tentang.toUpperCase()], ...o.diktum], bold: [0] },
		{ t: "sign", right: { atas: `Ditetapkan di ${p.kota}\npada tanggal ${tglPanjang(o.tgl)}`, jabatan: `Kepala ${S(p)},`, nama: p.kepsek, nip: p.nipKepsek } },
		{ t: "p", text: `Tembusan:\n1. Kepala Dinas Pendidikan Kabupaten ${p.kabupaten}\n2. Pengawas Sekolah\n3. Arsip`, italic: true }
	];
	if (o.lampiran) out.push({ t: "break" }, ...o.lampiran);
	return out;
}

/* ───────────── RKAS (dipakai bersama di paket) ───────────── */
export const rkasFields: Field[] = [
	{ key: "ta", label: "Tahun anggaran", default: (_, ta) => String(ta) },
	{ key: "tglSurat", label: "Tanggal surat undangan", type: "date", default: (_, ta) => `${ta}-01-05` },
	{ key: "nomorUndangan", label: "Nomor undangan", default: (p, ta) => `___/___/${p.kodeSurat}/${ta}`, hint: "Pola SE Bupati Majalengka 7/2025: K/N/S/Y. Klik \"Ambil nomor dari Agenda\"." },
	{ key: "nomorBa", label: "Nomor berita acara", default: (p, ta) => `___/BA.___/${p.kodeSurat}/${ta}`, hint: "Pola SE: K/BA.N/S/Y." },
	{ key: "tglRapat", label: "Tanggal rapat", type: "date", default: (_, ta) => `${ta}-01-08` },
	{ key: "waktu", label: "Waktu", default: "Pukul 08.30 WIB s.d. selesai" },
	{ key: "tempat", label: "Tempat", default: (p) => `Ruang Rapat ${S(p)}` },
	{ key: "agenda", label: "Agenda (satu per baris)", type: "textarea", default: (_, ta) => `Evaluasi Rapor Pendidikan dan program sekolah TA ${ta - 1}\nPerencanaan prioritas program kegiatan TA ${ta} (Perencanaan Berbasis Data)\nPembahasan alokasi anggaran BOSP Reguler TA ${ta} sesuai Permendikdasmen 8/2026\nPenyampaian pertimbangan Komite Sekolah\nFinalisasi dan persetujuan draf RKAS 2026` },
	{ key: "komite", label: "Ketua Komite Sekolah", default: (p) => p.komite },
	{ key: "anggotaKomite", label: "Anggota komite / perwakilan orang tua yang diundang (satu per baris)", type: "textarea", default: "" },
	{ key: "notulis", label: "Notulis", default: "" },
	{ key: "nipNotulis", label: "NIP notulis", default: "" },
	{ key: "perwakilanGuru", label: "Perwakilan dewan guru (penandatangan BA)", default: "" },
	{ key: "nipPerwakilan", label: "NIP perwakilan guru", default: "" },
	{ key: "jamSelesai", label: "Rapat selesai pukul", default: "13.00 WIB" },
	{ key: "arahan", label: "Pengarahan kepala sekolah", type: "textarea", default: (_, ta) => `Penyusunan RKAS TA ${ta} wajib mengacu pada Perencanaan Berbasis Data (PBD) dari Rapor Pendidikan dan Juknis BOSP terbaru (Permendikdasmen Nomor 8 Tahun 2026). Prioritas tahun ${ta}: peningkatan literasi dan numerasi, pembelajaran mendalam, sarana pembelajaran digital, serta sanitasi dan lingkungan sekolah ramah anak. Batas komponen wajib dipatuhi: honor paling banyak 20%, buku paling sedikit 10%, dan pemeliharaan sarana prasarana paling banyak 20% dari total alokasi. Belanja barang/jasa mengikuti Permendikdasmen Nomor 15 Tahun 2026.` },
	{ key: "pagu", label: "Estimasi pagu BOSP Reguler (Rp)", type: "number", default: "", hint: "Kosongkan jika belum ada pagu definitif" },
	{ key: "aspirasi", label: "Aspirasi kebutuhan (format: Pengusul|Usulan)", type: "textarea", default: "Guru PJOK|Pengadaan dan peremajaan sarana olahraga (bola voli, bola sepak anak, matras senam, perlengkapan atletik mini) untuk persiapan O2SN\nGuru PAI|Buku Juz Amma, alat peraga praktik ibadah, sound portabel untuk pembiasaan keagamaan, kegiatan PHBI\nGuru Kelas|Buku bacaan penunjang literasi/perpustakaan kelas, kertas dan toner untuk asesmen, perbaikan papan tulis dan pencahayaan kelas" },
	{ key: "pertimbanganKomite", label: "Pertimbangan / masukan Komite Sekolah", type: "textarea", default: "Komite Sekolah mendukung prioritas literasi-numerasi dan sarana pembelajaran, meminta penggunaan dana diumumkan di papan informasi sekolah, serta menegaskan tidak ada pungutan kepada orang tua untuk kegiatan yang sudah dibiayai BOSP." },
	{ key: "keputusan", label: "Kesimpulan & keputusan (satu per baris)", type: "textarea", default: (_, ta) => `Peserta rapat menyetujui Rancangan RKAS TA ${ta} dengan prioritas mutu pembelajaran dan sarana esensial, dengan memperhatikan pertimbangan Komite Sekolah.\nBendahara bersama Tim BOSP menginput kertas kerja ke ARKAS 4 sesuai kode rekening dan batas komponen Juknis BOSP ${ta}.\nBelanja barang/jasa dilaksanakan sesuai Permendikdasmen Nomor 15 Tahun 2026 melalui SIPLah/sistem pembelanjaan kementerian, dengan pembanding minimal dua penyedia.\nRencana dan realisasi penggunaan dana diumumkan di papan informasi sekolah.\nRKAS diajukan untuk pengesahan Dinas Pendidikan Kabupaten melalui ARKAS 4.` },
	{ key: "rincian", label: "Rincian anggaran per komponen (Uraian|Jumlah Rp)", type: "textarea", default: "Penerimaan peserta didik baru|0\nPengembangan perpustakaan (buku min. 10%)|0\nKegiatan pembelajaran dan ekstrakurikuler|0\nKegiatan asesmen/evaluasi pembelajaran|0\nAdministrasi kegiatan sekolah|0\nPengembangan profesi guru dan tenaga kependidikan|0\nLangganan daya dan jasa|0\nPemeliharaan sarana dan prasarana (maks. 20%)|0\nPenyediaan alat multimedia pembelajaran|0\nPembayaran honor (maks. 20% sekolah negeri)|0", hint: "Sesuaikan nama komponen dengan Lampiran I Permendikdasmen 8/2026 dan kertas kerja ARKAS" },
	{ key: "kadis", label: "Nama Kepala Dinas Pendidikan (pengesahan)", default: "" },
	{ key: "nipKadis", label: "NIP Kepala Dinas", default: "" },
	{ key: "jumlahFoto", label: "Jumlah kotak foto dokumentasi", type: "number", default: "4" }
];

function pesertaRapat(p: Profil, v: Values) {
	const rows = p.gtk.map((g) => ({ nama: g.nama, ket: g.jabatan, nip: g.nip }));
	rows.push({ nama: isi(v.komite), ket: "Ketua Komite Sekolah", nip: "-" });
	for (const a of baris(v.anggotaKomite)) rows.push({ nama: a, ket: "Komite Sekolah / Orang Tua", nip: "-" });
	if (!baris(v.anggotaKomite).length) {
		rows.push({ nama: TITIK, ket: "Anggota Komite Sekolah", nip: "-" });
		rows.push({ nama: TITIK, ket: "Perwakilan Orang Tua/Wali", nip: "-" });
	}
	return rows;
}

function rincianTabel(v: Values): Block {
	const r = kolom(v.rincian);
	const total = r.reduce((s, x) => s + angka(x[1]), 0);
	return {
		t: "table",
		head: ["No", "Uraian Komponen", "Jumlah (Rp)", "%"],
		widths: [8, 57, 22, 13],
		rows: [
			...r.map((x, i) => [String(i + 1), x[0] || "", angka(x[1]).toLocaleString("id-ID"), total ? `${(angka(x[1]) / total * 100).toFixed(1)}%` : "-"]),
			["", "**JUMLAH**", `**${total.toLocaleString("id-ID")}**`, total ? "100%" : "-"]
		]
	};
}

const rkas: Template[] = [
	{
		id: "rkas-undangan",
		judul: "Undangan Rapat Penyusunan RKAS",
		kategori: "RKAS",
		peran: ["kepsek"],
		deskripsi: "Undangan untuk GTK dan Komite Sekolah, dengan lampiran daftar undangan.",
		fields: rkasFields,
		build: (p, v) => [
			{ t: "kop" },
			{ t: "p", text: tempatTgl(p, v.tglSurat!), align: "right" },
			{ t: "meta", rows: [["Nomor", v.nomorUndangan!], ["Sifat", "Penting"], ["Lampiran", "1 (satu) lembar"], ["Perihal", `**Undangan Rapat Penyusunan Rencana Kegiatan dan Anggaran Sekolah (RKAS) Tahun Anggaran ${v.ta}**`]] },
			{ t: "space" },
			{ t: "p", text: `Kepada Yth.\nBapak/Ibu Guru dan Tenaga Kependidikan\nKetua dan Anggota Komite Sekolah\n(Daftar terlampir)\ndi Tempat` },
			{ t: "space" },
			{ t: "p", text: "Dengan hormat," },
			{ t: "p", text: `Dalam rangka perencanaan dan pengelolaan dana operasional sekolah yang transparan, akuntabel, dan berbasis data Rapor Pendidikan, sesuai Permendikdasmen Nomor 8 Tahun 2026 tentang Petunjuk Teknis Pengelolaan Dana BOSP, kami mengundang Bapak/Ibu untuk hadir pada Rapat Penyusunan RKAS Tahun Anggaran ${v.ta} yang akan dilaksanakan pada:`, align: "justify", indent: true },
			{ t: "meta", rows: [["Hari/Tanggal", `**${hariTgl(v.tglRapat!)}**`], ["Waktu", v.waktu!], ["Tempat", v.tempat!], ["Agenda", baris(v.agenda).map((a, i) => `${i + 1}. ${a}`).join("\n")], ["Catatan", "Guru membawa daftar usulan kebutuhan kelas/mata pelajaran; Komite Sekolah menyampaikan pertimbangan."]] },
			{ t: "p", text: "Mengingat pentingnya acara tersebut, dimohon kehadiran Bapak/Ibu tepat pada waktunya. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.", align: "justify", indent: true },
			{ t: "sign", right: kepsek(p, undefined, "") },
			{ t: "break" },
			{ t: "kop" },
			{ t: "p", text: `**LAMPIRAN SURAT UNDANGAN**\nNomor : ${v.nomorUndangan}\nTanggal : ${tglPanjang(v.tglSurat!)}\nPerihal : Daftar Undangan Rapat Penyusunan RKAS TA ${v.ta}` },
			{ t: "table", head: ["No", "Nama", "NIP", "Jabatan / Unsur"], widths: [7, 40, 25, 28], rows: pesertaRapat(p, v).map((r, i) => [String(i + 1), r.nama, r.nip, r.ket]) },
			{ t: "sign", right: kepsek(p) }
		]
	},
	{
		id: "rkas-daftar-hadir",
		judul: "Daftar Hadir Rapat RKAS",
		kategori: "RKAS",
		peran: ["kepsek"],
		deskripsi: "Daftar hadir bertanda tangan untuk GTK, komite, dan perwakilan orang tua.",
		fields: rkasFields,
		build: (p, v) => [
			{ t: "kop" },
			{ t: "title", text: "DAFTAR HADIR", sub: `RAPAT PENYUSUNAN RKAS TAHUN ANGGARAN ${v.ta}` },
			{ t: "meta", rows: [["Hari/Tanggal", hariTgl(v.tglRapat!)], ["Waktu", v.waktu!], ["Tempat", v.tempat!]] },
			{ t: "table", head: ["No", "Nama", "Jabatan / Unsur", "Tanda Tangan"], widths: [7, 38, 27, 28], tall: true, rows: pesertaRapat(p, v).map((r, i) => [String(i + 1), r.nama, r.ket, i % 2 === 0 ? `${i + 1}. ........` : `              ${i + 1}. ........`]) },
			{ t: "sign", right: kepsek(p, tempatTgl(p, v.tglRapat!)) }
		]
	},
	{
		id: "rkas-notulen",
		judul: "Notulen Rapat RKAS",
		kategori: "RKAS",
		peran: ["kepsek"],
		deskripsi: "Notulen lengkap termasuk pertimbangan komite dan TTD notulis.",
		fields: rkasFields,
		build: (p, v) => {
			const pagu = angka(v.pagu);
			return [
				{ t: "kop" },
				{ t: "title", text: "NOTULEN RAPAT", sub: `PENYUSUNAN RENCANA KEGIATAN DAN ANGGARAN SEKOLAH (RKAS)\nTAHUN ANGGARAN ${v.ta}` },
				{ t: "meta", rows: [["Hari/Tanggal", hariTgl(v.tglRapat!)], ["Waktu", `${v.waktu!.replace(SAMPAI_SELESAI, "s.d.")} ${v.jamSelesai}`], ["Tempat", v.tempat!], ["Pemimpin Rapat", `${p.kepsek} (Kepala Sekolah)`], ["Notulis", v.notulis!], ["Peserta", `${pesertaRapat(p, v).length} orang (GTK dan Komite Sekolah, daftar hadir terlampir)`]] },
				{ t: "p", text: "**A. SUSUNAN ACARA**" },
				{ t: "list", style: "num", items: ["Pembukaan", "Pengarahan kepala sekolah", ...baris(v.agenda), "Tanya jawab, pembacaan kesimpulan, dan penutup"] },
				{ t: "p", text: "**B. JALANNYA RAPAT**" },
				{ t: "p", text: "**1. Pengarahan Kepala Sekolah**" },
				{ t: "p", text: v.arahan!, align: "justify", indent: true },
				{ t: "p", text: "**2. Estimasi Penerimaan Dana BOSP**" },
				{ t: "p", text: pagu ? `Berdasarkan data Dapodik cut-off 31 Agustus tahun sebelumnya, estimasi pagu BOSP Reguler TA ${v.ta} sebesar ${rupiah(pagu)} (${terbilang(pagu)} Rupiah).` : `Alokasi BOSP Reguler TA ${v.ta} dihitung berdasarkan data Dapodik cut-off 31 Agustus tahun sebelumnya. Pagu definitif mengikuti penetapan kementerian dan akan disesuaikan di ARKAS.`, align: "justify", indent: true },
				{ t: "p", text: "**3. Penjaringan Aspirasi Kebutuhan**" },
				{ t: "table", head: ["No", "Pengusul", "Usulan Kebutuhan"], widths: [7, 33, 60], rows: kolom(v.aspirasi).map((r, i) => [String(i + 1), r[0] || "", r[1] || ""]) },
				{ t: "p", text: "**4. Pertimbangan Komite Sekolah**" },
				{ t: "p", text: v.pertimbanganKomite!, align: "justify", indent: true },
				{ t: "p", text: "**C. KESIMPULAN DAN KEPUTUSAN**" },
				{ t: "list", style: "num", items: baris(v.keputusan) },
				{ t: "sign", left: { jabatan: "Notulis,", nama: v.notulis!, nip: v.nipNotulis }, right: kepsek(p, tempatTgl(p, v.tglRapat!), "Mengetahui,\n") }
			];
		}
	},
	{
		id: "rkas-berita-acara",
		judul: "Berita Acara Penyusunan RKAS",
		kategori: "RKAS",
		peran: ["kepsek"],
		deskripsi: "BA dengan tanda tangan kepala sekolah, komite, dan perwakilan guru.",
		fields: rkasFields,
		build: (p, v) => {
			const total = kolom(v.rincian).reduce((s, x) => s + angka(x[1]), 0) || angka(v.pagu);
			return [
				{ t: "kop" },
				{ t: "title", text: "BERITA ACARA", sub: `RAPAT PENYUSUNAN DAN PERSETUJUAN\nRENCANA KEGIATAN DAN ANGGARAN SEKOLAH (RKAS)\nTAHUN ANGGARAN ${v.ta}` },
				{ t: "p", text: `Nomor: ${v.nomorBa || TITIK}`, align: "center", italic: true },
				{ t: "p", text: `Pada hari ini ${tglTerbilang(v.tglRapat!)}, bertempat di ${v.tempat}, telah dilaksanakan Rapat Dewan Guru bersama Komite Sekolah dan Tim Pengelola Dana BOSP ${S(p)} untuk membahas dan menyetujui Rencana Kegiatan dan Anggaran Sekolah (RKAS) Tahun Anggaran ${v.ta}${total ? ` sebesar ${rupiah(total)} (${terbilang(total)} Rupiah)` : ""}.`, align: "justify", indent: true },
				{ t: "p", text: "Rapat dihadiri oleh kepala sekolah, guru, tenaga kependidikan, dan Komite Sekolah sebagaimana tercantum dalam daftar hadir terlampir. Berdasarkan musyawarah mufakat dan setelah memperhatikan pertimbangan Komite Sekolah, disepakati hal-hal berikut:", align: "justify", indent: true },
				{ t: "list", style: "num", items: [
					`Menyetujui Rancangan RKAS Tahun Anggaran ${v.ta} sebagai pedoman pelaksanaan program dan penggunaan dana sekolah selama satu tahun anggaran.`,
					"Alokasi anggaran disusun berdasarkan prioritas hasil Perencanaan Berbasis Data (Rapor Pendidikan) dan memenuhi batas komponen Permendikdasmen Nomor 8 Tahun 2026.",
					"Belanja barang/jasa dilaksanakan sesuai Permendikdasmen Nomor 15 Tahun 2026, dan rencana serta realisasi penggunaan dana diumumkan kepada warga sekolah.",
					"RKAS diajukan untuk pengesahan Dinas Pendidikan melalui aplikasi ARKAS 4.",
					"Apabila terjadi perubahan kebijakan atau pagu definitif, dilakukan pergeseran/perubahan RKAS sesuai ketentuan."
				] },
				{ t: "p", text: "Demikian berita acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.", align: "justify", indent: true },
				{ t: "sign", left: komite(p, v.komite), right: kepsek(p, tempatTgl(p, v.tglRapat!)) },
				{ t: "sign", center: { jabatan: "Perwakilan Dewan Guru,", nama: v.perwakilanGuru!, nip: v.nipPerwakilan } }
			];
		}
	},
	{
		id: "rkas-pengesahan",
		judul: "Lembar Pengesahan RKAS",
		kategori: "RKAS",
		peran: ["kepsek", "bendahara"],
		deskripsi: "Ringkasan anggaran per komponen dengan TTD bendahara, kepsek, komite, dan dinas.",
		fields: rkasFields,
		build: (p, v) => [
			{ t: "kop" },
			{ t: "title", text: "LEMBAR PENGESAHAN", sub: `RENCANA KEGIATAN DAN ANGGARAN SEKOLAH (RKAS)\nTAHUN ANGGARAN ${v.ta}` },
			{ t: "meta", rows: [["Satuan Pendidikan", `${S(p)} (NPSN ${p.npsn})`], ["Sumber Dana", "BOSP Reguler"]] },
			rincianTabel(v),
			{ t: "p", text: "Catatan: honor paling banyak 20% (negeri), buku paling sedikit 10%, pemeliharaan sarpras paling banyak 20% dari total alokasi (Permendikdasmen 8/2026 Pasal 42).", italic: true },
			{ t: "sign", left: bendahara(p, " ", "Disusun oleh,\n"), right: kepsek(p, tempatTgl(p, v.tglRapat!)) },
			{ t: "sign", left: komite(p, v.komite, "Menyetujui,\n"), right: { jabatan: `Mengesahkan,\nKepala Dinas Pendidikan\nKabupaten ${p.kabupaten}`, nama: isi(v.kadis), nip: v.nipKadis || TITIK } }
		]
	},
	{
		id: "rkas-dokumentasi",
		judul: "Lampiran Dokumentasi Rapat RKAS",
		kategori: "RKAS",
		peran: ["kepsek"],
		deskripsi: "Halaman kotak foto berketerangan untuk ditempel di Word.",
		fields: rkasFields,
		build: (p, v) => [
			{ t: "kop" },
			{ t: "title", text: "DOKUMENTASI KEGIATAN", sub: `RAPAT PENYUSUNAN RKAS TA ${v.ta}\n${hariTgl(v.tglRapat!)}` },
			{ t: "photos", n: Math.max(2, Math.min(8, angka(v.jumlahFoto) || 4)), captions: ["Pembukaan dan pengarahan kepala sekolah", "Pemaparan Rapor Pendidikan", "Penjaringan aspirasi guru", "Pertimbangan Komite Sekolah", "Penandatanganan berita acara", "Peserta rapat"] },
			{ t: "sign", right: kepsek(p, tempatTgl(p, v.tglRapat!), "Mengetahui,\n") }
		]
	}
];

/* ───────────── SK ───────────── */
const mengingatUmum = [
	"Undang-Undang Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional",
	"Peraturan Pemerintah Nomor 57 Tahun 2021 tentang Standar Nasional Pendidikan sebagaimana telah diubah"
];

const skTemplates: Template[] = [
	{
		id: "sk-tim-bosp",
		judul: "SK Tim Pengelola Dana BOSP",
		kategori: "SK",
		peran: ["kepsek"],
		deskripsi: "Penanggung jawab, bendahara, anggota guru, unsur komite & orang tua.",
		fields: [
			{ key: "nomor", label: "Nomor SK", default: (p, ta) => `___/Kep.___-${p.kodeSurat}/${ta}`, hint: "Pola SE Bupati Majalengka 7/2025: K/Kep.N-S/Y. Klik \"Ambil nomor dari Agenda\"." },
			{ key: "tgl", label: "Tanggal penetapan", type: "date", default: (_, ta) => `${ta}-01-02` },
			{ key: "ta", label: "Tahun anggaran", default: (_, ta) => String(ta) },
			{ key: "anggota", label: "Anggota (Nama|Unsur|Tugas)", type: "textarea", default: (p) => `${p.operator || TITIK}|Guru/Operator|Pendataan Dapodik & publikasi penggunaan dana\n${TITIK}|Guru|Sekretaris, notulensi & administrasi SPJ\n${p.komite || TITIK}|Komite Sekolah|Pertimbangan dan pengawasan penggunaan dana\n${TITIK}|Orang Tua/Wali|Pengawasan dan penyampaian aspirasi orang tua` }
		],
		build: (p, v) => sk(p, {
			nomor: v.nomor!,
			tgl: v.tgl!,
			tentang: `Pembentukan Tim Pengelola Dana Bantuan Operasional Satuan Pendidikan (BOSP) ${S(p)} Tahun Anggaran ${v.ta}`,
			menimbang: [
				"bahwa dana BOSP harus dikelola secara fleksibel, efektif, efisien, akuntabel, dan transparan;",
				`bahwa untuk itu perlu dibentuk Tim Pengelola Dana BOSP ${S(p)} yang ditetapkan dengan Keputusan Kepala Sekolah.`
			],
			mengingat: [...mengingatUmum, "Peraturan Menteri Pendidikan Dasar dan Menengah Nomor 8 Tahun 2026 tentang Petunjuk Teknis Pengelolaan Dana Bantuan Operasional Satuan Pendidikan", "Peraturan Menteri Pendidikan Dasar dan Menengah Nomor 15 Tahun 2026 tentang belanja barang/jasa satuan pendidikan"],
			diktum: [
				["KESATU", `Membentuk Tim Pengelola Dana BOSP ${S(p)} Tahun Anggaran ${v.ta} dengan susunan sebagaimana tercantum dalam lampiran keputusan ini.`],
				["KEDUA", "Tim bertugas menyusun RKAS di ARKAS, melaksanakan belanja sesuai ketentuan, menatausahakan dan melaporkan penggunaan dana, serta mengumumkan rencana dan realisasi penggunaan dana."],
				["KETIGA", "Segala biaya yang timbul akibat keputusan ini dibebankan pada anggaran yang sesuai."],
				["KEEMPAT", "Keputusan ini berlaku sejak tanggal ditetapkan dengan ketentuan apabila terdapat kekeliruan akan diperbaiki sebagaimana mestinya."]
			],
			lampiran: [
				{ t: "p", text: `**LAMPIRAN KEPUTUSAN KEPALA ${p.sekolah}**\nNomor : ${v.nomor}\nTanggal : ${tglPanjang(v.tgl!)}` },
				{ t: "title", text: `SUSUNAN TIM PENGELOLA DANA BOSP TA ${v.ta}` },
				{ t: "table", head: ["No", "Nama", "Unsur", "Kedudukan / Tugas"], widths: [7, 35, 20, 38], rows: [
					["1", p.kepsek, "Kepala Sekolah", "Penanggung jawab"],
					["2", isi(p.bendahara), "Guru/Tendik", "Bendahara BOSP"],
					...kolom(v.anggota).map((r, i) => [String(i + 3), r[0] || "", r[1] || "", `Anggota: ${r[2] || ""}`])
				] },
				{ t: "sign", right: kepsek(p) }
			]
		})
	}
];

/* ───────────── Keuangan & Pengadaan ───────────── */
const itemsField = (def: string): Field => ({ key: "items", label: "Barang/jasa (Nama|Spesifikasi|Jumlah|Satuan|Harga satuan)", type: "textarea", default: def });
const itemRows = (v: Values) => {
	const r = kolom(v.items);
	const total = r.reduce((s, x) => s + angka(x[2]) * angka(x[4]), 0);
	return { r, total };
};

const keuangan: Template[] = [
	{
		id: "persiapan-pengadaan",
		judul: "Dokumen Persiapan Belanja Barang/Jasa",
		kategori: "Pengadaan",
		peran: ["bendahara", "kepsek"],
		deskripsi: "Wajib untuk belanja di atas Rp1 juta (Permendikdasmen 15/2026 Pasal 12–13).",
		fields: [
			{ key: "tgl", label: "Tanggal", type: "date", default: (_, ta) => `${ta}-11-16` },
			{ key: "paket", label: "Nama paket belanja", default: "Pengadaan sarana olahraga" },
			{ key: "kegiatan", label: "Kegiatan/kode di RKAS", default: "Kegiatan pembelajaran dan ekstrakurikuler" },
			{ key: "waktu", label: "Waktu penyerahan yang dibutuhkan", default: "Paling lambat 14 hari kalender" },
			{ key: "lokasi", label: "Lokasi penyerahan", default: (p) => S(p) },
			itemsField("Bola voli|Ukuran 5, bahan sintetis|3|buah|185000\nBola sepak anak|Ukuran 4|4|buah|150000\nMatras senam|180x60x5 cm|2|lembar|450000")
		],
		build: (p, v) => {
			const { r, total } = itemRows(v);
			return [
				{ t: "kop" },
				{ t: "title", text: "DOKUMEN PERSIAPAN BELANJA BARANG/JASA", sub: "Permendikdasmen Nomor 15 Tahun 2026" },
				{ t: "meta", rows: [["Nama paket", v.paket!], ["Kegiatan RKAS", v.kegiatan!], ["Sumber dana", "BOSP Reguler"], ["Perkiraan anggaran", `${rupiah(total)} (${terbilang(total)} Rupiah)`], ["Waktu penyerahan", v.waktu!], ["Lokasi", v.lokasi!]] },
				{ t: "p", text: "**A. Kebutuhan dan Spesifikasi**" },
				{ t: "table", head: ["No", "Barang/Jasa", "Spesifikasi", "Jml", "Satuan", "Harga Satuan", "Jumlah"], widths: [5, 20, 25, 7, 10, 15, 18], rows: [
					...r.map((x, i) => [String(i + 1), x[0] || "", x[1] || "", x[2] || "", x[3] || "", angka(x[4]).toLocaleString("id-ID"), (angka(x[2]) * angka(x[4])).toLocaleString("id-ID")]),
					["", "**TOTAL**", "", "", "", "", `**${total.toLocaleString("id-ID")}**`]
				] },
				{ t: "p", text: "**B. Persyaratan Penyedia**" },
				{ t: "list", style: "num", items: ["Memiliki NPWP dan identitas yang jelas.", "Mampu menyediakan barang/jasa sesuai spesifikasi, jumlah, dan waktu.", "Diutamakan usaha mikro/kecil setempat atau penyedia di SIPLah/sistem pembelanjaan kementerian.", "Dibandingkan minimal 2 (dua) penyedia."] },
				{ t: "sign", left: bendahara(p, " ", "Disiapkan oleh,\n"), right: kepsek(p, tempatTgl(p, v.tgl!), "Disetujui,\n") }
			];
		}
	},
	{
		id: "ba-perbandingan",
		judul: "BA Hasil Perbandingan Penyedia",
		kategori: "Pengadaan",
		peran: ["bendahara", "kepsek"],
		deskripsi: "Perbandingan minimal 2 penyedia + negosiasi (Pasal 14–17).",
		fields: [
			{ key: "tgl", label: "Tanggal", type: "date", default: (_, ta) => `${ta}-11-17` },
			{ key: "paket", label: "Nama paket belanja", default: "Pengadaan sarana olahraga" },
			{ key: "penyedia", label: "Penyedia (Nama|Alamat|NPWP|Harga penawaran|Waktu kirim)", type: "textarea", default: "Toko A|Alamat Toko A|..............|3.255.000|7 hari\nToko B|Alamat Toko B|..............|3.400.000|10 hari" },
			{ key: "terpilih", label: "Penyedia terpilih", default: "Toko A" },
			{ key: "hargaNego", label: "Harga setelah negosiasi (Rp)", type: "number", default: "3200000" },
			{ key: "alasan", label: "Alasan pemilihan", type: "textarea", default: "Harga paling rendah, spesifikasi sesuai, dan waktu penyerahan paling cepat." }
		],
		build: (p, v) => {
			const n = angka(v.hargaNego);
			return [
				{ t: "kop" },
				{ t: "title", text: "BERITA ACARA HASIL PERBANDINGAN PENYEDIA" },
				{ t: "p", text: `Pada hari ini ${tglTerbilang(v.tgl!)}, telah dilakukan perbandingan penyedia untuk paket **${v.paket}** dengan hasil sebagai berikut:`, align: "justify", indent: true },
				{ t: "table", head: ["No", "Penyedia", "Alamat", "NPWP", "Harga (Rp)", "Waktu"], widths: [6, 22, 20, 20, 17, 15], rows: kolom(v.penyedia).map((r, i) => [String(i + 1), r[0] || "", r[1] || "", r[2] || "", r[3] || "", r[4] || ""]) },
				{ t: "p", text: `Setelah dilakukan negosiasi, ditetapkan **${v.terpilih}** sebagai penyedia dengan harga ${rupiah(n)} (${terbilang(n)} Rupiah).`, align: "justify", indent: true },
				{ t: "p", text: `Alasan: ${v.alasan}`, align: "justify" },
				{ t: "sign", left: bendahara(p, " ", "Pelaksana,\n"), right: kepsek(p, tempatTgl(p, v.tgl!), "Menetapkan,\n") }
			];
		}
	},
	{
		id: "papan-informasi",
		judul: "Pengumuman Penggunaan Dana BOSP",
		kategori: "Keuangan",
		peran: ["bendahara", "kepsek"],
		deskripsi: "Untuk papan informasi sekolah (transparansi).",
		fields: [
			{ key: "tgl", label: "Tanggal", type: "date", default: (_, ta) => `${ta}-11-15` },
			{ key: "ta", label: "Tahun anggaran", default: (_, ta) => String(ta) },
			{ key: "tahap1", label: "Penerimaan tahap I (Rp)", type: "number", default: "0" },
			{ key: "tahap2", label: "Penerimaan tahap II (Rp)", type: "number", default: "0" },
			{ key: "rincian", label: "Komponen (Uraian|Rencana|Realisasi)", type: "textarea", default: "Pengembangan perpustakaan|0|0\nKegiatan pembelajaran dan ekstrakurikuler|0|0\nKegiatan asesmen/evaluasi|0|0\nAdministrasi kegiatan sekolah|0|0\nPengembangan profesi GTK|0|0\nLangganan daya dan jasa|0|0\nPemeliharaan sarana dan prasarana|0|0\nPembayaran honor|0|0" }
		],
		build: (p, v) => {
			const r = kolom(v.rincian);
			const rr = r.reduce((s, x) => s + angka(x[1]), 0);
			const re = r.reduce((s, x) => s + angka(x[2]), 0);
			return [
				{ t: "kop" },
				{ t: "title", text: "PENGUMUMAN", sub: `RENCANA DAN REALISASI PENGGUNAAN DANA BOSP REGULER\nTAHUN ANGGARAN ${v.ta}` },
				{ t: "meta", rows: [["Penerimaan tahap I", rupiah(angka(v.tahap1))], ["Penerimaan tahap II", rupiah(angka(v.tahap2))], ["Total penerimaan", `**${rupiah(angka(v.tahap1) + angka(v.tahap2))}**`]] },
				{ t: "table", head: ["No", "Komponen", "Rencana (Rp)", "Realisasi (Rp)"], widths: [7, 49, 22, 22], rows: [
					...r.map((x, i) => [String(i + 1), x[0] || "", angka(x[1]).toLocaleString("id-ID"), angka(x[2]).toLocaleString("id-ID")]),
					["", "**JUMLAH**", `**${rr.toLocaleString("id-ID")}**`, `**${re.toLocaleString("id-ID")}**`]
				] },
				{ t: "p", text: "Masyarakat dapat menyampaikan pertanyaan atau pengaduan kepada kepala sekolah atau Komite Sekolah.", italic: true },
				{ t: "sign", left: bendahara(p, " "), right: kepsek(p, tempatTgl(p, v.tgl!)) }
			];
		}
	},
	{
		id: "daftar-honor",
		judul: "Daftar Penerimaan Honorarium (PPh 21 TER)",
		kategori: "Keuangan",
		peran: ["bendahara", "kepsek"],
		deskripsi: "Daftar tanda terima honor bulanan dengan perhitungan otomatis PPh 21 TER dan jumlah bersih.",
		fields: [
			{ key: "tgl", label: "Tanggal pembayaran", type: "date", default: (_, ta) => `${ta}-11-15` },
			{ key: "bulan", label: "Bulan / periode", default: (_, ta) => `November ${ta}` },
			{ key: "kegiatan", label: "Nama kegiatan / mata anggaran", default: "Pembayaran Honorarium Guru Tidak Tetap / Tenaga Kependidikan" },
			{ key: "daftar", label: "Penerima (Nama|Jabatan/NUPTK|Bruto|Tarif PPh %)", type: "textarea", default: "Nama Penerima Honor|Guru Agama Islam / NUPTK|1500000|0", hint: "Tarif PPh 21 TER kategori A: 0% untuk bruto s.d. Rp5.400.000/bulan (sesuai PP 58/2023)." }
		],
		build: (p, v) => {
			const rows = kolom(v.daftar).map((x, i) => {
				const bruto = angka(x[2]);
				const tarif = Number(String(x[3] || "0").replace(BUKAN_DESIMAL, "")) || 0;
				const pph = Math.round(bruto * tarif / 100);
				const bersih = bruto - pph;
				return { no: String(i + 1), nama: x[0] || "", jabatan: x[1] || "", bruto, tarif, pph, bersih };
			});
			const totBruto = rows.reduce((s, r) => s + r.bruto, 0);
			const totPph = rows.reduce((s, r) => s + r.pph, 0);
			const totBersih = rows.reduce((s, r) => s + r.bersih, 0);
			return [
				{ t: "kop" },
				{ t: "title", text: "DAFTAR PENERIMAAN HONORARIUM", sub: `BULAN ${String(v.bulan || "").toUpperCase()}` },
				{ t: "meta", rows: [["Satuan Pendidikan", p.sekolah], ["NPSN", p.npsn], ["Kegiatan", v.kegiatan || ""], ["Sumber Dana", "Dana BOSP Reguler"]] },
				{
					t: "table",
					head: ["No", "Nama", "Jabatan / NUPTK", "Bruto (Rp)", "PPh 21 TER", "Diterima (Rp)", "Tanda Tangan"],
					widths: [6, 20, 22, 13, 13, 14, 12],
					tall: true,
					rows: [
						...rows.map((r) => [r.no, r.nama, r.jabatan, r.bruto.toLocaleString("id-ID"), `${r.pph.toLocaleString("id-ID")} (${r.tarif}%)`, r.bersih.toLocaleString("id-ID"), `${r.no}.`]),
						["", "**JUMLAH**", "", `**${totBruto.toLocaleString("id-ID")}**`, `**${totPph.toLocaleString("id-ID")}**`, `**${totBersih.toLocaleString("id-ID")}**`, ""]
					]
				},
				{ t: "p", text: `Terbilang dibayarkan bersih: **${terbilang(totBersih)} Rupiah**.`, italic: true },
				{ t: "sign", left: kepsek(p, "Mengetahui/Menyetujui,", ""), right: bendahara(p, tempatTgl(p, v.tgl!), "Lunas dibayar,\n") }
			];
		}
	},
	{
		id: "spj-honor",
		judul: "SPJ Pembayaran Honorarium",
		kategori: "Keuangan",
		peran: ["bendahara", "kepsek"],
		deskripsi: "Rekapitulasi pertanggungjawaban belanja honorarium bulanan beserta potongan pajak untuk arsip BOSP.",
		fields: [
			{ key: "tgl", label: "Tanggal SPJ", type: "date", default: (_, ta) => `${ta}-11-15` },
			{ key: "nomor", label: "Nomor bukti / BKU", default: (_, ta) => `BKU-011/${ta}` },
			{ key: "bulan", label: "Bulan / periode", default: (_, ta) => `November ${ta}` },
			{ key: "kodeRekening", label: "Kode rekening ARKAS", default: "5.1.02.02.01.0013" },
			{ key: "uraian", label: "Uraian belanja", default: "Belanja Jasa Tenaga Pendidikan (Honorarium GTT/PTT)" },
			{ key: "bruto", label: "Jumlah bruto (Rp)", type: "number", default: "1500000" },
			{ key: "pph21", label: "Potongan PPh 21 TER (Rp)", type: "number", default: "0" },
			{ key: "kodeBilling", label: "Nomor NTPN / kode billing (jika ada)", default: "-" }
		],
		build: (p, v) => {
			const bruto = angka(v.bruto);
			const pph = angka(v.pph21);
			const bersih = bruto - pph;
			return [
				{ t: "kop" },
				{ t: "title", text: "SURAT PERTANGGUNGJAWABAN (SPJ) HONORARIUM", sub: `Nomor: ${v.nomor}` },
				{ t: "p", text: `Yang bertanda tangan di bawah ini Bendahara BOSP ${S(p)} menyatakan bahwa telah dilakukan pembayaran honorarium untuk periode **${v.bulan}** dengan rincian sebagai berikut:` },
				{ t: "meta", rows: [
					["Kode Rekening", v.kodeRekening || ""],
					["Uraian Belanja", v.uraian || ""],
					["Jumlah Bruto", rupiah(bruto)],
					["Potongan PPh 21 TER", rupiah(pph)],
					["Jumlah Dibayarkan Bersih", `**${rupiah(bersih)}** (${terbilang(bersih)} Rupiah)`],
					["Kode Billing / NTPN", v.kodeBilling || "-"]
				] },
				{ t: "p", text: "Lampiran kelengkapan SPJ:" },
				{ t: "list", style: "num", items: [
					"SK Kepala Sekolah tentang Penugasan / Pembagian Tugas Mengajar.",
					"Daftar Penerimaan Honorarium yang ditandatangani masing-masing penerima.",
					"Daftar hadir / rekapitulasi jam kerja periode berkenaan.",
					"Bukti potong PPh 21 (e-Bupot Coretax DJP) dan bukti setor pajak (jika terutang)."
				] },
				{ t: "sign", left: kepsek(p, "Mengetahui/Menyetujui,\n", ""), right: bendahara(p, tempatTgl(p, v.tgl!)) }
			];
		}
	}
];

export const templates: Template[] = [...rkas, ...skTemplates, ...keuangan];

export const paket: Paket[] = [
	{
		id: "paket-rkas",
		judul: "Paket Dokumen Rapat RKAS Lengkap",
		deskripsi: "Undangan + lampiran, daftar hadir, notulen, berita acara, lembar pengesahan, dan dokumentasi dalam satu file Word.",
		isi: ["rkas-undangan", "rkas-daftar-hadir", "rkas-notulen", "rkas-berita-acara", "rkas-pengesahan", "rkas-dokumentasi"],
		fields: rkasFields
	}
];

export function cariDokumen(id: string) {
	const t = templates.find((x) => x.id === id);
	if (t) return { judul: t.judul, deskripsi: t.deskripsi, fields: t.fields, build: t.build, paket: false };
	const k = paket.find((x) => x.id === id);
	if (!k) return null;
	return {
		judul: k.judul,
		deskripsi: k.deskripsi,
		fields: k.fields,
		paket: true,
		build: (p: Profil, v: Values) => k.isi.flatMap((tid, i) => {
			const blocks = templates.find((x) => x.id === tid)!.build(p, v);
			return i === 0 ? blocks : [{ t: "break" } as Block, ...blocks];
		})
	};
}

export function nilaiAwal(fields: Field[], p: Profil, ta: number): Values {
	return Object.fromEntries(fields.map((f) => [f.key, typeof f.default === "function" ? f.default(p, ta) : (f.default ?? "")]));
}
