// Ubah halaman PDF menjadi gambar (JPEG data URL) agar lampiran PDF ikut dicetak bersama dokumen lain.
// pdf.js dimuat saat dibutuhkan saja (offline, dibundel bersama aplikasi).

/** "data:application/pdf;base64,..." → byte. */
function dataUrlKeByte(dataUrl: string): Uint8Array {
	const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

/**
 * Render setiap halaman PDF menjadi gambar. `skala` 1,6 ≈ 115 dpi: cukup tajam untuk dicetak A4/F4
 * tanpa membuat memori membengkak. Mengembalikan satu data URL JPEG per halaman.
 */
export async function pdfKeGambar(dataUrl: string, skala = 1.6, maksHalaman = 30): Promise<string[]> {
	const pdfjs = await import("pdfjs-dist");
	const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
	pdfjs.GlobalWorkerOptions.workerSrc = worker;

	const doc = await pdfjs.getDocument({ data: dataUrlKeByte(dataUrl) }).promise;
	const hasil: string[] = [];
	try {
		for (let n = 1; n <= Math.min(doc.numPages, maksHalaman); n++) {
			const page = await doc.getPage(n);
			const viewport = page.getViewport({ scale: skala });
			const canvas = document.createElement("canvas");
			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);
			const ctx = canvas.getContext("2d");
			if (!ctx) break;
			// Latar putih: PDF transparan tidak tercetak hitam.
			ctx.fillStyle = "#fff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			await page.render({ canvas, canvasContext: ctx, viewport }).promise;
			hasil.push(canvas.toDataURL("image/jpeg", 0.85));
			page.cleanup();
		}
	} finally {
		await doc.destroy();
	}
	return hasil;
}
