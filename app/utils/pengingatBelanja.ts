// Pengingat bulanan: mulai tanggal tertentu (bawaan 20), ingatkan bendahara membelanjakan
// sisa rencana RKAS bulan berjalan dan membuat Standing Instruction (SI).
// Fungsi murni (tanpa state Vue) supaya bisa dites.

import type { RealisasiItem, RkasItem } from "./types";
import { belanjaBulan } from "./belanjaBulanan";

export const SETTING_PENGINGAT_BELANJA = "pengingat.belanja";

export interface PengaturanPengingat {
	aktif: boolean
	/** Tanggal mulai diingatkan tiap bulan (1-28). */
	tanggal: number
	/** "YYYY-MM-DD": jangan ingatkan lagi sampai tanggal ini lewat. */
	tundaSampai?: string
	/** "YYYY-MM": pengingat bulan ini sudah ditandai selesai. */
	selesaiBulan?: string
}

export const pengingatBawaan = (): PengaturanPengingat => ({ aktif: true, tanggal: 20 });

export interface StatusPengingat {
	/** Pengingat perlu ditampilkan sekarang. */
	tampil: boolean
	bulan: number
	tahun: number
	/** Sisa pagu RKAS bulan ini yang belum dibelanjakan. */
	sisa: number
	/** Jumlah item RKAS bulan ini yang belum lunas. */
	itemBelum: number
	/** Sudah ada draft SI yang dibuat/diubah bulan ini. */
	siDibuat: boolean
}

const dua = (n: number) => String(n).padStart(2, "0");
export const kunciBulan = (d: Date) => `${d.getFullYear()}-${dua(d.getMonth() + 1)}`;
export const kunciTanggal = (d: Date) => `${kunciBulan(d)}-${dua(d.getDate())}`;
export const batasTanggal = (n: number) => Math.min(28, Math.max(1, Math.round(Number(n) || 20)));

/**
 * Hitung status pengingat untuk `hari ini`. Hanya berlaku bila tahun anggaran ARKAS = tahun berjalan.
 * `siUpdatedAt` berisi waktu ubah (ISO) setiap draft SI tahun anggaran ini.
 */
export const statusPengingat = (o: {
	hariIni: Date
	tahunAnggaran: number | null
	pengaturan: PengaturanPengingat
	rkas: Pick<RkasItem, "idRapbs" | "bulan">[]
	realisasi: Pick<RealisasiItem, "idRapbs" | "realisasi">[]
	siUpdatedAt: string[]
}): StatusPengingat => {
	const d = o.hariIni;
	const bulan = d.getMonth() + 1;
	const tahun = d.getFullYear();
	const realById = new Map(o.realisasi.map((r) => [r.idRapbs, r]));

	let sisa = 0;
	let itemBelum = 0;
	for (const item of o.rkas) {
		const b = belanjaBulan(item, realById.get(item.idRapbs), bulan);
		if (b.status && b.status !== "lunas") {
			sisa += b.sisa;
			itemBelum++;
		}
	}
	const bulanIni = kunciBulan(d);
	const siDibuat = o.siUpdatedAt.some((t) => t.slice(0, 7) === bulanIni);

	const p = o.pengaturan;
	const waktunya = p.aktif
		&& o.tahunAnggaran === tahun
		&& d.getDate() >= batasTanggal(p.tanggal)
		&& p.selesaiBulan !== bulanIni
		&& !(p.tundaSampai && p.tundaSampai >= kunciTanggal(d));

	return { tampil: waktunya && (sisa > 0 || !siDibuat), bulan, tahun, sisa, itemBelum, siDibuat };
};
