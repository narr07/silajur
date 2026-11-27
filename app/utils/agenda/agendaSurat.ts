// Agenda surat masuk & keluar, format JSON yang SAMA dengan Ceklis SD (satu berkas per sekolah di
// Google Drive). Disalin dari Ceklis SD tanpa penyusun naskah cetak; jaga keduanya tetap sejalan.
export const FORMAT_AGENDA = "ceklis-agenda-surat";

export type JenisSurat = "masuk" | "keluar";
export const SIFAT_SURAT = ["Biasa", "Penting", "Segera", "Rahasia"] as const;
export type SifatSurat = typeof SIFAT_SURAT[number];

/** Scan surat di Google Drive. */
export interface LampiranSurat {
	id: string
	nama: string
}

interface SuratDasar {
	id: string
	/** Nomor urut agenda dalam satu tahun. */
	noAgenda: number
	tahun: number
	noSurat: string
	tglSurat: string
	perihal: string
	sifat: SifatSurat
	/** Jumlah lampiran fisik surat, mis. "1 berkas". */
	jumlahLampiran: string
	keterangan: string
	lampiran: LampiranSurat[]
	dibuat: string
	diubah: string
}

export interface SuratMasuk extends SuratDasar {
	tglTerima: string
	pengirim: string
	disposisiKepada: string
	isiDisposisi: string
	/** Kode klasifikasi arsip untuk pemberkasan (boleh kosong). */
	kodeKlasifikasi: string
}

/**
 * Pola nomor naskah dinas keluar menurut SE Bupati Majalengka No. 7 Tahun 2025
 * tentang Penomoran Naskah Dinas. K = kode klasifikasi arsip, N = nomor urut surat,
 * S = singkatan unit kerja, Y = tahun.
 */
export const JENIS_NASKAH = {
	surat: { label: "Surat (undangan, tugas, keterangan, pengantar, dll.)", pola: "{K}/{N}/{S}/{Y}" },
	keputusan: { label: "Keputusan (SK)", pola: "{K}/Kep.{N}-{S}/{Y}" },
	"nota-dinas": { label: "Nota Dinas", pola: "{K}/ND.{N}/{S}/{Y}" },
	"berita-acara": { label: "Berita Acara", pola: "{K}/BA.{N}/{S}/{Y}" },
	"surat-edaran": { label: "Surat Edaran", pola: "{N} TAHUN {Y}" },
	memo: { label: "Memo", pola: "{K}/{N}/{Y}" }
} as const;
export type JenisNaskah = keyof typeof JENIS_NASKAH;

export interface SuratKeluar extends SuratDasar {
	tujuan: string
	jenisNaskah: JenisNaskah
	/** Kode klasifikasi arsip (K) di depan nomor surat. */
	kodeKlasifikasi: string
	/** Dinomori manual di luar aplikasi SRIKANDI: nomor diberi akhiran "/M". */
	manual: boolean
	/** Isi naskah bila surat ditulis di Ceklis SD (bisa dibuka & dicetak ulang). */
	naskah?: NaskahSurat
	/** Dokumen lain yang memakai nomor ini, mis. "template:sk-operator" atau "skbm". */
	sumber?: string
}

/** Bentuk naskah yang bisa ditulis langsung dari Agenda Surat. */
export const BENTUK_NASKAH = {
	surat: { label: "Surat (undangan, pemberitahuan, permohonan, pengantar)", jenisNaskah: "surat" },
	keterangan: { label: "Surat Keterangan", jenisNaskah: "surat" },
	tugas: { label: "Surat Tugas", jenisNaskah: "surat" }
} as const satisfies Record<string, { label: string, jenisNaskah: JenisNaskah }>;
export type BentukNaskah = keyof typeof BENTUK_NASKAH;

export interface NaskahSurat {
	bentuk: BentukNaskah
	/** Surat biasa: "Kepada Yth." (boleh beberapa baris). */
	kepada: string
	/** Surat biasa: tempat tujuan di bawah "di", bawaan "Tempat". */
	di: string
	/** Surat tugas: dasar penugasan, satu per baris. */
	dasar: string
	/** Paragraf pembuka/isi; baris kosong memisahkan paragraf. */
	isi: string
	/**
	 * Rincian berformat "Label|Isi" per baris: acara undangan (Hari/Tanggal|...),
	 * data orang yang diterangkan (Nama|...), atau pegawai yang ditugaskan (Nama|NIP|Jabatan).
	 */
	rincian: string
	/** Paragraf penutup. */
	penutup: string
	/** Tembusan, satu per baris. */
	tembusan: string
	/** Judul surat keterangan khusus, mis. "SURAT KETERANGAN PINDAH SEKOLAH"; kosong = "SURAT KETERANGAN". */
	judul?: string
}

export const naskahKosong = (bentuk: BentukNaskah = "surat"): NaskahSurat => ({
	bentuk,
	kepada: "",
	di: "Tempat",
	dasar: "",
	isi: bentuk === "keterangan"
		? "Yang bertanda tangan di bawah ini, Kepala Sekolah, menerangkan bahwa:"
		: bentuk === "tugas" ? "" : "Dengan hormat,",
	rincian: bentuk === "surat" ? "" : bentuk === "keterangan" ? "Nama|\nNIP/NISN|\nJabatan/Kelas|" : "Nama|NIP|Jabatan",
	penutup: bentuk === "keterangan"
		? "Demikian surat keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya."
		: bentuk === "tugas"
			? "Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab."
			: "Demikian surat ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.",
	tembusan: ""
});

export interface AgendaSurat {
	format: typeof FORMAT_AGENDA
	versi: 1
	npsn: string
	sekolah: string
	diperbarui: string
	masuk: SuratMasuk[]
	keluar: SuratKeluar[]
	/** id surat yang dihapus → waktu hapus, agar penghapusan ikut tersinkron antarkomputer. */
	terhapus: Record<string, string>
}

export const agendaKosong = (npsn = "", sekolah = ""): AgendaSurat => ({
	format: FORMAT_AGENDA,
	versi: 1,
	npsn,
	sekolah,
	diperbarui: "",
	masuk: [],
	keluar: [],
	terhapus: {}
});

const teks = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const angka = (v: unknown) => {
	const n = Math.round(Number(v));
	return Number.isFinite(n) && n > 0 ? n : 0;
};
const sifat = (v: unknown): SifatSurat => (SIFAT_SURAT as readonly string[]).includes(teks(v)) ? teks(v) as SifatSurat : "Biasa";
const tahunDari = (iso: string, cadangan: number) => Number(iso.slice(0, 4)) || cadangan;

function dasar(o: Record<string, unknown>, tglUtama: string): SuratDasar {
	const tahunIni = new Date().getFullYear();
	const lampiran = Array.isArray(o.lampiran)
		? o.lampiran
			.filter((l): l is Record<string, unknown> => !!l && typeof l === "object" && !!teks((l as Record<string, unknown>).id))
			.map((l) => ({ id: teks(l.id), nama: teks(l.nama) || "Lampiran" }))
		: [];
	return {
		id: teks(o.id),
		noAgenda: angka(o.noAgenda),
		tahun: angka(o.tahun) || tahunDari(tglUtama, tahunIni),
		noSurat: teks(o.noSurat),
		tglSurat: teks(o.tglSurat),
		perihal: teks(o.perihal),
		sifat: sifat(o.sifat),
		jumlahLampiran: teks(o.jumlahLampiran),
		keterangan: teks(o.keterangan),
		lampiran,
		dibuat: teks(o.dibuat),
		diubah: teks(o.diubah)
	};
}

/** Rapikan data dari Drive/penyimpanan lokal: kolom hilang diisi, entri tanpa id dibuang. */
export function normalisasiAgenda(raw: unknown, npsn = "", sekolah = ""): AgendaSurat {
	const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	const daftar = (v: unknown) => (Array.isArray(v) ? v : []).filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && !!teks((s as Record<string, unknown>).id));
	const terhapus: Record<string, string> = {};
	if (o.terhapus && typeof o.terhapus === "object") {
		for (const [k, v] of Object.entries(o.terhapus as Record<string, unknown>)) {
			if (k && teks(v)) terhapus[k] = teks(v);
		}
	}
	return {
		format: FORMAT_AGENDA,
		versi: 1,
		npsn: teks(o.npsn) || npsn,
		sekolah: teks(o.sekolah) || sekolah,
		diperbarui: teks(o.diperbarui),
		// Kolom yang tidak dikenal (dari SiLajur atau versi lebih baru) dipertahankan agar tidak hilang saat disimpan.
		masuk: daftar(o.masuk).map((s) => ({
			...s,
			...dasar(s, teks(s.tglTerima) || teks(s.tglSurat)),
			tglTerima: teks(s.tglTerima),
			pengirim: teks(s.pengirim),
			disposisiKepada: teks(s.disposisiKepada),
			isiDisposisi: teks(s.isiDisposisi),
			kodeKlasifikasi: teks(s.kodeKlasifikasi)
		})),
		keluar: daftar(o.keluar).map((s) => ({
			...s,
			...dasar(s, teks(s.tglSurat)),
			tujuan: teks(s.tujuan),
			jenisNaskah: teks(s.jenisNaskah) in JENIS_NASKAH ? teks(s.jenisNaskah) as JenisNaskah : "surat",
			kodeKlasifikasi: teks(s.kodeKlasifikasi),
			manual: s.manual === true,
			...(s.naskah && typeof s.naskah === "object" ? { naskah: normalisasiNaskah(s.naskah as Record<string, unknown>) } : {}),
			...(teks(s.sumber) ? { sumber: teks(s.sumber) } : {})
		})),
		terhapus
	};
}

function gabungDaftar<T extends SuratDasar>(a: T[], b: T[], terhapus: Record<string, string>): T[] {
	const per = new Map<string, T>();
	for (const s of [...a, ...b]) {
		const lama = per.get(s.id);
		if (!lama || s.diubah > lama.diubah) per.set(s.id, s);
	}
	// Surat yang diubah lagi setelah dihapus di komputer lain tetap dipertahankan.
	return [...per.values()].filter((s) => !(terhapus[s.id] && terhapus[s.id]! >= s.diubah));
}

/**
 * Gabungkan dua salinan agenda (komputer ini & Drive): per surat, perubahan terbaru menang;
 * penghapusan diikutkan. Hasilnya sama apa pun urutan argumennya.
 */
export function gabungAgenda(a: AgendaSurat, b: AgendaSurat): AgendaSurat {
	const terhapus: Record<string, string> = { ...a.terhapus };
	for (const [k, v] of Object.entries(b.terhapus)) {
		if (!terhapus[k] || v > terhapus[k]!) terhapus[k] = v;
	}
	return {
		...agendaKosong(a.npsn || b.npsn, a.sekolah || b.sekolah),
		diperbarui: a.diperbarui > b.diperbarui ? a.diperbarui : b.diperbarui,
		masuk: urutkan(gabungDaftar(a.masuk, b.masuk, terhapus)),
		keluar: urutkan(gabungDaftar(a.keluar, b.keluar, terhapus)),
		terhapus
	};
}

/** Urut per tahun lalu nomor agenda (terbaru di atas). */
export function urutkan<T extends SuratDasar>(list: T[]): T[] {
	return [...list].sort((x, y) => y.tahun - x.tahun || y.noAgenda - x.noAgenda || y.dibuat.localeCompare(x.dibuat));
}

/** Isi kedua salinan sama (tanpa melihat urutan dan waktu `diperbarui`). */
export function agendaSama(a: AgendaSurat, b: AgendaSurat) {
	const kunci = (x: AgendaSurat) => JSON.stringify({
		masuk: urutkan(x.masuk),
		keluar: urutkan(x.keluar),
		terhapus: Object.keys(x.terhapus).sort().map((k) => [k, x.terhapus[k]])
	});
	return kunci(a) === kunci(b);
}

export const nomorAgendaBerikut = (list: SuratDasar[], tahun: number) =>
	list.filter((s) => s.tahun === tahun).reduce((m, s) => Math.max(m, s.noAgenda), 0) + 1;

/** Nomor urut agenda yang dipakai lebih dari satu surat pada tahun yang sama. */
export function nomorGanda(list: SuratDasar[]): Set<string> {
	const per = new Map<string, string[]>();
	for (const s of list) {
		const k = `${s.tahun}:${s.noAgenda}`;
		per.set(k, [...(per.get(k) ?? []), s.id]);
	}
	return new Set([...per.values()].filter((ids) => ids.length > 1).flat());
}

/**
 * Nomor surat keluar sesuai pola jenis naskahnya, mis. "000.1.5/1/SDN-Teja2/2025"
 * atau "800/Kep.3-SDN-Teja2/2026". Bagian yang kosong ditandai "..." supaya kelihatan
 * belum diisi; penomoran manual diberi akhiran "/M".
 */
export function usulanNomorKeluar(o: { jenisNaskah: JenisNaskah, kodeKlasifikasi: string, noAgenda: number, singkatan: string, tahun: number, manual: boolean }) {
	const isi = (v: string) => v.trim() || "...";
	const nomor = JENIS_NASKAH[o.jenisNaskah].pola
		.replace("{K}", isi(o.kodeKlasifikasi))
		.replace("{N}", o.noAgenda > 0 ? String(o.noAgenda) : "...")
		.replace("{S}", isi(o.singkatan))
		.replace("{Y}", o.tahun ? String(o.tahun) : "...");
	return o.manual ? `${nomor}/M` : nomor;
}

/** Kode klasifikasi & pilihan manual dari surat keluar terakhir, sebagai bawaan surat baru. */
export function bawaanKeluar(list: SuratKeluar[]) {
	const terakhir = [...list].sort((a, b) => b.dibuat.localeCompare(a.dibuat))[0];
	return { kodeKlasifikasi: terakhir?.kodeKlasifikasi ?? "", manual: terakhir?.manual ?? false };
}

export function suratMasukBaru(list: SuratMasuk[], tglHariIni: string): SuratMasuk {
	const tahun = Number(tglHariIni.slice(0, 4));
	const kini = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		noAgenda: nomorAgendaBerikut(list, tahun),
		tahun,
		noSurat: "",
		tglSurat: "",
		tglTerima: tglHariIni,
		pengirim: "",
		perihal: "",
		sifat: "Biasa",
		jumlahLampiran: "",
		disposisiKepada: "",
		isiDisposisi: "",
		kodeKlasifikasi: "",
		keterangan: "",
		lampiran: [],
		dibuat: kini,
		diubah: kini
	};
}

export function suratKeluarBaru(list: SuratKeluar[], tglHariIni: string): SuratKeluar {
	const tahun = Number(tglHariIni.slice(0, 4));
	const kini = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		noAgenda: nomorAgendaBerikut(list, tahun),
		tahun,
		noSurat: "",
		tglSurat: tglHariIni,
		tujuan: "",
		perihal: "",
		sifat: "Biasa",
		jenisNaskah: "surat",
		...bawaanKeluar(list),
		jumlahLampiran: "",
		keterangan: "",
		lampiran: [],
		dibuat: kini,
		diubah: kini
	};
}

/** Tahun yang punya surat, ditambah tahun berjalan; terbaru di depan. */
export function tahunAgenda(agenda: AgendaSurat, tahunIni: number): number[] {
	const set = new Set([tahunIni, ...agenda.masuk.map((s) => s.tahun), ...agenda.keluar.map((s) => s.tahun)]);
	return [...set].filter(Boolean).sort((a, b) => b - a);
}

/** Saring per tahun dan kata kunci (nomor, pihak, perihal, disposisi, keterangan). */
export function saringSurat<T extends SuratMasuk | SuratKeluar>(list: T[], tahun: number | null, cari: string): T[] {
	const q = cari.trim().toLowerCase();
	return list.filter((s) => {
		if (tahun && s.tahun !== tahun) return false;
		if (!q) return true;
		const pihak = "pengirim" in s ? `${s.pengirim} ${s.disposisiKepada} ${s.isiDisposisi}` : s.tujuan;
		return `${s.noAgenda} ${s.noSurat} ${s.kodeKlasifikasi} ${pihak} ${s.perihal} ${s.keterangan}`.toLowerCase().includes(q);
	});
}

function normalisasiNaskah(o: Record<string, unknown>): NaskahSurat {
	const bentuk = teks(o.bentuk) in BENTUK_NASKAH ? teks(o.bentuk) as BentukNaskah : "surat";
	const dasar = naskahKosong(bentuk);
	const ambil = (k: Exclude<keyof NaskahSurat, "judul">) => (typeof o[k] === "string" ? o[k] as string : dasar[k]);
	// Kolom lain (mis. `judul`, atau dari versi aplikasi yang lebih baru) dipertahankan.
	return { ...o, bentuk, kepada: ambil("kepada"), di: ambil("di"), dasar: ambil("dasar"), isi: ambil("isi"), rincian: ambil("rincian"), penutup: ambil("penutup"), tembusan: ambil("tembusan") };
}

/**
 * Ambil atau perbarui nomor surat keluar untuk dokumen lain (template SK, SKBM).
 * `id` = entri agenda yang sudah pernah dibuat untuk dokumen itu; bila tidak ada, dibuat baru.
 */
export function catatNomorDokumen(
	list: SuratKeluar[],
	o: { id?: string, sumber: string, jenisNaskah: JenisNaskah, kodeKlasifikasi: string, tglSurat: string, perihal: string, tujuan: string, singkatan: string, manual?: boolean }
): SuratKeluar {
	const lama = o.id ? list.find((s) => s.id === o.id) : undefined;
	const tahun = Number(o.tglSurat.slice(0, 4)) || new Date().getFullYear();
	const dasar = lama ?? suratKeluarBaru(list, o.tglSurat || new Date().toISOString().slice(0, 10));
	// Pindah tahun = nomor urut tahun yang baru.
	const noAgenda = lama && lama.tahun === tahun ? lama.noAgenda : (lama ? nomorAgendaBerikut(list, tahun) : dasar.noAgenda);
	const manual = o.manual ?? dasar.manual;
	const s: SuratKeluar = {
		...dasar,
		tahun,
		noAgenda,
		tglSurat: o.tglSurat,
		perihal: o.perihal,
		tujuan: o.tujuan,
		jenisNaskah: o.jenisNaskah,
		kodeKlasifikasi: o.kodeKlasifikasi,
		manual,
		sumber: o.sumber,
		diubah: new Date().toISOString()
	};
	s.noSurat = usulanNomorKeluar({ jenisNaskah: s.jenisNaskah, kodeKlasifikasi: s.kodeKlasifikasi, noAgenda: s.noAgenda, singkatan: o.singkatan, tahun, manual });
	return s;
}

/** Entri agenda yang dibuat untuk dokumen tertentu (mis. "silajur:rapat:<nota>:undangan"). */
export const entriSumber = (list: SuratKeluar[], sumber: string) => list.find((s) => s.sumber === sumber);
