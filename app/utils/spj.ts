// Kelengkapan SPJ per transaksi BKU, mengikuti daftar "Kelengkapan SPJ BOSP" Kabupaten Majalengka 2026
// (15 kategori belanja), ditambah Standing Instruction untuk semua pembayaran. Jenis belanja ditebak
// dari kode/nama rekening dan uraian. Fungsi murni (tanpa state Vue) supaya bisa dites.

import type { NotaGroup } from "./types";
import { isKonsumsi } from "./rapat";
import { isTransport } from "./sppd";

export type JenisBelanja
	= | "honor-bulanan" | "honor-kegiatan" | "langganan" | "materai" | "media"
		| "barang" | "barang-besar" | "cetakan" | "jasa"
		| "mamin-rapat" | "mamin-tamu" | "mamin-peserta" | "natura"
		| "perjalanan" | "modal";

export const JENIS_BELANJA: Record<JenisBelanja, { label: string, icon: string }> = {
	"honor-bulanan": { label: "Honorarium bulanan", icon: "i-lucide-hand-coins" },
	"honor-kegiatan": { label: "Honor narasumber/panitia", icon: "i-lucide-hand-coins" },
	langganan: { label: "Listrik, air, telepon, internet", icon: "i-lucide-plug-zap" },
	materai: { label: "Materai", icon: "i-lucide-stamp" },
	media: { label: "Surat kabar/majalah/jurnal", icon: "i-lucide-newspaper" },
	barang: { label: "Barang habis pakai < Rp1 juta", icon: "i-lucide-shopping-bag" },
	"barang-besar": { label: "Barang habis pakai > Rp1 juta", icon: "i-lucide-package" },
	cetakan: { label: "Spanduk & cetakan", icon: "i-lucide-printer" },
	jasa: { label: "Jasa (pemeliharaan, reparasi, sewa)", icon: "i-lucide-wrench" },
	"mamin-rapat": { label: "Makan minum rapat", icon: "i-lucide-utensils" },
	"mamin-tamu": { label: "Makan minum jamuan tamu", icon: "i-lucide-utensils" },
	"mamin-peserta": { label: "Makan minum peserta kegiatan", icon: "i-lucide-utensils" },
	natura: { label: "Natura & pakan", icon: "i-lucide-shopping-basket" },
	perjalanan: { label: "Perjalanan dinas", icon: "i-lucide-car" },
	modal: { label: "Modal peralatan & mesin", icon: "i-lucide-monitor" }
};

const POLA_HONOR = /honor|insentif|upah|gaji/i;
const POLA_HONOR_KEGIATAN = /narasumber|pembahas|moderator|pembawa acara|\bmc\b|panitia|instruktur|pelatih|juri/i;
const POLA_LANGGANAN = /listrik|\bpln\b|internet|wifi|indihome|telepon|\bair\b|pdam/i;
const POLA_MATERAI = /materai|meterai/i;
const POLA_MEDIA = /surat kabar|koran|majalah|jurnal|langganan (?:media|berita)/i;
const POLA_TAMU = /tamu|jamuan/i;
const POLA_RAPAT = /rapat/i;
const POLA_PESERTA = /peserta|lomba|pelatihan|bimtek|workshop|kkg|sosialisasi|kegiatan|ekstra|o2sn|fls2n/i;
const POLA_NATURA = /natura|pakan|sembako/i;
const POLA_CETAKAN = /spanduk|banner|baliho|cetak|stiker|plakat|undangan cetak/i;
const POLA_JASA = /jasa|sewa|pemeliharaan|perbaikan|reparasi|servis|service|rehab|pengecatan|fotokopi|foto ?copy|penjilidan|penggandaan/i;
const POLA_MODAL = /laptop|komputer|printer|proyektor|lcd|meja|kursi|lemari|rak|kipas|ac\b|televisi|\btv\b|peralatan|mesin/i;
/** Belanja barang di atas batas ini wajib dokumen perencanaan, pembandingan, SP, SHP, dan BAST. */
export const BATAS_PERSIAPAN = 1_000_000;
const KODE_NATURA = "5.1.02.01.01.0043";

/** Teks gabungan untuk menebak jenis: uraian, item, kode & nama rekening. */
function teksBelanja(g: NotaGroup, rekeningNames: Record<string, string>) {
	const kode = g.items.map((i) => i.kodeRekening ?? "");
	return [g.uraian, ...g.items.map((i) => i.uraian), ...kode, ...kode.map((k) => rekeningNames[k] ?? "")].join(" ");
}

/** Tebak kategori belanja (sesuai daftar kabupaten) untuk satu transaksi. */
export function jenisBelanja(g: NotaGroup, rekeningNames: Record<string, string>): JenisBelanja {
	const t = teksBelanja(g, rekeningNames);
	const kode = g.items.map((i) => i.kodeRekening ?? "");
	if (POLA_HONOR.test(t)) return POLA_HONOR_KEGIATAN.test(t) ? "honor-kegiatan" : "honor-bulanan";
	if (isTransport(g, rekeningNames)) return "perjalanan";
	if (kode.includes(KODE_NATURA) || POLA_NATURA.test(t)) return "natura";
	if (isKonsumsi(g, rekeningNames)) {
		if (POLA_TAMU.test(t)) return "mamin-tamu";
		if (!POLA_RAPAT.test(t) && POLA_PESERTA.test(t)) return "mamin-peserta";
		return "mamin-rapat";
	}
	if (POLA_MATERAI.test(t)) return "materai";
	if (POLA_LANGGANAN.test(t)) return "langganan";
	if (POLA_MEDIA.test(t)) return "media";
	if (kode.some((k) => k.startsWith("5.2")) || POLA_MODAL.test(t)) return "modal";
	if (!g.isSiplah && POLA_CETAKAN.test(t)) return "cetakan";
	if (POLA_JASA.test(t) || kode.some((k) => k.startsWith("5.1.02.03"))) return "jasa";
	return g.isSiplah || g.total > BATAS_PERSIAPAN ? "barang-besar" : "barang";
}

export interface DokumenSpj {
	id: string
	label: string
	/** Penjelasan singkat (syarat tanda tangan, dsb.). */
	ket?: string
	/** Terdeteksi otomatis dari data SiLajur (sudah dicetak/dibuat/diunggah). */
	otomatis: boolean
	/** "Bila ada" menurut daftar kabupaten. */
	opsional?: boolean
	/** Menu SiLajur yang membuat dokumen ini. */
	tautan?: { to: string, label: string }
}

/** Dokumen yang sudah dibuat di generator (isian tersimpan per kunci nota). */
export interface KonteksSpj {
	rekeningNames: Record<string, string>
	rapat: Record<string, unknown>
	sppd: Record<string, unknown>
}

const DIVISUM = "Ttd & stempel penyedia, divisum bendahara & kepala sekolah";
const NOTA_TTD = "Ttd penyedia & penerima barang, tulisan asli dari toko";

/**
 * Daftar dokumen SPJ untuk satu transaksi. `berkas` = jumlah berkas unggahan per id dokumen untuk
 * transaksi ini (kunci "" = foto nota dari menu Kwitansi, dihitung sebagai nota).
 */
export function dokumenSpj(g: NotaGroup, k: KonteksSpj, berkas: Record<string, number> = {}): DokumenSpj[] {
	const jenis = jenisBelanja(g, k.rekeningNames);
	const kwitansiMenu = { to: "/penatausahaan/kwitansi", label: "Cetak Kwitansi A2" };
	const template = { to: "/lainnya/template", label: "Template Dokumen" };
	const pajak = { to: "/penatausahaan/pajak", label: "Buku Pembantu Pajak" };
	const rapat = { to: `/generator/rapat?nota=${encodeURIComponent(g.key)}`, label: "Generator Konsumsi Rapat" };
	const sppd = { to: `/generator/sppd?nota=${encodeURIComponent(g.key)}`, label: "Generator SPPD" };
	const adaRapat = g.key in k.rapat;
	const adaSppd = g.key in k.sppd;

	const kuitansi: DokumenSpj = { id: "kwitansi", label: "Kuitansi", ket: g.isSiplah ? "Kuitansi dari SIPLah atau kwitansi SiLajur" : DIVISUM, otomatis: !!(g.printedA2 || g.printedBukti), tautan: kwitansiMenu };
	const nota = (ket = NOTA_TTD): DokumenSpj => ({ id: "nota", label: "Nota pembelian", ket, otomatis: !!g.printedNota || (berkas[""] ?? 0) > 0, tautan: kwitansiMenu });
	const d = (id: string, label: string, o: Partial<DokumenSpj> = {}): DokumenSpj => ({ id, label, otomatis: false, ...o });
	const fotoKegiatan = d("foto-kegiatan", "Foto dokumentasi kegiatan");
	const pb1 = d("pb1", "Bukti setoran Pajak Daerah (PB1)", { tautan: pajak });

	const daftar: Record<JenisBelanja, DokumenSpj[]> = {
		"honor-bulanan": [
			d("sk-honor", "SK penetapan penerima honorarium bulanan"),
			d("daftar-honor", "Daftar penerimaan honorarium bulanan", { tautan: { to: "/bosp/surat/daftar-honor", label: "Surat BOSP" } }),
			d("hadir", "Daftar hadir")
		],
		"honor-kegiatan": [
			d("sk-honor", "SK penetapan penerima honorarium"),
			d("daftar-honor", "Daftar penerimaan honorarium", { tautan: { to: "/bosp/surat/daftar-honor", label: "Surat BOSP" } }),
			d("hadir", "Daftar hadir penerima honorarium"),
			fotoKegiatan,
			d("ntpn-pph21", "Bukti setoran PPh 21 (NTPN)", { opsional: true, tautan: pajak })
		],
		langganan: [
			d("rekap-langganan", "Rekapitulasi belanja listrik, air, telepon & internet", { ket: "Ttd bendahara & kepala sekolah" }),
			d("bukti-setor", "Bukti setor / struk pembayaran", { ket: "Divisum bendahara & kepala sekolah" })
		],
		materai: [kuitansi, nota("HARUS dari Kantor Pos")],
		media: [kuitansi, d("bukti-media", "Bukti surat kabar/majalah/jurnal-nya")],
		barang: [kuitansi, nota(), d("foto-barang", "Foto keseluruhan barang sesuai jumlah pembelian")],
		"barang-besar": [
			d("perencanaan", "Dokumen perencanaan PBJ satuan pendidikan", { tautan: { to: "/bosp/surat/persiapan-pengadaan", label: "Surat BOSP" } }),
			d("pembandingan", "Dokumen hasil pembandingan", { tautan: { to: "/bosp/surat/ba-perbandingan", label: "Surat BOSP" } }),
			d("sp", "Surat Pesanan", { ket: g.isSiplah ? "Unduh dari SIPLah" : undefined, tautan: g.isSiplah ? undefined : template }),
			d("shp", "Surat Hasil Pemeriksaan Barang/Jasa", { ket: g.isSiplah ? "Unduh dari SIPLah" : undefined }),
			d("bast", "Berita Acara Serah Terima Barang", { ket: g.isSiplah ? "Dokumen BAST dari SIPLah" : undefined, tautan: g.isSiplah ? undefined : template }),
			kuitansi,
			d("invoice", "Invoice pembayaran", { ket: g.isSiplah ? "Invoice dari SIPLah" : undefined }),
			d("foto-barang", "Foto keseluruhan barang sesuai jumlah pembelian", { ket: g.isSiplah ? "Bisa memakai Gambar BAST dari SIPLah" : undefined })
		],
		cetakan: [
			kuitansi,
			d("sp", "Surat Pesanan", { tautan: template }),
			d("bast", "Berita Acara Serah Terima Barang", { tautan: template }),
			d("ntpn-ppn", "Bukti setoran PPN (NTPN)", { opsional: true, tautan: pajak }),
			d("foto-barang", "Foto barang")
		],
		jasa: [
			kuitansi,
			d("nota-jasa", "Nota atas jasa (rincian belanja jasa)"),
			d("ntpn-ppn-pph23", "Bukti setoran PPN dan/atau PPh 23 (NTPN)", { opsional: true, tautan: pajak })
		],
		"mamin-rapat": [
			kuitansi,
			nota("Ttd penyedia & penerima barang"),
			d("hadir", "Daftar hadir rapat", { otomatis: adaRapat, tautan: rapat }),
			d("notula", "Notula rapat", { otomatis: adaRapat, tautan: rapat }),
			fotoKegiatan,
			pb1
		],
		"mamin-tamu": [
			kuitansi,
			nota("Ttd penyedia & penerima barang"),
			d("buku-tamu", "Buku tamu", { opsional: true }),
			fotoKegiatan,
			pb1
		],
		"mamin-peserta": [
			kuitansi,
			nota("Ttd penyedia & penerima barang"),
			d("hadir", "Daftar hadir peserta", { otomatis: adaRapat, tautan: rapat }),
			fotoKegiatan,
			pb1
		],
		natura: [
			kuitansi,
			nota("Ttd penyedia & penerima barang"),
			d("ntpn-ppn", "Bukti setoran PPN (NTPN)", { opsional: true, tautan: pajak })
		],
		perjalanan: [
			kuitansi,
			d("rincian", "Daftar perincian riil perjalanan dinas", { ket: "Divisum ttd bendahara & kepala sekolah", otomatis: adaSppd, tautan: sppd }),
			d("rekap-perjadin", "Rekapitulasi belanja perjalanan dinas", { ket: "Bila lebih dari 1 orang", opsional: true }),
			d("tugas", "Surat tugas kepala sekolah", { otomatis: adaSppd, tautan: sppd }),
			d("undangan-luar", "Surat undangan dari instansi yang dikunjungi"),
			d("spd", "SPPD", { ket: "Ttd kepala sekolah, ttd petugas & stempel instansi yang dikunjungi", otomatis: adaSppd, tautan: sppd }),
			d("laporan", "Laporan pelaksanaan tugas", { ket: "Ditandatangani pelaksana tugas", otomatis: adaSppd, tautan: sppd })
		],
		modal: [
			kuitansi,
			d("invoice", "Invoice pembayaran", { ket: g.isSiplah ? "Invoice dari SIPLah" : undefined }),
			d("foto-aset", "Foto barang yang sudah dilabeli kode barang aset"),
			d("ba-periksa", "Berita Acara Pemeriksaan Barang", { ket: "Ttd pemeriksa barang & kepala sekolah" })
		]
	};

	const out = [...daftar[jenis]];
	if (g.isSiplah) {
		out.push(
			d("siplah-proforma", "Proforma Invoice SIPLah", { opsional: true }),
			d("siplah-gambar-bast", "Gambar BAST SIPLah", { opsional: true })
		);
	}
	// Semua pembayaran lewat Standing Instruction; berkas aslinya diserahkan ke teller bank,
	// jadi cukup dicentang "Ada (fisik)" (scan boleh diunggah sebagai arsip).
	out.push(d("si", "Standing Instruction (SI)", { ket: "Asli diserahkan ke teller bank; centang bila sudah", tautan: { to: "/generator/si", label: "Generator SI" } }));
	// Dokumen yang sudah diunggah (scan/foto/PDF) dianggap ada.
	return out.map((x) => ((berkas[x.id] ?? 0) > 0 ? { ...x, otomatis: true } : x));
}

/** Centang manual per transaksi: kunci nota → id dokumen → true. */
export type CentangSpj = Record<string, Record<string, boolean>>;

/** Data SPJ per tahun: centang manual dan jenis dokumen tiap berkas unggahan (id berkas → id dokumen). */
export interface DataSpj {
	centang: CentangSpj
	berkas: Record<string, string>
}
export const dataSpjKosong = (): DataSpj => ({ centang: {}, berkas: {} });

/** Hitung berkas unggahan per transaksi & id dokumen. Berkas tanpa penanda (foto nota Kwitansi) → "". */
export function hitungBerkas(files: { id: string, refId: string }[], peta: Record<string, string>): Record<string, Record<string, number>> {
	const out: Record<string, Record<string, number>> = {};
	for (const f of files) {
		const dok = peta[f.id] ?? "";
		const per = (out[f.refId] ??= {});
		per[dok] = (per[dok] ?? 0) + 1;
	}
	return out;
}
export const settingSpj = (year: number) => `spj.${year}`;

export interface StatusSpj {
	/** Dokumen wajib (tanpa opsional). */
	wajib: number
	/** Dokumen wajib yang sudah ada (otomatis atau dicentang). */
	ada: number
	lengkap: boolean
	/** Label dokumen wajib yang belum ada. */
	kurang: string[]
}

export const dokumenAda = (d: DokumenSpj, centang: Record<string, boolean> | undefined) => d.otomatis || !!centang?.[d.id];

export function statusSpj(dok: DokumenSpj[], centang: Record<string, boolean> | undefined): StatusSpj {
	const wajib = dok.filter((d) => !d.opsional);
	const kurang = wajib.filter((d) => !dokumenAda(d, centang)).map((d) => d.label);
	return { wajib: wajib.length, ada: wajib.length - kurang.length, lengkap: !kurang.length, kurang };
}

/** Satu transaksi dalam cetak paket SPJ (lihat components/Print/Spj/Paket.vue). */
export interface ItemPaketSpj {
	g: NotaGroup
	jenis: string
	dok: DokumenSpj[]
	centang: Record<string, boolean>
	status: StatusSpj
	/** Berkas unggahan per id dokumen (untuk keterangan). */
	berkasDok: Record<string, string[]>
	gambar: { id: string, nama: string, dok: string, data: string }[]
	pdf: { nama: string, dok: string }[]
}
