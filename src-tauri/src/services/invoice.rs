//! Membaca invoice SIPLah (PDF berteks) menjadi satu baris rincian Standing Instruction.
//!
//! Pencocokan memakai label yang tercetak di invoice ("Nama Penyedia", "Virtual Akun (Bank ...)",
//! "No. VA / No. Rek", "GRAND TOTAL", ...), bukan posisi koordinat, sehingga tahan terhadap
//! perbedaan tata letak antar marketplace. Format yang diuji: Toko Ladang dan Blibli.
//! Kolom yang tidak ketemu dibiarkan kosong dan dilaporkan di `peringatan` agar pengguna
//! mengisinya sendiri.

use serde::Serialize;

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoicePdf {
	/// Nomor invoice, mis. `13028934/INV/PO6AE8A42F46F33/PROFORMA`.
	pub nomor: Option<String>,
	/// Kode pesanan SIPLah (`PO...` di Toko Ladang, `S1...` di Blibli) bila tercantum.
	pub kode_pesanan: Option<String>,
	/// Tanggal dokumen dalam format `YYYY-MM-DD`.
	pub tanggal: Option<String>,
	pub penyedia: Option<String>,
	pub bank: Option<String>,
	/// Nomor Virtual Account atau rekening tujuan pembayaran (hanya angka).
	pub no_rekening: Option<String>,
	/// Jumlah yang harus dibayar sekolah (rupiah bulat).
	pub total: Option<i64>,
	pub ppn: Option<i64>,
	pub pph22: Option<i64>,
	pub barang: Vec<String>,
	/// `true` bila dokumen adalah invoice pelunasan (pesanan sudah dibayar), bukan proforma.
	pub lunas: bool,
	/// Usulan keterangan belanja untuk rincian SI.
	pub keterangan: String,
	pub peringatan: Vec<String>,
}

const NAMA_BULAN: [&str; 12] = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const BANK_DIKENAL: [&str; 16] =
	["BJB", "BRI", "BNI", "MANDIRI", "BCA", "BSI", "BTN", "CIMB", "PERMATA", "DANAMON", "MUAMALAT", "MEGA", "OCBC", "PANIN", "SINARMAS", "DKI"];

pub fn parse_invoice(teks: &str) -> InvoicePdf {
	let baris: Vec<&str> = teks.lines().map(str::trim).filter(|l| !l.is_empty()).collect();

	let nomor = cari_nomor(&baris);
	let kode_pesanan = cari_nilai_label(&baris, &["nomor order", "no. order", "nomor pesanan", "no. pesanan"])
		.and_then(|v| v.split_whitespace().next().map(str::to_string))
		.or_else(|| cari_kode_po(teks));
	let tanggal = cari_tanggal(&baris);
	let penyedia = cari_nilai_label(&baris, &["nama penyedia", "nama toko", "nama penjual", "nama mitra"]).or_else(|| cari_dari(&baris));
	let (bank, no_rekening) = cari_rekening(&baris);

	let pasangan = pasangan_label_nilai(&baris);
	let total = cari_tagihan(&baris).or_else(|| {
		nilai_pertama(&pasangan, |l| {
			l.starts_with("grand total") || l.starts_with("total tagihan") || l.starts_with("total pembayaran") || l.starts_with("total bayar")
		})
	});
	let ppn = jumlah_semua(&pasangan, |l| l.starts_with("ppn"));
	let pph22 = jumlah_semua(&pasangan, |l| l.starts_with("pph pasal 22") || l.starts_with("pph 22"));
	let barang = cari_barang(&baris);
	let lunas = baris.iter().take(8).any(|l| {
		let k = l.to_lowercase();
		k.contains("bukti pembayaran") || k.contains("pembayaran telah lunas")
	});

	let mut peringatan = Vec::new();
	if lunas {
		peringatan.push("Ini invoice pelunasan: pesanan tercatat sudah dibayar".to_string());
	}
	if penyedia.is_none() {
		peringatan.push("Nama penyedia tidak ditemukan".to_string());
	}
	if no_rekening.is_none() {
		peringatan.push("Nomor Virtual Account / rekening tidak ditemukan".to_string());
	}
	if bank.is_none() {
		peringatan.push("Nama bank tidak ditemukan".to_string());
	}
	if total.is_none() {
		peringatan.push("Total tagihan tidak ditemukan".to_string());
	}

	let keterangan = susun_keterangan(&barang);

	InvoicePdf { nomor, kode_pesanan, tanggal, penyedia, bank, no_rekening, total, ppn, pph22, barang, lunas, keterangan, peringatan }
}

/// Posisi byte `jarum` (ASCII) di `l` tanpa membedakan huruf besar/kecil.
fn cari_ci(l: &str, jarum: &str) -> Option<usize> {
	let (b, j) = (l.as_bytes(), jarum.as_bytes());
	(0..=b.len().checked_sub(j.len())?).find(|&i| b[i..i + j.len()].eq_ignore_ascii_case(j))
}

/// Teks sesudah `label:` pada baris yang dimulai dengan label itu. Bila nilainya kosong,
/// baris berikutnya dipakai (format yang menaruh nilai di bawah label).
fn cari_nilai_label(baris: &[&str], label: &[&str]) -> Option<String> {
	for lab in label {
		for (i, l) in baris.iter().enumerate() {
			if cari_ci(l, lab) != Some(0) {
				continue;
			}
			let Some(sisa) = l[lab.len()..].trim_start().strip_prefix(':') else { continue };
			let nilai = sisa.trim();
			if !nilai.is_empty() {
				return Some(nilai.to_string());
			}
			if let Some(berikut) = baris.get(i + 1) {
				if !berikut.contains(':') {
					return Some(berikut.to_string());
				}
			}
		}
	}
	None
}

/// `NO: 1302/INV/...` (Toko Ladang) atau `... Proforma Invoice No. INV/SKRA-0019/INVOICE_2606-` + `35605`
/// yang terpotong ke baris berikutnya (Blibli).
fn cari_nomor(baris: &[&str]) -> Option<String> {
	for (i, l) in baris.iter().enumerate() {
		let sisa = if cari_ci(l, "no:") == Some(0) {
			&l[3..]
		} else if let Some(p) = cari_ci(l, "invoice no.") {
			&l[p + 11..]
		} else {
			continue;
		};
		let Some(mut nomor) = sisa.split_whitespace().next().map(str::to_string) else { continue };
		if nomor.ends_with(['-', '_', '/']) {
			if let Some(lanjut) = baris.get(i + 1).and_then(|b| b.split_whitespace().next()) {
				if lanjut.chars().all(|c| c.is_ascii_alphanumeric()) {
					nomor.push_str(lanjut);
				}
			}
		}
		return Some(nomor);
	}
	None
}

fn cari_kode_po(teks: &str) -> Option<String> {
	teks.split(|c: char| !c.is_ascii_alphanumeric())
		.find(|t| t.len() >= 8 && t.starts_with("PO") && t[2..].chars().all(|c| c.is_ascii_digit() || c.is_ascii_uppercase()) && t[2..].chars().any(|c| c.is_ascii_digit()))
		.map(str::to_string)
}

/// `Tanggal Dokumen : 09/11/2026` atau `... Tanggal Dokumen 10 Juni 2026` (label di tengah baris).
fn cari_tanggal(baris: &[&str]) -> Option<String> {
	baris.iter().find_map(|l| {
		let p = cari_ci(l, "tanggal dokumen")?;
		tanggal_iso(l[p + 15..].trim_start_matches([' ', ':']))
	})
}

/// `09/11/2026`, `09-11-2026`, atau `10 Juni 2026` menjadi `YYYY-MM-DD`.
fn tanggal_iso(v: &str) -> Option<String> {
	let token: Vec<&str> = v.split_whitespace().collect();
	let (d, m, y): (u32, u32, u32) = match token.as_slice() {
		[d, bln, y, ..] if bln.chars().all(char::is_alphabetic) => {
			let bln = bln.to_lowercase();
			let m = NAMA_BULAN.iter().position(|n| *n == bln || (bln.len() >= 3 && n.starts_with(bln.as_str())))? as u32 + 1;
			(d.parse().ok()?, m, y.parse().ok()?)
		}
		[t, ..] => {
			let bagian: Vec<&str> = t.split(['/', '-', '.']).collect();
			let [d, m, y] = bagian.as_slice() else { return None };
			(d.parse().ok()?, m.parse().ok()?, y.parse().ok()?)
		}
		[] => return None,
	};
	if !(1..=31).contains(&d) || !(1..=12).contains(&m) || !(2000..=2100).contains(&y) {
		return None;
	}
	Some(format!("{y:04}-{m:02}-{d:02}"))
}

/// Penyedia di blok `Dari:` (Blibli): baris pertama sesudahnya.
fn cari_dari(baris: &[&str]) -> Option<String> {
	let i = baris.iter().position(|l| l.eq_ignore_ascii_case("dari:") || l.eq_ignore_ascii_case("dari"))?;
	let nama = baris.get(i + 1)?;
	(!nama.contains(':')).then(|| nama.to_string())
}

/// Bank dan nomor VA dari baris `Virtual Akun (Bank BJB) : 1845000013028934` (Toko Ladang)
/// atau dari tabel di bawah judul `Bank ... No. VA / No. Rek` (Blibli).
fn cari_rekening(baris: &[&str]) -> (Option<String>, Option<String>) {
	let label = ["virtual akun", "virtual account", "nomor va", "no. va", "nomor rekening", "no. rekening", "no rekening"];
	for l in baris {
		if !label.iter().any(|lab| cari_ci(l, lab) == Some(0)) {
			continue;
		}
		let Some((kiri, kanan)) = l.split_once(':') else { continue };
		let nomor: String = kanan.chars().take_while(|c| c.is_ascii_digit() || c.is_whitespace() || *c == '-').filter(char::is_ascii_digit).collect();
		if nomor.len() < 6 {
			continue;
		}
		let bank = kiri.split_once('(').and_then(|(_, b)| b.split(')').next()).map(nama_bank).filter(|b| !b.is_empty());
		let bank = bank.or_else(|| cari_nilai_label(baris, &["nama bank"]).map(|b| nama_bank(&b)).filter(|b| !b.is_empty()));
		return (bank, Some(nomor));
	}

	// Tabel: judul memuat "No. VA", lalu baris berisi bank, cabang, nomor VA, atas nama.
	let Some(judul) = baris.iter().position(|l| cari_ci(l, "no. va").is_some() || cari_ci(l, "nomor va").is_some()) else {
		return (None, None);
	};
	let mut bank = None;
	for l in &baris[judul + 1..baris.len().min(judul + 8)] {
		for token in l.split_whitespace() {
			if (10..=20).contains(&token.len()) && token.chars().all(|c| c.is_ascii_digit()) {
				return (bank, Some(token.to_string()));
			}
			if bank.is_none() {
				let t = token.trim_matches(|c: char| !c.is_ascii_alphanumeric()).to_uppercase();
				if BANK_DIKENAL.contains(&t.as_str()) {
					bank = Some(t);
				}
			}
		}
	}
	(bank, None)
}

/// `Bank BJB` → `BJB`, `bank mandiri` → `MANDIRI`.
fn nama_bank(v: &str) -> String {
	let v = v.trim();
	let tanpa = match v.get(..5) {
		Some(awal) if awal.eq_ignore_ascii_case("bank ") => &v[5..],
		_ => v,
	};
	tanpa.trim().to_uppercase()
}

/// Rupiah pertama pada baris (`Rp. 563,500`, `Rp 563.500`, `Rp563.500,00`).
pub fn parse_rupiah(l: &str) -> Option<i64> {
	let posisi = posisi_rp(l)?;
	let sisa = &l[posisi + 2..];
	let sisa = sisa.trim_start_matches(['.', ' ']);
	let negatif = sisa.starts_with('-');
	let angka: String = sisa.trim_start_matches('-').chars().take_while(|c| c.is_ascii_digit() || *c == '.' || *c == ',').collect();
	let angka = angka.trim_end_matches(['.', ',']);
	if angka.is_empty() || !angka.starts_with(|c: char| c.is_ascii_digit()) {
		return None;
	}
	// Pemisah terakhir yang diikuti 1-2 digit adalah desimal (sen); dibuang.
	let bulat = match angka.rfind(['.', ',']) {
		Some(i) if (1..=2).contains(&(angka.len() - i - 1)) => &angka[..i],
		_ => angka,
	};
	let digit: String = bulat.chars().filter(char::is_ascii_digit).collect();
	let n: i64 = digit.parse().ok()?;
	Some(if negatif { -n } else { n })
}

/// Posisi byte awalan `Rp` yang benar-benar diikuti nominal (bukan bagian kata seperti "Sharp").
fn posisi_rp(l: &str) -> Option<usize> {
	let b = l.as_bytes();
	(0..b.len().saturating_sub(1)).find(|&i| {
		if !b[i..i + 2].eq_ignore_ascii_case(b"rp") || (i > 0 && b[i - 1].is_ascii_alphanumeric()) {
			return false;
		}
		let setelah = b[i + 2..].iter().find(|c| **c != b'.' && **c != b' ');
		matches!(setelah, Some(c) if c.is_ascii_digit() || *c == b'-')
	})
}

fn ada_rp(l: &str) -> bool {
	posisi_rp(l).is_some()
}

/// Baris yang isinya hanya satu nominal, mis. `Rp. 55,857`.
fn hanya_rupiah(l: &str) -> bool {
	posisi_rp(l) == Some(0) && posisi_rp(&l[2..]).is_none()
}

/// Kalimat "Tagihan yang perlu dibayarkan ..." diikuti nominal pada baris yang sama atau sesudahnya.
fn cari_tagihan(baris: &[&str]) -> Option<i64> {
	let i = baris.iter().position(|l| {
		let k = l.to_lowercase();
		k.contains("tagihan yang perlu dibayar") || k.contains("total yang harus dibayar") || k.contains("jumlah yang harus dibayar")
	})?;
	baris[i..].iter().take(3).find_map(|l| parse_rupiah(l))
}

/// Pasangan (label huruf kecil, nominal). Mendukung `LABEL Rp. x` dalam satu baris maupun
/// blok label yang diikuti blok nominal berjumlah sama (tabel ringkasan yang diekstrak per kolom).
fn pasangan_label_nilai(baris: &[&str]) -> Vec<(String, i64)> {
	let mut hasil = Vec::new();
	let mut i = 0;
	while i < baris.len() {
		let l = baris[i];
		if !ada_rp(l) {
			let awal = i;
			while i < baris.len() && !ada_rp(baris[i]) {
				i += 1;
			}
			let label = &baris[awal..i];
			let mulai_nilai = i;
			while i < baris.len() && hanya_rupiah(baris[i]) {
				i += 1;
			}
			let nilai = &baris[mulai_nilai..i];
			if !nilai.is_empty() && nilai.len() <= label.len() {
				// Label paling bawah berpasangan dengan nilai: baris di atasnya bisa judul blok.
				let label = &label[label.len() - nilai.len()..];
				for (lab, nil) in label.iter().zip(nilai) {
					if let Some(n) = parse_rupiah(nil) {
						hasil.push((lab.to_lowercase(), n));
					}
				}
			}
			continue;
		}
		if let Some(pos) = posisi_rp(l) {
			let label = l[..pos].trim().to_lowercase();
			if !label.is_empty() {
				if let Some(n) = parse_rupiah(l) {
					hasil.push((label, n));
				}
			}
		}
		i += 1;
	}
	hasil
}

fn nilai_pertama(pasangan: &[(String, i64)], cocok: impl Fn(&str) -> bool) -> Option<i64> {
	pasangan.iter().find(|(l, _)| cocok(l)).map(|(_, n)| *n)
}

fn jumlah_semua(pasangan: &[(String, i64)], cocok: impl Fn(&str) -> bool) -> Option<i64> {
	let cocok: Vec<i64> = pasangan.iter().filter(|(l, _)| cocok(l)).map(|(_, n)| *n).collect();
	(!cocok.is_empty()).then(|| cocok.iter().sum())
}

/// Nama barang dari tabel. Toko Ladang: `N NAMA BARANG` (bisa berlanjut ke baris berikut) lalu
/// baris `2 X Rp. 30,500`. Blibli: baris `N` sendiri, nama di baris berikut, lalu baris harga.
/// Baris ongkos kirim dilewati.
fn cari_barang(baris: &[&str]) -> Vec<String> {
	let mut hasil = Vec::new();
	let mut harap = 1u32;
	let mut i = 0;
	while i < baris.len() {
		let l = baris[i];
		// Nomor urut boleh melompat sedikit: barang yang terpotong pindah halaman tidak ikut terbaca.
		let Some((no, nama)) = (harap..harap + 3).find_map(|n| {
			let no = n.to_string();
			if l == no {
				Some((n, ""))
			} else {
				l.strip_prefix(&format!("{no} ")).map(|r| (n, r))
			}
		}) else {
			i += 1;
			continue;
		};
		if ada_rp(nama) || !(nama.is_empty() || nama.starts_with(|c: char| c.is_alphabetic())) {
			i += 1;
			continue;
		}
		let mut nama = nama.trim().to_string();
		let mut j = i + 1;
		let mut tertutup = false;
		while j < baris.len() && j <= i + 4 {
			if ada_rp(baris[j]) || baris[j].starts_with('=') {
				tertutup = true;
				break;
			}
			if !nama.is_empty() {
				nama.push(' ');
			}
			nama.push_str(baris[j]);
			j += 1;
		}
		if tertutup && !nama.is_empty() {
			let k = nama.to_lowercase();
			if !(k.starts_with("jasa pengiriman") || k.starts_with("ongkos kirim") || k.starts_with("biaya pengiriman")) {
				hasil.push(nama);
			}
			harap = no + 1;
			i = j;
		} else {
			i += 1;
		}
	}
	hasil
}

/// Huruf kapital di awal kata. Bagian `@...` (mis. `@ayam`) dibuang agar keterangan tetap pendek.
fn judul_kata(v: &str) -> String {
	v.split_whitespace()
		.map(|w| w.split('@').next().unwrap_or(""))
		.filter(|w| !w.is_empty())
		.map(|w| {
			let mut c = w.chars();
			match c.next() {
				Some(f) => f.to_uppercase().collect::<String>() + &c.as_str().to_lowercase(),
				None => String::new(),
			}
		})
		.collect::<Vec<_>>()
		.join(" ")
}

fn susun_keterangan(barang: &[String]) -> String {
	let mut nama: Vec<String> = Vec::new();
	for b in barang {
		let b = judul_kata(b);
		if !b.is_empty() && !nama.iter().any(|n| n.eq_ignore_ascii_case(&b)) {
			nama.push(b);
		}
	}
	let dua = match nama.len() {
		0 => return "Pembayaran invoice SIPLah".to_string(),
		1 => return format!("Belanja {}", nama[0]),
		2 => format!("Belanja {}, {}", nama[0], nama[1]),
		_ => format!("Belanja {}, {}, dll.", nama[0], nama[1]),
	};
	// Nama barang panjang: cukup barang pertama agar kolom keterangan SI tidak penuh.
	if dua.chars().count() > 70 {
		format!("Belanja {}, dll.", nama[0])
	} else {
		dua
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	/// Teks hasil ekstraksi proforma invoice SIPLah (data identitas fiktif).
	const CONTOH: &str = "SIPLah Toko Contoh
(PT. Contoh Karya)
NPWP 000000000000000
PROFORMA INVOICE
NO: 12345678/INV/PO1A2B3C4D5E6F7/PROFORMA
Tanggal Dokumen : 09/11/2026

Dari
Nama Penyedia: KOPERASI MAJU
Alamat Penyedia: Jalan Raya Nomor 1
Kontak Penyedia: 080000000000
 Untuk
Nama Satdik: SD NEGERI CONTOH
Pembayaran

Virtual Akun (Bank BJB) : 1845000012345678
Bayar Sebelum: 09/02/2027 09:43:56
 Metode Pengiriman:
Kurir Toko

No Barang/jasa Harga
sebelum PPN PPN
per Item Kuantitas Total Harga
sebelum PPN
Pesan Terima

1 AMPLOP BESAR
2 X Rp. 30,500
= Rp. 61,000
 Rp. 27,477 Rp. 3,023 2 2 Rp. 54,954

2 TINTA PRINTER EPSON
WARNA BIRU
1 X Rp. 99,500
= Rp. 99,500
 Rp. 89,639 Rp. 9,861 1 1 Rp. 89,639

3 KLIP KERTAS
5 X Rp. 3,000
= Rp. 15,000
 Rp. 2,702 Rp. 298 5 5 Rp. 13,510

4 SPIDOL SHARP 
3 X Rp. 17,500
= Rp. 52,500
 Rp. 15,765 Rp. 1,735 3 3 Rp. 47,295

https://contoh.example/document/PO1A2B3C4D5E6F7/proforma-invoice Halaman 1

DPP Nilai Lain (Barang/Jasa)
PPN (12%)
DPP Nilai Lain (Ongkos Kirim)
PPN (12%)
 Rp. 465,336
Rp. 55,857
Rp. 0
Rp. 1,000

GRAND TOTAL Rp. 563,500

DPP PPh Pasal 22 (Barang/Jasa)
PPh Pasal 22
DPP PPh Pasal 22 (Ongkir)
PPh Pasal 22
 Rp. 507,643
Rp. 2,538
Rp. 0
Rp. 0

*PPN yang dikenakan telah menggunakan perhitungan terbaru sesuai dengan PMK No. 131 Tahun 2024.
Tagihan yang perlu dibayarkan oleh Sekolah adalah sebagai berikut:
Rp. 564,500

Lima Ratus Enam Puluh Empat Ribu Lima Ratus Rupiah
";

	#[test]
	fn membaca_proforma_invoice_siplah() {
		let inv = parse_invoice(CONTOH);
		assert_eq!(inv.nomor.as_deref(), Some("12345678/INV/PO1A2B3C4D5E6F7/PROFORMA"));
		assert_eq!(inv.kode_pesanan.as_deref(), Some("PO1A2B3C4D5E6F7"));
		assert_eq!(inv.tanggal.as_deref(), Some("2026-11-09"));
		assert_eq!(inv.penyedia.as_deref(), Some("KOPERASI MAJU"));
		assert_eq!(inv.bank.as_deref(), Some("BJB"));
		assert_eq!(inv.no_rekening.as_deref(), Some("1845000012345678"));
		// Tagihan yang dibayar sekolah diutamakan daripada GRAND TOTAL.
		assert_eq!(inv.total, Some(564_500));
		assert_eq!(inv.ppn, Some(56_857));
		assert_eq!(inv.pph22, Some(2_538));
		assert_eq!(inv.barang, vec!["AMPLOP BESAR", "TINTA PRINTER EPSON WARNA BIRU", "KLIP KERTAS", "SPIDOL SHARP"]);
		assert_eq!(inv.keterangan, "Belanja Amplop Besar, Tinta Printer Epson Warna Biru, dll.");
		assert!(!inv.lunas);
		assert!(inv.peringatan.is_empty(), "{:?}", inv.peringatan);
	}


	/// Teks hasil ekstraksi proforma invoice SIPLah Blibli (data identitas fiktif).
	const CONTOH_BLIBLI: &str = "Halaman 1 dari 2
PROFORMA INVOICE
Penting!
Nomor rekening diatas hanya berlaku untuk pembayaran pesanan dengan nomor order S10000000001
PT Contoh Niaga (SIPLah Blibli) Proforma Invoice No. INV/SKRA-0019/INVOICE_2606-
35605
NPWP Mitra 00.000.000.0-000.000 Tanggal Dokumen 10 Juni 2026
Dari:
KOPERASI MAJU
JL RAYA NO.1
 Kepada:
Nama Bendahara
SD NEGERI CONTOH
 Nomor Order:
S10000000001
NPWP Penyedia:
000000000000000 NPSN Satdik:
Batas pembayaran Bank Cabang Bank No. VA / No. Rek
Tujuan Atas nama
09 Agustus 2026 BRI BRI KCK (Kantor
Cabang Khusus)
Sudirman Jakarta 1473410000000001 SD NEGERI CONTOH
- SIPLah Blibli
No. Nama Barang / Jasa Harga
Sebelum PPN
1
 Buku Daftar Kelas
Rp38.000
Barang > Alat Tulis Kantor > Buku Tulis
Barang Tidak Kena PPN
 Rp38.000 Rp0 6 6 Rp228.000
2
 KUNCI GEMBOK
Rp275.000
Barang Kena PPN
 Rp247.747 Rp27.253 2 2 Rp495.494
Halaman 2 dari 2
NAMA BARANG TERPOTONG
Rp63.500
3 Rp63.500 Rp0 2 2 Rp127.000
4
 BUKU AGENDA HARIAN
Rp48.000
 Rp48.000 Rp0 6 6 Rp288.000
5 Jasa Pengiriman
Rp0 Rp0 Rp0 - - Rp0
Total sebelum PPN
*DPP Nilai Lain
PPN 12%
 Rp1.138.494
Rp454.204
Rp54.506
GRAND TOTAL Rp1.193.000
DPP PPh
PPh Pasal 22
 Rp1.138.494
Rp5.692
";

	#[test]
	fn membaca_proforma_invoice_blibli() {
		let inv = parse_invoice(CONTOH_BLIBLI);
		assert_eq!(inv.nomor.as_deref(), Some("INV/SKRA-0019/INVOICE_2606-35605"));
		assert_eq!(inv.kode_pesanan.as_deref(), Some("S10000000001"));
		assert_eq!(inv.tanggal.as_deref(), Some("2026-06-10"));
		assert_eq!(inv.penyedia.as_deref(), Some("KOPERASI MAJU"));
		assert_eq!(inv.bank.as_deref(), Some("BRI"));
		assert_eq!(inv.no_rekening.as_deref(), Some("1473410000000001"));
		assert_eq!(inv.total, Some(1_193_000));
		assert_eq!(inv.ppn, Some(54_506));
		assert_eq!(inv.pph22, Some(5_692));
		assert_eq!(inv.barang, vec!["Buku Daftar Kelas", "KUNCI GEMBOK", "BUKU AGENDA HARIAN"]);
		assert_eq!(inv.keterangan, "Belanja Buku Daftar Kelas, Kunci Gembok, dll.");
		assert!(inv.peringatan.is_empty(), "{:?}", inv.peringatan);
	}

	#[test]
	fn invoice_pelunasan_diberi_peringatan() {
		let teks = CONTOH_BLIBLI.replace("PROFORMA INVOICE", "INVOICE / BUKTI PEMBAYARAN\n*Dokumen ini terbit ketika pembayaran telah lunas/dilakukan.");
		let inv = parse_invoice(&teks);
		assert!(inv.lunas);
		assert_eq!(inv.peringatan.len(), 1);
	}

	#[test]
	fn keterangan_tanpa_nama_ganda() {
		let barang = vec!["NASI KOTAK @AYAM".to_string(), "Nasi Kotak @ayam".to_string(), "Snack@25rb".to_string()];
		assert_eq!(susun_keterangan(&barang), "Belanja Nasi Kotak, Snack");
		let panjang = vec!["PENGGANDAAN SOAL SUMATIF AKHIR SEMESTER I KELAS 1".to_string(), "PENGGANDAAN SOAL SUMATIF AKHIR SEMESTER I KELAS 2".to_string()];
		assert_eq!(susun_keterangan(&panjang), "Belanja Penggandaan Soal Sumatif Akhir Semester I Kelas 1, dll.");
	}

	#[test]
	fn tanggal_berbagai_format() {
		assert_eq!(tanggal_iso("09/11/2026").as_deref(), Some("2026-11-09"));
		assert_eq!(tanggal_iso("1 Agustus 2026").as_deref(), Some("2026-08-01"));
		assert_eq!(tanggal_iso("1 Agu 2026").as_deref(), Some("2026-08-01"));
		assert_eq!(tanggal_iso("32/01/2026"), None);
	}

	/// Uji massal teks invoice asli (tidak ikut repo): `SILAJUR_INVOICE_TEKS=<folder .txt> cargo test -- --ignored`.
	#[test]
	#[ignore]
	fn laporan_folder_invoice() {
		let dir = std::env::var("SILAJUR_INVOICE_TEKS").expect("SILAJUR_INVOICE_TEKS");
		let mut files: Vec<_> = std::fs::read_dir(dir).unwrap().flatten().map(|e| e.path()).filter(|p| p.extension().is_some_and(|e| e == "txt")).collect();
		files.sort();
		for f in files {
			let raw = std::fs::read_to_string(&f).unwrap();
			let teks = raw.split("SILAJUR-TEKS-PDF\u{0}\n").last().unwrap();
			let inv = parse_invoice(teks);
			println!(
				"{}\t{:?}\t{:?}\t{:?}\t{:?}\t{:?}\t{:?}\t{:?}\t{:?}\t{}\t{}\t{:?}",
				f.file_name().unwrap().to_string_lossy(),
				inv.penyedia, inv.bank, inv.no_rekening, inv.total, inv.ppn, inv.pph22, inv.tanggal, inv.kode_pesanan, inv.barang.len(), inv.keterangan, inv.peringatan
			);
		}
	}

	#[test]
	fn grand_total_dipakai_bila_tidak_ada_kalimat_tagihan() {
		let teks = CONTOH.replace("Tagihan yang perlu dibayarkan oleh Sekolah adalah sebagai berikut:\nRp. 564,500", "");
		assert_eq!(parse_invoice(&teks).total, Some(563_500));
	}

	#[test]
	fn kolom_yang_hilang_dilaporkan() {
		let inv = parse_invoice("Dokumen tanpa isi invoice\nHalaman 1");
		assert!(inv.penyedia.is_none() && inv.no_rekening.is_none() && inv.total.is_none());
		assert_eq!(inv.peringatan.len(), 4);
		assert_eq!(inv.keterangan, "Pembayaran invoice SIPLah");
	}

	#[test]
	fn format_rupiah() {
		assert_eq!(parse_rupiah("Rp. 563,500"), Some(563_500));
		assert_eq!(parse_rupiah("Rp 563.500"), Some(563_500));
		assert_eq!(parse_rupiah("Rp563.500,00"), Some(563_500));
		assert_eq!(parse_rupiah("Total Rp. 1,250,000.50"), Some(1_250_000));
		assert_eq!(parse_rupiah("Rp. 0"), Some(0));
		assert_eq!(parse_rupiah("tanpa nominal"), None);
		assert_eq!(parse_rupiah("Spidol Sharp 12"), None);
		assert_eq!(parse_rupiah("Terpadu Rp. 5.000"), Some(5_000));
	}

	#[test]
	fn rekening_bank_lain_dan_label_rekening() {
		let (bank, no) = cari_rekening(&["Virtual Account (Bank Mandiri): 8900 1234 5678"]);
		assert_eq!((bank.as_deref(), no.as_deref()), (Some("MANDIRI"), Some("890012345678")));
		let (bank, no) = cari_rekening(&["Nama Bank: BRI", "Nomor Rekening: 0123-01-000123-30-1"]);
		assert_eq!((bank.as_deref(), no.as_deref()), (Some("BRI"), Some("012301000123301")));
	}
}
