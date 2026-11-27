// Test Surat BOSP & Ceklis BOSP (dipindahkan dari Ceklis SD).

import type { Pengaturan, SchoolInfo } from "../app/utils/api";
import { describe, expect, test } from "bun:test";
import { ceklisBosp, semuaItem } from "../app/utils/bosp/ceklis";
import { buildDocx } from "../app/utils/bosp/docx";
import { namaSekolahPendek, profilSurat } from "../app/utils/bosp/profil";
import { regulasi } from "../app/utils/bosp/regulasi";
import { cariDokumen, nilaiAwal, paket, templates } from "../app/utils/bosp/templates";

const pengaturan = {
	pejabat: { kepalaSekolah: "Nama Kepala, S.Pd.", nipKepalaSekolah: "1980", bendahara: "Nama Bendahara", nipBendahara: "1990", komite: "Nama Komite" },
	kop: { pemerintah: "PEMERINTAH KABUPATEN CONTOH", dinas: "DINAS PENDIDIKAN", namaSekolah: "SD Negeri Contoh 1", alamat: "Jl. Pendidikan 1", email: "", laman: "", barisAlamat: "", barisKontak: "", logoKiri: "", logoKanan: "" },
	cetak: { kota: "Sukamaju", kertas: "A4" }
} as unknown as Pengaturan;

const sekolah = { npsn: "12345678", nama: "SD NEGERI CONTOH 1", kecamatan: "Sukamaju", kabupaten: "Kab. Contoh" } as SchoolInfo;

const profil = profilSurat({
	pengaturan,
	sekolah,
	guru: [
		{ id: "1", nama: "Guru Satu", nip: "", tugas: "Guru Kelas", kelasMapel: "Wali Kelas 1" },
		{ id: "2", nama: "Guru Dua", nip: "", tugas: "Operator", kelasMapel: "" }
	],
	surat: { kodeSurat: "SD-01" }
});

describe("profil surat", () => {
	test("diambil dari Pengaturan dan profil ARKAS", () => {
		expect(profil.sekolah).toBe("SD NEGERI CONTOH 1");
		expect(profil.kabupaten).toBe("Contoh");
		expect(profil.operator).toBe("Guru Dua");
		expect(profil.kopKontak).toContain("NPSN. 12345678");
		expect(namaSekolahPendek(profil)).toBe("SD Negeri Contoh 1");
	});
});

describe("template surat", () => {
	test("tanggal bawaan mengikuti tahun anggaran", () => {
		const dok = cariDokumen("sk-tim-bosp")!;
		const v = nilaiAwal(dok.fields, profil, 2027);
		expect(v.tgl).toBe("2027-01-02");
		expect(v.nomor).toBe("___/Kep.___-SD-01/2027");
	});

	test("semua template & paket bisa disusun dan diekspor ke .docx", async () => {
		for (const id of [...templates.map((t) => t.id), ...paket.map((p) => p.id)]) {
			const dok = cariDokumen(id)!;
			const blocks = dok.build(profil, nilaiAwal(dok.fields, profil, 2026));
			expect(blocks.length).toBeGreaterThan(0);
			const blob = await buildDocx(blocks, profil);
			const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
			expect([...head]).toEqual([0x50, 0x4B, 0x03, 0x04]);
		}
	});
});

describe("ceklis BOSP", () => {
	const idTemplate = new Set(templates.map((t) => t.id));
	const idRegulasi = new Set(regulasi.map((r) => r.id));

	test("rujukan template dan dasar aturan valid, id item unik", () => {
		const ids = (["kepsek", "bendahara"] as const).flatMap((p) => semuaItem(p).map((i) => i.id));
		expect(new Set(ids).size).toBe(ids.length);
		for (const kelompok of Object.values(ceklisBosp).flat()) {
			for (const it of kelompok.items) {
				if (it.template) expect(idTemplate.has(it.template)).toBe(true);
				if (it.dasar) expect(idRegulasi.has(it.dasar)).toBe(true);
				if (it.tautan) expect(it.tautan.to.startsWith("/")).toBe(true);
			}
		}
	});
});
