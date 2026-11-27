// Data sekolah untuk naskah surat BOSP. Diambil dari Pengaturan (kop, pejabat, kota),
// profil sekolah ARKAS, dan daftar guru di Pengaturan, sehingga tidak perlu diisi ulang.
import type { Pengaturan, SchoolInfo } from "../api";
import type { Guru } from "../rapat";
import { namaSekolahRapi, peranGuru } from "../rapat";

export interface GtkSurat {
	nama: string
	nip: string
	jabatan: string
}

export interface ProfilSurat {
	pemda: string
	dinas: string
	/** Nama sekolah huruf besar seperti di kop, mis. "SD NEGERI TEJA II". */
	sekolah: string
	npsn: string
	kabupaten: string
	/** Tempat penandatanganan. */
	kota: string
	/** Kode sekolah di nomor surat, mis. "SD-01". */
	kodeSurat: string
	kepsek: string
	nipKepsek: string
	bendahara: string
	nipBendahara: string
	operator: string
	komite: string
	logoKiri?: string
	logoKanan?: string
	kopAlamat: string
	kopKontak: string
	gtk: GtkSurat[]
}

/** Isian tambahan khusus surat BOSP yang tidak ada di Pengaturan. */
export interface PengaturanSurat {
	kodeSurat: string
}

export const SETTING_SURAT = "bosp.surat";
/** Isian tersimpan per tahun anggaran dan template. */
export const settingIsianSurat = (ta: number, id: string) => `bosp.surat.${ta}.${id}`;
export const pengaturanSuratBawaan = (): PengaturanSurat => ({ kodeSurat: "SD" });

const PREFIX_SD_NEGERI = /^SEKOLAH DASAR NEGERI/i;
const PREFIX_SD = /^SEKOLAH DASAR/i;
const POLA_OPERATOR = /operator/i;
const PREFIX_KABUPATEN = /^(?:Kab\.?|Kabupaten)\s+/i;

export function profilSurat(o: {
	pengaturan: Pengaturan | null
	sekolah: SchoolInfo | null
	guru: Guru[]
	surat: PengaturanSurat
}): ProfilSurat {
	const k = o.pengaturan?.kop;
	const p = o.pengaturan?.pejabat;
	const s = o.sekolah;
	const sekolah = (k?.namaSekolah || s?.nama || "").trim().toUpperCase();

	const alamatParts = [k?.alamat || s?.alamat, s?.kecamatan, s?.kabupaten].filter(Boolean);
	const kopAlamat = k?.barisAlamat || (alamatParts.length ? `Alamat ${alamatParts.join(", ")}` : "");
	const kopKontak = k?.barisKontak || [
		s?.npsn && `NPSN. ${s.npsn}`,
		k?.email && `E-mail: ${k.email}`,
		k?.laman && `website: ${k.laman}`
	].filter(Boolean).join(" ");

	const operator = o.guru.find((g) => POLA_OPERATOR.test(`${g.tugas} ${g.kelasMapel}`));

	return {
		pemda: k?.pemerintah ?? "",
		dinas: k?.dinas ?? "",
		sekolah,
		npsn: s?.npsn ?? "",
		kabupaten: (s?.kabupaten ?? "").replace(PREFIX_KABUPATEN, ""),
		kota: o.pengaturan?.cetak.kota || "",
		kodeSurat: o.surat.kodeSurat || "SD",
		kepsek: p?.kepalaSekolah || s?.kepalaSekolah || "",
		nipKepsek: p?.nipKepalaSekolah || s?.nipKepalaSekolah || "",
		bendahara: p?.bendahara || s?.bendahara || "",
		nipBendahara: p?.nipBendahara || s?.nipBendahara || "",
		operator: operator?.nama ?? "",
		komite: p?.komite || s?.komite || "",
		logoKiri: k?.logoKiri || undefined,
		logoKanan: k?.logoKanan || undefined,
		kopAlamat,
		kopKontak,
		gtk: o.guru.filter((g) => g.nama.trim()).map((g) => ({ nama: g.nama.trim(), nip: g.nip || "-", jabatan: peranGuru(g) || "Guru" }))
	};
}

/** "SD Negeri Teja II" untuk isi kalimat dan jabatan. */
export const namaSekolahPendek = (p: ProfilSurat) =>
	namaSekolahRapi(p.sekolah.replace(PREFIX_SD_NEGERI, "SD Negeri").replace(PREFIX_SD, "SD")) || "Sekolah";

export function kopLines(p: ProfilSurat) {
	return { pemda: p.pemda, dinas: p.dinas, sekolah: p.sekolah, alamat: p.kopAlamat, kontak: p.kopKontak };
}
