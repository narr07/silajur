import type { PengaturanPengingat, StatusPengingat } from "~/utils/pengingatBelanja";
import { kunciBulan, kunciTanggal, pengingatBawaan, SETTING_PENGINGAT_BELANJA, statusPengingat } from "~/utils/pengingatBelanja";

/** Draft SI tersimpan per tahun anggaran (lihat pages/generator/si.vue). */
const kunciDraftSi = (year: number) => `si_generator_drafts_${year}`;

/**
 * Pengingat bulanan "belanjakan & buat SI". Status dibaca dari kertas kerja dan realisasi ARKAS
 * serta draft SI; dibagi antara pemberitahuan di layout dan kartu di Dashboard.
 */
export const usePengingatBelanja = () => {
	const { connected, year } = useArkas();
	const pengaturan = useState<PengaturanPengingat>("pengingat-belanja", pengingatBawaan);
	const status = useState<StatusPengingat | null>("pengingat-belanja-status", () => null);
	const memuat = ref(false);

	const muatPengaturan = async () => {
		const p = await api.settingsGet<PengaturanPengingat>(SETTING_PENGINGAT_BELANJA).catch(() => null);
		pengaturan.value = { ...pengingatBawaan(), ...p };
		return pengaturan.value;
	};

	const periksa = async () => {
		if (!connected.value || !year.value) {
			status.value = null;
			return null;
		}
		memuat.value = true;
		try {
			const p = await muatPengaturan();
			const hariIni = new Date();
			// Pengingat hanya untuk tahun anggaran berjalan; tahun lain tidak perlu data ARKAS.
			if (!p.aktif || year.value !== hariIni.getFullYear()) {
				status.value = statusPengingat({ hariIni, tahunAnggaran: year.value, pengaturan: p, rkas: [], realisasi: [], siUpdatedAt: [] });
				return status.value;
			}
			const [kk, real, drafts] = await Promise.all([
				api.kertasKerja(year.value, null),
				api.realisasi(year.value, 12, null).catch(() => null),
				api.settingsGet<{ updatedAt?: string }[]>(kunciDraftSi(year.value)).catch(() => null)
			]);
			status.value = statusPengingat({
				hariIni,
				tahunAnggaran: year.value,
				pengaturan: p,
				rkas: kk.items,
				realisasi: real?.items ?? [],
				siUpdatedAt: (Array.isArray(drafts) ? drafts : []).map((d) => d.updatedAt ?? "")
			});
			return status.value;
		} catch {
			status.value = null;
			return null;
		} finally {
			memuat.value = false;
		}
	};

	const simpan = async (next: PengaturanPengingat) => {
		await api.settingsSet(SETTING_PENGINGAT_BELANJA, next);
		pengaturan.value = { ...next };
	};

	const sembunyikan = async (next: PengaturanPengingat) => {
		await simpan(next);
		if (status.value) status.value = { ...status.value, tampil: false };
	};

	/** Jangan ingatkan lagi hari ini; muncul lagi besok bila belum selesai. */
	const tundaBesok = () => sembunyikan({ ...pengaturan.value, tundaSampai: kunciTanggal(new Date()) });
	/** Tandai pengingat bulan ini selesai; muncul lagi tanggal yang sama bulan depan. */
	const selesaiBulanIni = () => sembunyikan({ ...pengaturan.value, selesaiBulan: kunciBulan(new Date()) });

	return { pengaturan, status, memuat, periksa, muatPengaturan, simpan, tundaBesok, selesaiBulanIni };
};
