// Test pengingat bulanan "belanjakan & buat SI" mulai tanggal 20.

import { describe, expect, test } from "bun:test";
import { pengingatBawaan, statusPengingat } from "../app/utils/pengingatBelanja";

const bulanan = (bulan: number, nilai: number) => Array.from({ length: 12 }, (_, i) => (i === bulan - 1 ? nilai : 0));
const rkas = [
	{ idRapbs: "a", bulan: bulanan(11, 500000) },
	{ idRapbs: "b", bulan: bulanan(11, 300000) },
	{ idRapbs: "c", bulan: bulanan(10, 900000) }
];
const realisasi = [{ idRapbs: "b", realisasi: bulanan(11, 300000) }];

const cek = (tanggal: string, o: Partial<Parameters<typeof statusPengingat>[0]> = {}) => statusPengingat({
	hariIni: new Date(`${tanggal}T09:00:00`),
	tahunAnggaran: 2026,
	pengaturan: pengingatBawaan(),
	rkas,
	realisasi,
	siUpdatedAt: [],
	...o
});

describe("pengingat belanja & SI", () => {
	test("belum muncul sebelum tanggal 20", () => {
		expect(cek("2026-11-19").tampil).toBe(false);
	});

	test("muncul mulai tanggal 20 dengan sisa bulan berjalan saja", () => {
		const s = cek("2026-11-20");
		expect(s.tampil).toBe(true);
		expect(s.sisa).toBe(500000);
		expect(s.itemBelum).toBe(1);
		expect(s.siDibuat).toBe(false);
	});

	test("tetap muncul bila SI belum dibuat walau belanja sudah lunas", () => {
		const s = cek("2026-11-25", { realisasi: [...realisasi, { idRapbs: "a", realisasi: bulanan(11, 500000) }] });
		expect(s.sisa).toBe(0);
		expect(s.tampil).toBe(true);
	});

	test("hilang bila lunas dan SI bulan ini sudah dibuat", () => {
		const s = cek("2026-11-25", {
			realisasi: [...realisasi, { idRapbs: "a", realisasi: bulanan(11, 500000) }],
			siUpdatedAt: ["2026-10-30T10:00:00.000Z", "2026-11-21T03:00:00.000Z"]
		});
		expect(s.siDibuat).toBe(true);
		expect(s.tampil).toBe(false);
	});

	test("ditunda sampai besok, ditandai selesai, dinonaktifkan, atau tahun anggaran lain", () => {
		expect(cek("2026-11-21", { pengaturan: { ...pengingatBawaan(), tundaSampai: "2026-11-21" } }).tampil).toBe(false);
		expect(cek("2026-11-22", { pengaturan: { ...pengingatBawaan(), tundaSampai: "2026-11-21" } }).tampil).toBe(true);
		expect(cek("2026-11-22", { pengaturan: { ...pengingatBawaan(), selesaiBulan: "2026-11" } }).tampil).toBe(false);
		expect(cek("2026-12-20", { pengaturan: { ...pengingatBawaan(), selesaiBulan: "2026-11" } }).tampil).toBe(true);
		expect(cek("2026-11-22", { pengaturan: { aktif: false, tanggal: 20 } }).tampil).toBe(false);
		expect(cek("2026-11-22", { tahunAnggaran: 2025 }).tampil).toBe(false);
	});

	test("tanggal pengingat bisa diubah", () => {
		expect(cek("2026-11-15", { pengaturan: { aktif: true, tanggal: 15 } }).tampil).toBe(true);
	});
});
