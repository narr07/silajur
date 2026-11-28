// Kelengkapan SPJ per transaksi BKU (daftar Kelengkapan SPJ BOSP Kabupaten Majalengka 2026).

import type { NotaGroup } from "../app/utils/types";
import { describe, expect, test } from "bun:test";
import { BATAS_PERSIAPAN, dokumenSpj, hitungBerkas, jenisBelanja, statusSpj } from "../app/utils/spj";

const grup = (o: Partial<NotaGroup> & { uraian: string, kode?: string }): NotaGroup => ({
	key: o.key ?? "k1",
	kind: "nota",
	tanggal: "2026-03-10",
	noBukti: "BNU01",
	uraian: o.uraian,
	fundName: "BOSP Reguler",
	nota: null,
	items: [{ id: "i1", tanggal: "2026-03-10", noBukti: "BNU01", uraian: o.uraian, kodeRekening: o.kode ?? "5.1.02.01.01.0024", kodeKegiatan: null, volume: 1, satuan: "paket", hargaSatuan: o.total ?? 500000, nominal: o.total ?? 500000 }],
	taxes: [],
	arkasTaxes: [],
	isSiplah: false,
	total: 500000,
	totalPajak: 0,
	diterima: 500000,
	mergeId: null,
	printedBukti: null,
	printedA2: null,
	printedNota: null,
	override: null,
	fileCount: 0,
	...o
});
const k = { rekeningNames: {}, rapat: {}, sppd: {} };
const ids = (g: NotaGroup, berkas?: Record<string, number>) => dokumenSpj(g, k, berkas).map((d) => d.id);
const jenis = (o: Parameters<typeof grup>[0]) => jenisBelanja(grup(o), {});

describe("kategori belanja sesuai daftar kabupaten", () => {
	test("ditebak dari uraian & kode rekening", () => {
		expect(jenis({ uraian: "Honor tenaga kebersihan bulan Maret" })).toBe("honor-bulanan");
		expect(jenis({ uraian: "Honor narasumber workshop" })).toBe("honor-kegiatan");
		expect(jenis({ uraian: "Pembayaran listrik PLN" })).toBe("langganan");
		expect(jenis({ uraian: "Pembelian materai 10000" })).toBe("materai");
		expect(jenis({ uraian: "Langganan surat kabar harian" })).toBe("media");
		expect(jenis({ uraian: "Kertas HVS A4" })).toBe("barang");
		expect(jenis({ uraian: "Kertas HVS A4", total: BATAS_PERSIAPAN + 1 })).toBe("barang-besar");
		expect(jenis({ uraian: "Kertas HVS A4", isSiplah: true })).toBe("barang-besar");
		expect(jenis({ uraian: "Cetak spanduk MPLS" })).toBe("cetakan");
		expect(jenis({ uraian: "Perbaikan atap kelas" })).toBe("jasa");
		expect(jenis({ uraian: "Konsumsi rapat komite" })).toBe("mamin-rapat");
		expect(jenis({ uraian: "Makan minum jamuan tamu pengawas" })).toBe("mamin-tamu");
		expect(jenis({ uraian: "Konsumsi peserta lomba O2SN" })).toBe("mamin-peserta");
		expect(jenis({ uraian: "Belanja makan minum harian pegawai", kode: "5.1.02.01.01.0043" })).toBe("natura");
		expect(jenis({ uraian: "Transport perjalanan dinas ke Korwil" })).toBe("perjalanan");
		expect(jenis({ uraian: "Pengadaan laptop", kode: "5.2.02.05.01.0002" })).toBe("modal");
	});
});

describe("dokumen wajib per kategori", () => {
	test("barang habis pakai < Rp1 juta: kuitansi, nota, foto barang, SI", () => {
		expect(ids(grup({ uraian: "Kertas HVS" }))).toEqual(["kwitansi", "nota", "foto-barang", "si"]);
	});

	test("barang SIPLah > Rp1 juta: perencanaan sampai foto, wajib SHP", () => {
		const g = grup({ uraian: "Kertas HVS", total: 2_000_000, isSiplah: true });
		const d = dokumenSpj(g, k);
		expect(d.map((x) => x.id)).toEqual(expect.arrayContaining(["perencanaan", "pembandingan", "sp", "shp", "bast", "kwitansi", "invoice", "foto-barang", "si"]));
		expect(d.find((x) => x.id === "shp")?.opsional).toBeUndefined();
		expect(d.find((x) => x.id === "siplah-proforma")?.opsional).toBe(true);
	});

	test("makan minum rapat wajib PB1; daftar hadir & notula otomatis dari generator rapat", () => {
		const g = grup({ uraian: "Konsumsi rapat komite", printedA2: "2026-03-11" });
		const d = dokumenSpj(g, { ...k, rapat: { k1: {} } }, { "": 1 });
		expect(d.map((x) => x.id)).toEqual(["kwitansi", "nota", "hadir", "notula", "foto-kegiatan", "pb1", "si"]);
		const s = statusSpj(d, { "foto-kegiatan": true, pb1: true, si: true });
		expect(s.lengkap).toBe(true);
	});

	test("perjalanan dinas: rekap hanya bila > 1 orang (bila ada)", () => {
		const d = dokumenSpj(grup({ uraian: "Perjalanan dinas ke Disdik" }), { ...k, sppd: { k1: {} } });
		expect(d.find((x) => x.id === "rekap-perjadin")?.opsional).toBe(true);
		expect(d.filter((x) => x.otomatis).map((x) => x.id)).toEqual(["rincian", "tugas", "spd", "laporan"]);
	});

	test("materai harus dari Kantor Pos; modal wajib foto berlabel kode aset", () => {
		expect(dokumenSpj(grup({ uraian: "Materai" }), k).find((x) => x.id === "nota")?.ket).toMatch(/Kantor Pos/);
		expect(ids(grup({ uraian: "Laptop", kode: "5.2.02.05.01.0002" }))).toEqual(["kwitansi", "invoice", "foto-aset", "ba-periksa", "si"]);
	});

	test("berkas unggahan & centang manual menghitung dokumen sebagai ada; SI wajib", () => {
		const g = grup({ uraian: "Kertas HVS" });
		const d = dokumenSpj(g, k, { "foto-barang": 2, "": 1 });
		expect(statusSpj(d, { kwitansi: true }).kurang).toEqual(["Standing Instruction (SI)"]);
		expect(statusSpj(d, { kwitansi: true, si: true }).lengkap).toBe(true);
	});
});

test("hitung berkas per transaksi; berkas tanpa penanda dihitung sebagai foto nota", () => {
	const h = hitungBerkas([{ id: "a", refId: "k1" }, { id: "b", refId: "k1" }, { id: "c", refId: "k2" }], { a: "invoice" });
	expect(h).toEqual({ k1: { invoice: 1, "": 1 }, k2: { "": 1 } });
});
