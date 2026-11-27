export type Align = "left" | "center" | "right" | "justify";

export interface Sign {
	atas?: string // mis. "Sukamaju, 8 Januari 2026"
	jabatan: string // bisa multi-baris dengan \n
	nama: string
	nip?: string
	meterai?: boolean
	/** Baris pangkat/golongan di antara nama dan NIP, mis. "Penata Tk. I". */
	pangkat?: string
	/** Nama digarisbawahi (bawaan true). */
	garisBawah?: boolean
	/** Rata teks kolom tanda tangan (bawaan tengah). */
	rata?: "left" | "center"
}

/** Judul kolom bertingkat: kolom `mulai` sampai `mulai + jumlah - 1` berada di bawah satu judul. */
export interface KelompokKolom {
	mulai: number
	jumlah: number
	teks: string
}

export type Orientasi = "portrait" | "landscape";

export type Block
	= | { t: "kop" }
		| { t: "title", text: string, sub?: string }
		| { t: "p", text: string, align?: Align, bold?: boolean, indent?: boolean, italic?: boolean }
		| { t: "meta", rows: [string, string][], bold?: number[] }
		| { t: "list", items: string[], style?: "num" | "alpha" | "bullet" }
		| {
			t: "table"
			head: string[]
			rows: string[][]
			widths?: number[]
			tall?: boolean
			align?: Align[]
			/** Judul kelompok di atas beberapa kolom (baris judul kedua). */
			kelompok?: KelompokKolom[]
			/** Huruf lebih kecil untuk tabel lebar (lampiran). */
			kecil?: boolean
		}
		| { t: "sign", left?: Sign, right?: Sign, center?: Sign }
		| { t: "space", n?: number }
		| { t: "break" }
  /** Halaman baru dengan orientasi tertentu; berlaku sampai blok `halaman` berikutnya. */
		| { t: "halaman", orientasi: Orientasi }
		| { t: "photos", n: number, captions?: string[] };

const POLA_TEBAL = /(\*\*[^*]+\*\*)/g;

/** Teks dengan **tebal** sederhana */
export function parseBold(text: string): { text: string, bold: boolean }[] {
	return text.split(POLA_TEBAL).filter(Boolean).map((s) =>
		s.startsWith("**") ? { text: s.slice(2, -2), bold: true } : { text: s, bold: false });
}

const TANDA_TEBAL = /\*\*/g;
const POLA_ANGKA = /^-?(?:Rp\s?)?[\d.,]+(?:\s*\(\d+(?:[.,]\d+)?%\))?$/i;
const KOLOM_TENGAH = /^(?:no\.?|jml|jtm|jumlah jam|satuan|l\/p|jk|%|kondisi|waktu)$/i;
const POLA_NOMOR = /^(\d{1,3}\.|[a-z]\.|•)\s+(\S.*)$/;

/**
 * Perataan tiap kolom tabel: pakai `align` bila ditulis, selain itu ditebak:
 * kolom nomor & kode pendek di tengah, kolom yang seluruh isinya angka/rupiah rata kanan.
 */
export function alignKolom(b: Extract<Block, { t: "table" }>): Align[] {
	return b.head.map((h, i) => {
		const manual = b.align?.[i];
		if (manual) return manual;
		if (KOLOM_TENGAH.test(h.trim())) return "center";
		const isi = b.rows.map((r) => (r[i] ?? "").replace(TANDA_TEBAL, "").trim()).filter(Boolean);
		if (isi.length && isi.every((s) => POLA_ANGKA.test(s))) return "right";
		return "left";
	});
}

/** Lebar kolom dalam persen yang dijamin berjumlah 100. */
export function lebarKolom(b: Extract<Block, { t: "table" }>): number[] {
	const raw = b.widths?.length === b.head.length ? b.widths : b.head.map(() => 1);
	const total = raw.reduce((a, n) => a + n, 0) || 1;
	return raw.map((n) => (n / total) * 100);
}

/** Baris berawalan nomor/huruf ("1. ", "a. ") untuk indentasi gantung di daftar Menimbang/Mengingat. */
export function polaNomor(baris: string): { nomor: string, isi: string } | null {
	const m = baris.match(POLA_NOMOR);
	return m ? { nomor: m[1]!, isi: m[2]! } : null;
}

/** Pemisah halaman: blok `break` atau `halaman`. */
export const pemisahHalaman = (b: Block) => b.t === "break" || b.t === "halaman";

/** Kolom tanda tangan dengan jumlah baris kepala yang disamakan, agar nama sejajar */
export function signColumns(b: Extract<Block, { t: "sign" }>): (Sign | undefined)[] {
	const cols = b.center && (b.left || b.right) ? [b.left, b.center, b.right] : b.center ? [undefined, b.center, undefined] : [b.left, b.right];
	const head = (s?: Sign) => s ? (s.atas ? s.atas.split("\n").length : 0) + s.jabatan.split("\n").length : 0;
	const max = Math.max(...cols.map(head));
	return cols.map((s) => {
		if (!s) return s;
		const atas = s.atas ?? "";
		const nAtas = s.atas ? atas.split("\n").length : 0;
		const pad = max - head(s);
		// tambahkan baris kosong di atas agar jabatan & nama sejajar
		return { ...s, atas: [...Array.from({ length: pad }).fill(" "), ...(nAtas ? atas.split("\n") : [])].join("\n") || undefined };
	});
}
