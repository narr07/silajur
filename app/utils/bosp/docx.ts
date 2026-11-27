import type { Block, Orientasi, Sign } from "./blocks";
import type { ProfilSurat as Profil } from "./profil";
import { alignKolom, lebarKolom, parseBold, polaNomor, signColumns } from "./blocks";
import { kopLines } from "./profil";

const FONT = "Times New Roman";
const SIZE = 24; // 12pt

// Ukuran kertas A4 dalam twip dan margin per orientasi.
const A4_PENDEK = 11906;
const A4_PANJANG = 16838;
const MARGIN: Record<Orientasi, { top: number, bottom: number, left: number, right: number }> = {
	portrait: { top: 1134, bottom: 1134, left: 1701, right: 1134 },
	landscape: { top: 1021, bottom: 1021, left: 1134, right: 1134 }
};
/** Lebar area isi (twip) untuk orientasi halaman tertentu. */
export function lebarIsi(o: Orientasi): number {
	const lebarKertas = o === "landscape" ? A4_PANJANG : A4_PENDEK;
	return lebarKertas - MARGIN[o].left - MARGIN[o].right;
}

/** Ubah persen menjadi twip; kolom terakhir menyerap sisa pembulatan agar totalnya tepat. */
function twipKolom(persen: number[], lebar: number): number[] {
	const total = persen.reduce((a, n) => a + n, 0) || 1;
	const hasil = persen.map((n) => Math.floor((n / total) * lebar));
	const sisa = lebar - hasil.reduce((a, n) => a + n, 0);
	hasil[hasil.length - 1] = (hasil.at(-1) ?? 0) + sisa;
	return hasil;
}

function dataUrlToImage(url?: string) {
	if (!url?.startsWith("data:image/")) return null;
	const type = url.includes("image/png") ? "png" : url.includes("image/gif") ? "gif" : "jpg";
	const b64 = url.split(",")[1] || "";
	const bin = atob(b64);
	const data = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
	return { type, data } as { type: "png" | "jpg" | "gif", data: Uint8Array };
}

export async function buildDocx(blocks: Block[], p: Profil): Promise<Blob> {
	const d = await import("docx");
	const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, ImageRun, PageBreak, VerticalAlign, HeightRule, ShadingType, TabStopType, TableLayoutType, PageOrientation } = d;

	type Para = InstanceType<typeof Paragraph>;
	type Isi = Para | InstanceType<typeof Table>;

	const AL = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
	const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
	const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
	const GANTUNG = 454; // indentasi gantung daftar bernomor (≈ 0,8 cm)

	// Orientasi & lebar isi section yang sedang disusun.
	let orientasi: Orientasi = "portrait";
	let LEBAR = lebarIsi(orientasi);

	const runs = (text: string, o: { bold?: boolean, italic?: boolean, size?: number, underline?: boolean } = {}) =>
		parseBold(text).map((s) => new TextRun({ text: s.text, bold: o.bold || s.bold, italics: o.italic, size: o.size ?? SIZE, font: FONT, underline: o.underline ? {} : undefined }));

	const para = (text: string, o: { align?: keyof typeof AL, bold?: boolean, italic?: boolean, size?: number, indent?: boolean, after?: number, underline?: boolean } = {}) =>
		text.split("\n").map((line) => new Paragraph({
			alignment: AL[o.align ?? "left"],
			spacing: { after: o.after ?? 0, line: 240 },
			indent: o.indent ? { firstLine: 567 } : undefined,
			children: runs(line, o)
		}));

	/** Paragraf yang baris bernomornya ("1. ...", "a. ...") memakai indentasi gantung yang rapi. */
	const paraBernomor = (text: string, o: { align?: keyof typeof AL, bold?: boolean } = {}) => {
		let dalamDaftar = false;
		return text.split("\n").map((line) => {
			const nomor = polaNomor(line);
			if (nomor) dalamDaftar = true;
			return new Paragraph({
				alignment: AL[o.align ?? "left"],
				spacing: { after: 0, line: 240 },
				indent: nomor ? { left: GANTUNG, hanging: GANTUNG } : dalamDaftar ? { left: GANTUNG } : undefined,
				tabStops: nomor ? [{ type: TabStopType.LEFT, position: GANTUNG }] : undefined,
				children: nomor ? [new TextRun({ text: `${nomor.nomor}\t`, font: FONT, size: SIZE, bold: o.bold }), ...runs(nomor.isi, o)] : runs(line, o)
			});
		});
	};

	/** `o.w` = lebar sel dalam twip (lihat `twipKolom`). */
	const cell = (children: Para[], o: { w: number, borders?: boolean, shade?: boolean, vAlign?: "top" | "center", rowSpan?: number, columnSpan?: number }) =>
		new TableCell({
			children: children.length ? children : [new Paragraph("")],
			width: { size: o.w, type: WidthType.DXA },
			borders: o.borders ? undefined : { top: NONE, bottom: NONE, left: NONE, right: NONE },
			verticalAlign: o.vAlign === "center" ? VerticalAlign.CENTER : VerticalAlign.TOP,
			shading: o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: "E7EEF0" } : undefined,
			margins: { top: 40, bottom: 40, left: 70, right: 70 },
			rowSpan: o.rowSpan,
			columnSpan: o.columnSpan
		});

	/** Tabel dengan grid kolom tetap (twip) supaya Word & LibreOffice menampilkan lebar yang sama. */
	const tabel = (kolom: number[], rows: InstanceType<typeof TableRow>[], o: { borders?: boolean } = {}) =>
		new Table({
			width: { size: LEBAR, type: WidthType.DXA },
			columnWidths: kolom,
			layout: TableLayoutType.FIXED,
			...(o.borders ? {} : { borders: noBorders }),
			rows
		});

	const signCell = (s: Sign | undefined, w: number) => {
		if (!s) return cell([], { w });
		const align = s.rata ?? "center";
		const ps = [
			...(s.atas ? para(s.atas, { align }) : []),
			...para(s.jabatan, { align }),
			...(s.meterai ? [...para(" "), ...para("Meterai Rp10.000", { align, italic: true, size: 18 }), ...para(" ")] : para("\n\n\n")),
			...para(s.nama, { align, bold: true, underline: s.garisBawah !== false }),
			...(s.pangkat ? para(s.pangkat, { align }) : []),
			...(s.nip ? para(`NIP. ${s.nip}`, { align }) : [])
		];
		return cell(ps, { w });
	};

	const kop = () => {
		const kiri = dataUrlToImage(p.logoKiri);
		const kanan = dataUrlToImage(p.logoKanan);
		const kl = kopLines(p);
		const img = (x: ReturnType<typeof dataUrlToImage>) => x ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: x.type, data: x.data, transformation: { width: 72, height: 72 } } as never)] })] : [];
		const teks = [
			...(kl.pemda ? para(kl.pemda, { align: "center", bold: true, size: 28 }) : []),
			...(kl.dinas ? para(kl.dinas, { align: "center", bold: true, size: 28 }) : []),
			...(kl.sekolah ? para(kl.sekolah, { align: "center", bold: true, size: 32 }) : []),
			...(kl.alamat ? para(kl.alamat, { align: "center", italic: true, size: 18 }) : []),
			...(kl.kontak ? para(kl.kontak, { align: "center", italic: true, size: 18 }) : [])
		];
		const susunan: [Para[] | null, number][] = kiri && kanan
			? [[img(kiri), 14], [null, 72], [img(kanan), 14]]
			: kiri
				? [[img(kiri), 14], [null, 86]]
				: kanan
					? [[null, 86], [img(kanan), 14]]
					: [[null, 100]];
		const kolom = twipKolom(susunan.map(([, w]) => w), LEBAR);
		const rowCells = susunan.map(([isi], i) => cell(isi ?? teks, { w: kolom[i]!, vAlign: "center" }));
		return [
			tabel(kolom, [new TableRow({ children: rowCells })]),
			new Paragraph({ border: { bottom: { style: BorderStyle.THICK_THIN_SMALL_GAP, size: 18, color: "000000", space: 1 } }, spacing: { after: 120 }, children: [] })
		];
	};

	/** Baris judul tabel; dengan `kelompok`, kolom di bawah satu judul memakai dua baris judul. */
	const judulTabel = (b: Extract<Block, { t: "table" }>, kolom: number[], ukuran: number) => {
		const sel = (teks: string, w: number, extra: { rowSpan?: number, columnSpan?: number } = {}) =>
			cell(para(teks, { align: "center", bold: true, size: ukuran }), { w, borders: true, shade: true, vAlign: "center", ...extra });
		const kelompok = b.kelompok ?? [];
		if (!kelompok.length) {
			return [new TableRow({ tableHeader: true, cantSplit: true, children: b.head.map((h, i) => sel(h, kolom[i]!)) })];
		}
		const atas: InstanceType<typeof TableCell>[] = [];
		const bawah: InstanceType<typeof TableCell>[] = [];
		for (let i = 0; i < b.head.length;) {
			const k = kelompok.find((g) => g.mulai === i);
			if (k) {
				const lebarGrup = kolom.slice(i, i + k.jumlah).reduce((a, n) => a + n, 0);
				atas.push(sel(k.teks, lebarGrup, { columnSpan: k.jumlah }));
				for (let j = i; j < i + k.jumlah; j++) bawah.push(sel(b.head[j]!, kolom[j]!));
				i += k.jumlah;
			} else {
				atas.push(sel(b.head[i]!, kolom[i]!, { rowSpan: 2 }));
				i++;
			}
		}
		return [
			new TableRow({ tableHeader: true, cantSplit: true, children: atas }),
			new TableRow({ tableHeader: true, cantSplit: true, children: bawah })
		];
	};

	const sections: { orientasi: Orientasi, children: Isi[] }[] = [{ orientasi, children: [] }];
	let children = sections[0]!.children;

	for (const b of blocks) {
		switch (b.t) {
			case "kop":
				children.push(...kop());
				break;
			case "title":
				children.push(...para(b.text, { align: "center", bold: true, size: 26, underline: !b.sub }));
				if (b.sub) children.push(...para(b.sub, { align: "center", bold: true }));
				children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
				break;
			case "p":
				children.push(...para(b.text, { align: b.align, bold: b.bold, italic: b.italic, indent: b.indent, after: 120 }));
				break;
			case "space":
				for (let i = 0; i < (b.n ?? 1); i++) children.push(new Paragraph(""));
				break;
			case "break":
				children.push(new Paragraph({ children: [new PageBreak()] }));
				break;
			case "halaman": {
				// Section baru dimulai di halaman baru dengan orientasinya sendiri.
				orientasi = b.orientasi;
				LEBAR = lebarIsi(orientasi);
				const baru = { orientasi, children: [] as Isi[] };
				sections.push(baru);
				children = baru.children;
				break;
			}
			case "list":
				b.items.forEach((it, i) => {
					const mark = b.style === "alpha" ? `${String.fromCharCode(97 + i)}.` : b.style === "bullet" ? "•" : `${i + 1}.`;
					children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 60, line: 240 }, indent: { left: 567, hanging: 397 }, children: [new TextRun({ text: `${mark}\t`, font: FONT, size: SIZE }), ...runs(it)], tabStops: [{ type: TabStopType.LEFT, position: 567 }] }));
				});
				children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
				break;
			case "meta": {
				const kolom = twipKolom([24, 3, 73], LEBAR);
				children.push(tabel(kolom, b.rows.map(([k, v], i) => new TableRow({
					children: [
						cell(para(k, { bold: b.bold?.includes(i) }), { w: kolom[0]! }),
						cell(para(":", { align: "center" }), { w: kolom[1]! }),
						cell(paraBernomor(v, { align: "justify", bold: b.bold?.includes(i) }), { w: kolom[2]! })
					]
				}))));
				children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
				break;
			}
			case "table": {
				const kolom = twipKolom(lebarKolom(b), LEBAR);
				const rata = alignKolom(b);
				const ukuranIsi = b.kecil ? 16 : 22;
				const ukuranJudul = b.kecil ? 15 : 21;
				children.push(tabel(kolom, [
					...judulTabel(b, kolom, ukuranJudul),
					...b.rows.map((r) => new TableRow({
						cantSplit: true,
						height: b.tall ? { value: 520, rule: HeightRule.ATLEAST } : undefined,
						children: b.head.map((_, i) => cell(para(r[i] ?? "", { size: ukuranIsi, align: rata[i] }), { w: kolom[i]!, borders: true, vAlign: "center" }))
					}))
				], { borders: true }));
				children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
				break;
			}
			case "sign": {
				const cols = signColumns(b);
				const kolom = twipKolom(cols.map(() => 1), LEBAR);
				const cells = cols.map((s, i) => signCell(s, kolom[i]!));
				children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
				children.push(tabel(kolom, [new TableRow({ cantSplit: true, children: cells })]));
				break;
			}
			case "photos": {
				const rows: InstanceType<typeof TableRow>[] = [];
				const kolom = twipKolom([50, 50], LEBAR);
				for (let i = 0; i < b.n; i += 2) {
					rows.push(new TableRow({ cantSplit: true, height: { value: 3400, rule: HeightRule.EXACT }, children: [0, 1].map((j) => cell(i + j < b.n ? para("[ Tempel foto di sini ]", { align: "center", italic: true, size: 20 }) : [], { w: kolom[j]!, borders: i + j < b.n, vAlign: "center" })) }));
					rows.push(new TableRow({ cantSplit: true, children: [0, 1].map((j) => cell(i + j < b.n ? para(b.captions?.[i + j] ?? `Foto ${i + j + 1}`, { align: "center", size: 20 }) : [], { w: kolom[j]!, borders: i + j < b.n })) }));
				}
				children.push(tabel(kolom, rows, { borders: true }));
				break;
			}
		}
	}

	const doc = new Document({
		creator: p.sekolah,
		styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
		sections: sections
		// Section kosong (mis. dokumen yang langsung diawali blok `halaman`) dibuang agar tidak ada halaman kosong.
			.filter((s) => s.children.length || sections.length === 1)
			.map((s) => ({
				properties: {
					page: {
						// docx menukar lebar/tinggi sendiri bila orientasinya landscape.
						size: { width: A4_PENDEK, height: A4_PANJANG, orientation: s.orientasi === "landscape" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
						margin: MARGIN[s.orientasi]
					}
				},
				children: s.children
			}))
	});
	return Packer.toBlob(doc);
}
