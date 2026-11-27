// Ceklis tugas BOSP kepala sekolah dan bendahara per tahun anggaran.
// Dipindahkan dari Ceklis SD (yang kini khusus operator). Item bisa menautkan template
// Surat BOSP (`template`) atau halaman SiLajur yang sudah mengolah data ARKAS (`tautan`).
import type { PeranBosp } from "./templates";

export type FaseBosp = "tahun-anggaran" | "semester" | "rutin";

export interface ItemBosp {
	id: string
	judul: string
	detail?: string
	aplikasi?: string
	/** id regulasi (lihat regulasi.ts) */
	dasar?: string
	tenggat?: string
	/** id template Surat BOSP */
	template?: string
	/** Halaman SiLajur yang mengerjakan item ini dari data ARKAS. */
	tautan?: { to: string, label: string }
}

export interface KelompokBosp {
	id: string
	judul: string
	fase: FaseBosp
	items: ItemBosp[]
}

export const peranBospInfo: Record<PeranBosp, { nama: string, icon: string, deskripsi: string }> = {
	kepsek: { nama: "Kepala Sekolah", icon: "i-lucide-user-round-check", deskripsi: "Tim BOSP, rapat & pengesahan RKAS, pengawasan kas dan belanja" },
	bendahara: { nama: "Bendahara BOSP", icon: "i-lucide-wallet", deskripsi: "ARKAS, BKU, pajak, bukti belanja, laporan" }
};

export const faseBospInfo: Record<FaseBosp, { label: string, color: "warning" | "primary" | "neutral" }> = {
	"tahun-anggaran": { label: "Awal tahun anggaran (Januari)", color: "warning" },
	semester: { label: "Setiap awal semester", color: "primary" },
	rutin: { label: "Rutin & tenggat", color: "neutral" }
};

const T = {
	sptjm: { to: "/laporan/sptjm", label: "Cetak SPTJM" },
	kas: { to: "/laporan/register-kas", label: "Register Kas & BA Pemeriksaan Kas" },
	kwitansi: { to: "/penatausahaan/kwitansi", label: "Cetak Kwitansi A2" },
	bku: { to: "/penatausahaan/bku", label: "Buku Kas Umum" },
	pajak: { to: "/penatausahaan/pajak", label: "Buku Pembantu Pajak" },
	rekon: { to: "/laporan/rekon-bank", label: "Rekonsiliasi Bank" },
	realisasi: { to: "/penganggaran/realisasi", label: "Realisasi Belanja" },
	rkas: { to: "/penganggaran/rkas", label: "Penganggaran RKAS" },
	kertasKerja: { to: "/penganggaran/kertas-kerja", label: "Kertas Kerja (RKAS)" },
	belanja: { to: "/penganggaran/belanja", label: "Belanja & SIPLah" },
	k7: { to: "/laporan/k7", label: "Laporan K7 / K7a" }
} as const;

export const ceklisBosp: Record<PeranBosp, KelompokBosp[]> = {
	/* ───────────────────────── KEPALA SEKOLAH ───────────────────────── */
	kepsek: [
		{
			id: "ks-ta-anggaran",
			judul: "Awal tahun anggaran: RKT & RKAS",
			fase: "tahun-anggaran",
			items: [
				{ id: "ks-skbosp", judul: "Tetapkan SK Tim Pengelola Dana BOSP (kepsek, bendahara, anggota, unsur komite)", template: "sk-tim-bosp", dasar: "arkas" },
				{ id: "ks-rkt", judul: "Susun RKT berbasis prioritas Rapor Pendidikan (Perencanaan Berbasis Data)", dasar: "arkas" },
				{ id: "ks-undangan", judul: "Undang GTK DAN komite sekolah ke rapat RKAS", detail: "RKAS wajib memperhatikan pertimbangan komite, jadi komite ikut diundang.", template: "rkas-undangan", dasar: "arkas" },
				{ id: "ks-rapatrkas", judul: "Laksanakan rapat RKAS: daftar hadir bertanda tangan, notulen, dokumentasi", template: "rkas-daftar-hadir" },
				{ id: "ks-ba", judul: "Tanda tangani Berita Acara (kepsek + komite + perwakilan guru)", template: "rkas-berita-acara" },
				{ id: "ks-batas", judul: "Cek batas komponen: honor ≤20% (negeri), buku ≥10%, pemeliharaan ≤20%", dasar: "bosp", tautan: T.kertasKerja },
				{ id: "ks-mbg", judul: "Pastikan tidak ada anggaran bahan pangan MBG atau rehab sedang/berat", dasar: "bosp" },
				{ id: "ks-sahkan", judul: "Ajukan pengesahan RKAS di ARKAS ke dinas & tanda tangani lembar pengesahan", aplikasi: "ARKAS 4", template: "rkas-pengesahan", dasar: "arkas" }
			]
		},
		{
			id: "ks-rutin",
			judul: "Rutin & pengawasan keuangan",
			fase: "rutin",
			items: [
				{ id: "ks-kas", judul: "Periksa kas bendahara tiap akhir bulan & tanda tangani BA pemeriksaan kas", tautan: T.kas },
				{ id: "ks-pbj", judul: "Setujui belanja: persiapan → bandingkan ≥2 penyedia → serah terima", dasar: "pbj", template: "persiapan-pengadaan" },
				{ id: "ks-publikasi", judul: "Umumkan rencana & realisasi dana BOSP di papan informasi sekolah", template: "papan-informasi" },
				{ id: "ks-lap1", judul: "Setujui laporan tahap I", tenggat: "31 Juli", dasar: "bosp", tautan: T.realisasi },
				{ id: "ks-laptahun", judul: "Setujui laporan keseluruhan & SPTJM", tenggat: "31 Januari", dasar: "bosp", tautan: T.sptjm }
			]
		}
	],

	/* ───────────────────────── BENDAHARA ───────────────────────── */
	bendahara: [
		{
			id: "bd-anggaran",
			judul: "Awal tahun anggaran",
			fase: "tahun-anggaran",
			items: [
				{ id: "bd-pagu", judul: "Cek pagu BOSP Reguler (dasar: Dapodik cut-off 31 Agustus tahun lalu)", aplikasi: "ARKAS 4", dasar: "bosp" },
				{ id: "bd-silpa", judul: "Catat sisa dana (SiLPA) tahun lalu ke RKAS", aplikasi: "ARKAS 4", dasar: "bosp" },
				{ id: "bd-kertas", judul: "Input kertas kerja per kegiatan & kode rekening, sampai nominal + pajak + ongkir", aplikasi: "ARKAS 4", dasar: "arkas", tautan: T.rkas },
				{ id: "bd-batas", judul: "Hitung porsi honor (≤20% negeri), buku (≥10%), pemeliharaan (≤20%)", dasar: "bosp", tautan: T.kertasKerja },
				{ id: "bd-pengesahan", judul: "Cetak RKAS, lembar pengesahan & paraf tim", template: "rkas-pengesahan" },
				{ id: "bd-bku", judul: "Aktivasi BKU setelah RKAS disahkan", aplikasi: "ARKAS 4", dasar: "arkas" },
				{ id: "bd-rekening", judul: "Pastikan rekening sekolah aktif dan sesuai data Dapodik", dasar: "bosp" },
				{ id: "bd-coretax", judul: "Pastikan akses Coretax (impersonate NPWP instansi) & sertifikat elektronik aktif", aplikasi: "Coretax DJP", dasar: "pajak" }
			]
		},
		{
			id: "bd-semester",
			judul: "Awal semester",
			fase: "semester",
			items: [
				{ id: "bd-realisasi", judul: "Rekap realisasi semester lalu vs RKAS", aplikasi: "ARKAS 4", tautan: T.realisasi },
				{ id: "bd-pergeseran", judul: "Ajukan pergeseran/perubahan RKAS jika kebutuhan berubah", aplikasi: "ARKAS 4", dasar: "arkas", tautan: T.rkas },
				{ id: "bd-honor", judul: "Perbarui daftar penerima honor (NUPTK valid, sesuai SK)", dasar: "bosp", template: "daftar-honor" }
			]
		},
		{
			id: "bd-belanja",
			judul: "Setiap belanja (Permendikdasmen 15/2026)",
			fase: "rutin",
			items: [
				{ id: "bd-persiapan", judul: "> Rp1 juta: buat dokumen persiapan (jumlah, spesifikasi, waktu, anggaran)", dasar: "pbj", template: "persiapan-pengadaan" },
				{ id: "bd-banding", judul: "Bandingkan minimal 2 penyedia; penyedia wajib ber-NPWP", dasar: "pbj", template: "ba-perbandingan" },
				{ id: "bd-siplah", judul: "Transaksi melalui SIPLah/sistem pembelanjaan kementerian bila tersedia", aplikasi: "SIPLah", dasar: "pbj", tautan: T.belanja },
				{ id: "bd-terima", judul: "Periksa barang & buat BA serah terima", dasar: "pbj", tautan: T.kwitansi },
				{ id: "bd-kuitansi", judul: "Simpan bukti bayar/kuitansi, faktur, foto barang", tautan: T.kwitansi },
				{ id: "bd-catat", judul: "Catat transaksi ke BKU ARKAS secara kronologis", aplikasi: "ARKAS 4", tautan: T.bku }
			]
		},
		{
			id: "bd-pajak",
			judul: "Pajak",
			fase: "rutin",
			items: [
				{ id: "bd-pph21", judul: "Potong PPh 21 atas honor & buat bukti potong", aplikasi: "Coretax DJP", dasar: "pajak", template: "spj-honor" },
				{ id: "bd-pph23", judul: "Potong PPh 23 (2%) atas jasa/sewa harta badan", aplikasi: "Coretax DJP", dasar: "pajak" },
				{ id: "bd-pph22", judul: "Jangan pungut PPh 22 untuk pembelian dana BOS (dikecualikan PMK 81/2024)", dasar: "pajak" },
				{ id: "bd-ppn", judul: "Pungut PPN (12% × DPP 11/12) ke rekanan PKP (sekolah negeri)", aplikasi: "Coretax DJP", dasar: "pajak" },
				{ id: "bd-setor", judul: "Setor pajak (kode billing) & serahkan bukti potong ke dinas/rekanan", tenggat: "bulan berikutnya", aplikasi: "Coretax DJP", dasar: "pajak", tautan: T.pajak }
			]
		},
		{
			id: "bd-laporan",
			judul: "Tutup buku & laporan",
			fase: "rutin",
			items: [
				{ id: "bd-tutupbulan", judul: "Tutup BKU tiap akhir bulan; cocokkan saldo dengan rekening koran", aplikasi: "ARKAS 4", tautan: T.rekon },
				{ id: "bd-kas", judul: "BA pemeriksaan kas bulanan bersama kepala sekolah", tautan: T.kas },
				{ id: "bd-lap1", judul: "Laporan realisasi tahap I (realisasi ≥50% agar tahap II cair)", tenggat: "31 Juli", dasar: "bosp", tautan: T.k7 },
				{ id: "bd-laptahun", judul: "Laporan keseluruhan tahun anggaran + hasil pengadaan", tenggat: "31 Januari", dasar: "bosp", tautan: T.sptjm },
				{ id: "bd-publik", judul: "Tempel pengumuman penggunaan dana di papan informasi", template: "papan-informasi" },
				{ id: "bd-arsip", judul: "Arsipkan SPJ per kegiatan (persiapan, perbandingan, perjanjian, BA terima, bukti bayar)", dasar: "pbj" }
			]
		}
	]
};

/** Status ceklis per tahun anggaran: id item → tanggal dicentang (ISO). */
export type StatusCeklisBosp = Record<string, string>;
export const settingCeklisBosp = (year: number) => `bosp.ceklis.${year}`;

export const semuaItem = (peran: PeranBosp) => ceklisBosp[peran].flatMap((k) => k.items);
