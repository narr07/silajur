// Penomoran SiLajur memakai JSON Agenda Surat yang sama dengan Ceklis SD.

import { describe, expect, test } from "bun:test";
import { catatNomorDokumen, entriSumber, FORMAT_AGENDA, normalisasiAgenda, usulanNomorKeluar } from "../app/utils/agenda/agendaSurat";
import { KLASIFIKASI_ARSIP } from "../app/utils/agenda/klasifikasiArsip";

/** Contoh JSON seperti yang ditulis Ceklis SD (surat dengan naskah & lampiran, kolom versi baru). */
const dariCeklis = {
	format: FORMAT_AGENDA,
	versi: 1,
	npsn: "12345678",
	sekolah: "SD Negeri Contoh 1",
	diperbarui: "2026-07-01T00:00:00.000Z",
	masuk: [{ id: "m1", noAgenda: 1, tahun: 2026, perihal: "Undangan KKKS", pengirim: "Korwil", tglTerima: "2026-07-01", lampiran: [{ id: "f1", nama: "scan.pdf" }], kolomBaru: "tetap" }],
	keluar: [{
		id: "k1",
		noAgenda: 4,
		tahun: 2026,
		noSurat: "000.1.5/4/SDN1/2026",
		tglSurat: "2026-07-06",
		perihal: "Undangan Rapat",
		tujuan: "Orang Tua",
		jenisNaskah: "surat",
		kodeKlasifikasi: "000.1.5",
		naskah: { bentuk: "surat", kepada: "Orang Tua", isi: "Dengan hormat," },
		dibuat: "2026-07-06T00:00:00.000Z",
		diubah: "2026-07-06T00:00:00.000Z"
	}],
	terhapus: {}
};

describe("penomoran bersama Ceklis SD", () => {
	test("data Ceklis tetap utuh setelah dibaca & disimpan ulang SiLajur", () => {
		const a = normalisasiAgenda(JSON.parse(JSON.stringify(dariCeklis)));
		const ulang = JSON.parse(JSON.stringify(a));
		expect(ulang.keluar[0].naskah.kepada).toBe("Orang Tua");
		expect(ulang.masuk[0].lampiran).toEqual([{ id: "f1", nama: "scan.pdf" }]);
		expect(ulang.masuk[0].kolomBaru).toBe("tetap");
	});

	test("nomor SiLajur melanjutkan urutan Ceklis dan memperbarui entri yang sama", () => {
		const a = normalisasiAgenda(dariCeklis);
		const o = { sumber: "silajur:rapat:nota-1:undangan", jenisNaskah: "surat" as const, kodeKlasifikasi: "000.1.5", tglSurat: "2026-07-10", perihal: "Undangan Rapat Komite", tujuan: "Komite", singkatan: "SDN1" };
		const s = catatNomorDokumen(a.keluar, { ...o, id: entriSumber(a.keluar, o.sumber)?.id });
		expect(s.noAgenda).toBe(5);
		expect(s.noSurat).toBe("000.1.5/5/SDN1/2026");
		const daftar = [...a.keluar, s];
		const ulang = catatNomorDokumen(daftar, { ...o, id: entriSumber(daftar, o.sumber)?.id, kodeKlasifikasi: "000.1.6" });
		expect(ulang.id).toBe(s.id);
		expect(ulang.noSurat).toBe("000.1.6/5/SDN1/2026");
	});

	test("pola SE 7/2025 dan data klasifikasi Perbup 25/2023", () => {
		expect(usulanNomorKeluar({ jenisNaskah: "berita-acara", kodeKlasifikasi: "900.1", noAgenda: 3, singkatan: "SDN1", tahun: 2026, manual: true })).toBe("900.1/BA.3/SDN1/2026/M");
		expect(KLASIFIKASI_ARSIP.find(([k]) => k === "400.3.5.5")?.[1]).toBe("Bantuan Operasional Sekolah (BOS)");
	});
});
