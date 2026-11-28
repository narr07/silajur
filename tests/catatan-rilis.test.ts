// Catatan rilis di jendela pembaruan dirender terstruktur, bukan Markdown mentah.

import { expect, test } from "bun:test";
import { segmenInline, uraiCatatan } from "../app/utils/catatanRilis";

test("catatan rilis SiLajur menjadi judul, bagian, dan daftar", () => {
	const md = "### SiLajur 0.5.0 - Ceklis BOSP, Surat BOSP\n\nTugas BOSP kini ada di SiLajur.\n\n#### Fitur Baru:\n- Menu **Ceklis BOSP**\n- Pengingat `tanggal 20`\n\n#### Perubahan:\n1. Nomor surat";
	expect(uraiCatatan(md)).toEqual([
		{ jenis: "judul", segmen: [{ teks: "Ceklis BOSP, Surat BOSP" }] },
		{ jenis: "paragraf", segmen: [{ teks: "Tugas BOSP kini ada di SiLajur." }] },
		{ jenis: "bagian", segmen: [{ teks: "Fitur Baru" }] },
		{ jenis: "daftar", item: [[{ teks: "Menu " }, { teks: "Ceklis BOSP", tebal: true }], [{ teks: "Pengingat " }, { teks: "tanggal 20", kode: true }]] },
		{ jenis: "bagian", segmen: [{ teks: "Perubahan" }] },
		{ jenis: "daftar", item: [[{ teks: "Nomor surat" }]] }
	]);
});

test("teks tanpa Markdown tetap tampil sebagai paragraf; tanda tidak berpasangan dibiarkan", () => {
	expect(uraiCatatan("Perbaikan kecil.")).toEqual([{ jenis: "paragraf", segmen: [{ teks: "Perbaikan kecil." }] }]);
	expect(segmenInline("harga **50%")).toEqual([{ teks: "harga **50%" }]);
	expect(uraiCatatan("")).toEqual([]);
});
