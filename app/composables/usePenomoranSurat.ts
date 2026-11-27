import type { JenisNaskah, SuratKeluar } from "~/utils/agenda/agendaSurat";
import type { PengaturanSurat } from "~/utils/bosp/profil";
import { catatNomorDokumen, entriSumber, normalisasiAgenda, urutkan } from "~/utils/agenda/agendaSurat";
import { pengaturanSuratBawaan, SETTING_SURAT } from "~/utils/bosp/profil";

/** Galat dari Rust saat berkas di Drive berubah sejak dibaca (lihat gdrive.rs). */
const KONFLIK = "KONFLIK: ";

export interface PermintaanNomor {
	/** Penanda dokumen asal; dokumen yang sama memakai entri agenda yang sama. */
	sumber: string
	jenisNaskah: JenisNaskah
	kodeKlasifikasi: string
	tglSurat: string
	perihal: string
	tujuan: string
	manual?: boolean
}

/**
 * Penomoran surat keluar SiLajur memakai Agenda Surat Ceklis SD di Google Drive sekolah,
 * sehingga kedua aplikasi berbagi satu urutan nomor (SE Bupati Majalengka 7/2025).
 */
export const usePenomoranSurat = () => {
	const { school } = useArkas();
	const status = useState<StatusGoogle | null>("google-status", () => null);
	const keluar = useState<SuratKeluar[]>("agenda-keluar", () => []);
	const singkatan = useState<string>("penomoran-singkatan", () => pengaturanSuratBawaan().kodeSurat);
	const memuat = ref(false);

	const npsn = computed(() => (school.value?.npsn ?? "").trim());
	const siap = computed(() => !!status.value?.terhubung && !!npsn.value);

	const muatStatus = async () => {
		try {
			status.value = await api.googleStatus();
		} catch {
			status.value = null;
		}
		const s = await api.settingsGet<PengaturanSurat>(SETTING_SURAT).catch(() => null);
		singkatan.value = s?.kodeSurat || pengaturanSuratBawaan().kodeSurat;
	};

	const masuk = async () => {
		status.value = await api.googleMasuk();
	};
	const batalMasuk = () => api.googleBatalMasuk().catch(() => {});
	const putus = async () => {
		status.value = await api.googlePutus();
	};
	const bukaFolder = () => api.agendaBukaFolder();

	/** Muat daftar surat keluar terbaru dari Drive (untuk melihat nomor yang sudah dipakai). */
	const muatAgenda = async () => {
		if (!siap.value) return null;
		memuat.value = true;
		try {
			const remote = await api.agendaAmbil(npsn.value);
			const agenda = normalisasiAgenda(remote?.data ?? null, npsn.value, school.value?.nama ?? "");
			keluar.value = agenda.keluar;
			return { agenda, versi: remote?.versi ?? "" };
		} finally {
			memuat.value = false;
		}
	};

	/** Sekali per sesi: muat status & agenda agar tombol menampilkan nomor agenda yang sudah diambil. */
	const termuat = useState<boolean>("agenda-termuat", () => false);
	const pastikanTermuat = async () => {
		if (termuat.value) return;
		termuat.value = true;
		await muatStatus();
		await muatAgenda().catch(() => null);
	};

	/**
	 * Ambil (atau perbarui) nomor untuk satu dokumen. Selalu dari JSON Drive terbaru; bila berkas
	 * diubah aplikasi lain di sela-selanya, ulangi sampai 3 kali agar nomor urut tidak ganda.
	 */
	const ambilNomor = async (p: PermintaanNomor): Promise<SuratKeluar> => {
		if (!status.value?.terhubung) throw new Error("Hubungkan Google Drive sekolah di Pengaturan untuk mengambil nomor dari Agenda Surat.");
		if (!npsn.value) throw new Error("NPSN sekolah belum terbaca; hubungkan ARKAS terlebih dahulu.");
		for (let coba = 0; coba < 3; coba++) {
			const hasil = await muatAgenda();
			if (!hasil) break;
			const { agenda, versi } = hasil;
			const lama = entriSumber(agenda.keluar, p.sumber);
			const s = catatNomorDokumen(agenda.keluar, { ...p, id: lama?.id, singkatan: singkatan.value });
			const daftar = urutkan([...agenda.keluar.filter((x) => x.id !== s.id), s]);
			const isi = { ...agenda, npsn: npsn.value, sekolah: agenda.sekolah || school.value?.nama || "", keluar: daftar, diperbarui: new Date().toISOString() };
			try {
				await api.agendaKirim(npsn.value, isi, versi);
				keluar.value = daftar;
				return s;
			} catch (err) {
				if (!errorMessage(err).startsWith(KONFLIK)) throw err;
			}
		}
		throw new Error("Agenda Surat sedang diubah dari komputer lain. Coba lagi sebentar.");
	};

	return { status, keluar, singkatan, npsn, siap, memuat, muatStatus, masuk, batalMasuk, putus, bukaFolder, muatAgenda, pastikanTermuat, ambilNomor };
};
