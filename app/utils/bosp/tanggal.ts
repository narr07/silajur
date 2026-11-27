// Tanggal & angka untuk naskah surat BOSP (dipindahkan dari Ceklis SD).
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu"];
const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function parse(iso: string) {
	const [y, m, d] = (iso || "").split("-").map(Number);
	return new Date(y || new Date().getFullYear(), (m || 1) - 1, d || 1);
}

export function tglPanjang(iso: string) {
	const d = parse(iso);
	return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}
export function hariTgl(iso: string) {
	const d = parse(iso);
	return `${HARI[d.getDay()]}, ${tglPanjang(iso)}`;
}
export function bulanRomawi(iso: string) {
	return ROMAWI[parse(iso).getMonth()];
}
export function tahun(iso: string) {
	return parse(iso).getFullYear();
}

const SATUAN = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

function eja(n: number): string {
	if (n < 12) return SATUAN[n]!;
	if (n < 20) return `${eja(n - 10)} Belas`;
	if (n < 100) return `${eja(Math.floor(n / 10))} Puluh ${eja(n % 10)}`.trim();
	if (n < 200) return `Seratus ${eja(n - 100)}`.trim();
	if (n < 1000) return `${eja(Math.floor(n / 100))} Ratus ${eja(n % 100)}`.trim();
	if (n < 2000) return `Seribu ${eja(n - 1000)}`.trim();
	if (n < 1e6) return `${eja(Math.floor(n / 1000))} Ribu ${eja(n % 1000)}`.trim();
	if (n < 1e9) return `${eja(Math.floor(n / 1e6))} Juta ${eja(n % 1e6)}`.trim();
	if (n < 1e12) return `${eja(Math.floor(n / 1e9))} Miliar ${eja(n % 1e9)}`.trim();
	return `${eja(Math.floor(n / 1e12))} Triliun ${eja(n % 1e12)}`.trim();
}

/** Ejaan angka bulat untuk berita acara; 0 ditulis "Nol". */
export function ejaAngka(n: number): string {
	const bulat = Math.floor(Math.abs(Number(n) || 0));
	return bulat === 0 ? "Nol" : eja(bulat);
}

/** "Kamis tanggal Delapan bulan Januari tahun Dua Ribu Dua Puluh Enam (08-01-2026)" */
export function tglTerbilang(iso: string) {
	const d = parse(iso);
	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	return `${HARI[d.getDay()]} tanggal ${ejaAngka(d.getDate())} bulan ${BULAN[d.getMonth()]} tahun ${ejaAngka(d.getFullYear())} (${dd}-${mm}-${d.getFullYear()})`;
}

/** "Rp1.500.000" (tanpa spasi, gaya naskah dinas). */
export function rp(n: number) {
	return `Rp${(n || 0).toLocaleString("id-ID")}`;
}
