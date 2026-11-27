import type { PengaturanSurat } from "~/utils/bosp/profil";
import type { Guru } from "~/utils/rapat";
import { pengaturanSuratBawaan, profilSurat, SETTING_SURAT } from "~/utils/bosp/profil";
import { SETTING_GURU } from "~/utils/rapat";

/**
 * Data sekolah untuk Surat BOSP: kop & pejabat dari Pengaturan, profil sekolah ARKAS,
 * daftar guru, dan kode surat. Tahun anggaran mengikuti pilihan tahun ARKAS.
 */
export const useSuratBosp = () => {
	const { year } = useArkas();
	const { pengaturan, sekolah } = useDocContext();
	const sekolahState = useState<SchoolInfo | null>("doc-sekolah", () => null);
	const guru = useState<Guru[]>("bosp-guru", () => []);
	const surat = useState<PengaturanSurat>("bosp-surat", pengaturanSuratBawaan);
	const loading = ref(false);
	const error = ref("");

	/** Tahun anggaran aktif; tanpa ARKAS memakai tahun berjalan. */
	const ta = computed(() => year.value ?? new Date().getFullYear());

	const profil = computed(() => profilSurat({ pengaturan: pengaturan.value, sekolah: sekolah.value, guru: guru.value, surat: surat.value }));

	/** Isian yang masih kosong dan akan tercetak titik-titik. */
	const kurang = computed(() => {
		const p = profil.value;
		return [
			!p.sekolah && "nama sekolah",
			!p.kepsek && "kepala sekolah",
			!p.bendahara && "bendahara",
			!p.komite && "ketua komite",
			!p.kota && "kota penandatanganan",
			!p.gtk.length && "daftar guru"
		].filter((x): x is string => !!x);
	});

	const load = async () => {
		loading.value = true;
		error.value = "";
		try {
			// Tanpa ARKAS, profil sekolah tidak tersedia; surat tetap bisa dibuat dari Pengaturan.
			const [view, info, g, s] = await Promise.all([
				api.pengaturanGet(year.value).catch(() => null),
				api.schoolInfo(year.value).catch(() => null),
				api.settingsGet<Guru[]>(SETTING_GURU).catch(() => null),
				api.settingsGet<PengaturanSurat>(SETTING_SURAT).catch(() => null)
			]);
			if (view) pengaturan.value = view.efektif;
			if (info) sekolahState.value = info;
			guru.value = g ?? [];
			surat.value = { ...pengaturanSuratBawaan(), ...s };
		} catch (err) {
			error.value = errorMessage(err);
		} finally {
			loading.value = false;
		}
	};

	const simpanSurat = async (value: PengaturanSurat) => {
		await api.settingsSet(SETTING_SURAT, value);
		surat.value = { ...value };
	};

	return { ta, profil, surat, kurang, loading, error, load, simpanSurat };
};
