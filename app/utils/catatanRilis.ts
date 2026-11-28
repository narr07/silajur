// Ubah catatan rilis (Markdown sederhana dari CATATAN_RILIS.md / GitHub Release) menjadi blok
// terstruktur yang dirender dengan komponen biasa, tanpa v-html, sehingga teks dari internet aman.

export interface SegmenTeks {
	teks: string
	tebal?: boolean
	kode?: boolean
}

export type BlokCatatan
	= | { jenis: "judul", segmen: SegmenTeks[] }
		| { jenis: "bagian", segmen: SegmenTeks[] }
		| { jenis: "paragraf", segmen: SegmenTeks[] }
		| { jenis: "daftar", item: SegmenTeks[][] };

const POLA_INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;
const POLA_JUDUL = /^(#{1,6})\s+(\S.*)$/;
const POLA_BUTIR = /^\s*(?:[-*+]|\d+[.)])\s+(\S.*)$/;
const POLA_TITIK_DUA = /:\s*$/;
const POLA_VERSI = /\d+\.\d+/;
const POLA_PISAH = /\s[-–—]\s/;

/** "**tebal**" dan "`kode`" menjadi segmen; sisanya teks biasa. */
export function segmenInline(baris: string): SegmenTeks[] {
	return baris.split(POLA_INLINE).filter(Boolean).map((s) => {
		if (s.startsWith("**") && s.endsWith("**") && s.length > 4) return { teks: s.slice(2, -2), tebal: true };
		if (s.startsWith("`") && s.endsWith("`") && s.length > 2) return { teks: s.slice(1, -1), kode: true };
		return { teks: s };
	});
}

/**
 * Susun blok dari Markdown. Judul tingkat 1-3 menjadi "judul" (judul rilis), tingkat 4+ menjadi
 * "bagian" (mis. "Fitur Baru"), butir "-"/"1." menjadi daftar, baris lain menjadi paragraf.
 * `lewatiJudulVersi`: buang judul pertama yang memuat nomor versi (sudah tampil di judul jendela).
 */
export function uraiCatatan(md: string, lewatiJudulVersi = true): BlokCatatan[] {
	const blok: BlokCatatan[] = [];
	let paragraf: string[] = [];
	const tutupParagraf = () => {
		if (paragraf.length) blok.push({ jenis: "paragraf", segmen: segmenInline(paragraf.join(" ")) });
		paragraf = [];
	};
	let judulPertama = true;
	for (const mentah of md.replaceAll("\r\n", "\n").split("\n")) {
		const baris = mentah.trim();
		if (!baris) {
			tutupParagraf();
			continue;
		}
		const j = baris.match(POLA_JUDUL);
		if (j) {
			tutupParagraf();
			const tingkat = j[1]!.length;
			const teks = j[2]!.replace(POLA_TITIK_DUA, "");
			if (tingkat <= 3 && judulPertama && lewatiJudulVersi && POLA_VERSI.test(teks)) {
				judulPertama = false;
				// Sisakan bagian setelah tanda pisah sebagai judul, mis. "SiLajur 0.5.0 - Ceklis BOSP" → "Ceklis BOSP".
				const sisa = teks.split(POLA_PISAH).slice(1).join(" - ").trim();
				if (sisa) blok.push({ jenis: "judul", segmen: segmenInline(sisa) });
				continue;
			}
			judulPertama = false;
			blok.push({ jenis: tingkat <= 3 ? "judul" : "bagian", segmen: segmenInline(teks) });
			continue;
		}
		const b = baris.match(POLA_BUTIR);
		if (b) {
			tutupParagraf();
			const akhir = blok.at(-1);
			const item = segmenInline(b[1]!);
			if (akhir?.jenis === "daftar") akhir.item.push(item);
			else blok.push({ jenis: "daftar", item: [item] });
			continue;
		}
		paragraf.push(baris);
	}
	tutupParagraf();
	return blok;
}
