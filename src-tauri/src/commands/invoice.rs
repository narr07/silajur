//! Impor proforma invoice SIPLah (PDF) untuk Generator SI.
//!
//! Teks PDF diekstrak di subproses (exe ini sendiri dengan argumen [`ARG_EKSTRAK_PDF`]).
//! Build rilis memakai `panic = "abort"`, jadi PDF rusak yang membuat pustaka PDF panik
//! hanya menutup subproses itu, bukan jendela aplikasi. Subproses juga dibatasi waktu.

use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use crate::error::{AppError, AppResult};
use crate::services::invoice::{parse_invoice, InvoicePdf};

/// Argumen baris perintah yang membuat exe hanya mengekstrak teks PDF lalu keluar.
pub const ARG_EKSTRAK_PDF: &str = "--silajur-ekstrak-teks-pdf";
/// Penanda awal teks di stdout subproses; keluaran lain sebelum penanda diabaikan.
const PENANDA: &str = "\u{0}SILAJUR-TEKS-PDF\u{0}\n";
const MAKS_UKURAN: u64 = 20 * 1024 * 1024;
const BATAS_WAKTU: Duration = Duration::from_secs(30);

/// Dipanggil dari `main` sebelum Tauri dimulai. `Some(kode_keluar)` bila exe dijalankan sebagai
/// subproses ekstraksi PDF.
pub fn jalankan_subproses() -> Option<i32> {
	let mut args = std::env::args_os().skip(1);
	if args.next()? != ARG_EKSTRAK_PDF {
		return None;
	}
	let path = args.next()?;
	let kode = match std::fs::read(&path).map_err(|e| e.to_string()).and_then(|b| pdf_extract::extract_text_from_mem(&b).map_err(|e| e.to_string())) {
		Ok(teks) => {
			let mut out = std::io::stdout().lock();
			let _ = out.write_all(PENANDA.as_bytes()).and_then(|()| out.write_all(teks.as_bytes())).and_then(|()| out.flush());
			0
		}
		Err(e) => {
			let _ = writeln!(std::io::stderr(), "{e}");
			2
		}
	};
	Some(kode)
}

fn validasi(path: &Path) -> AppResult<()> {
	let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
	if ext != "pdf" {
		return Err(AppError::InvalidInput("file harus berformat PDF".into()));
	}
	let meta = std::fs::metadata(path)?;
	if !meta.is_file() {
		return Err(AppError::InvalidInput("path bukan file".into()));
	}
	if meta.len() > MAKS_UKURAN {
		return Err(AppError::InvalidInput("ukuran PDF maksimal 20 MB".into()));
	}
	Ok(())
}

fn ekstrak_teks(path: &Path) -> AppResult<String> {
	let exe = std::env::current_exe()?;
	let mut cmd = Command::new(exe);
	cmd.arg(ARG_EKSTRAK_PDF).arg(path).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
	#[cfg(windows)]
	{
		use std::os::windows::process::CommandExt;
		cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
	}
	let mut child = cmd.spawn()?;

	// stdout/stderr dibaca di thread terpisah agar pipa tidak penuh saat menunggu proses selesai.
	let mut stdout = child.stdout.take().ok_or_else(|| AppError::InvalidInput("subproses PDF tanpa stdout".into()))?;
	let mut stderr = child.stderr.take().ok_or_else(|| AppError::InvalidInput("subproses PDF tanpa stderr".into()))?;
	let baca_out = std::thread::spawn(move || {
		let mut buf = Vec::new();
		let _ = stdout.read_to_end(&mut buf);
		buf
	});
	let baca_err = std::thread::spawn(move || {
		let mut buf = String::new();
		let _ = stderr.read_to_string(&mut buf);
		buf
	});

	let mulai = Instant::now();
	let status = loop {
		if let Some(status) = child.try_wait()? {
			break status;
		}
		if mulai.elapsed() > BATAS_WAKTU {
			let _ = child.kill();
			let _ = child.wait();
			return Err(AppError::InvalidInput("PDF terlalu lama dibaca (lebih dari 30 detik)".into()));
		}
		std::thread::sleep(Duration::from_millis(50));
	};
	let keluaran = baca_out.join().unwrap_or_default();
	let galat = baca_err.join().unwrap_or_default();

	if !status.success() {
		let alasan = galat.lines().find(|l| !l.trim().is_empty()).unwrap_or("PDF rusak atau terenkripsi").trim().to_string();
		return Err(AppError::InvalidInput(format!("PDF tidak bisa dibaca: {alasan}")));
	}
	let keluaran = String::from_utf8_lossy(&keluaran);
	let teks = keluaran.rsplit_once(PENANDA).map(|(_, t)| t).unwrap_or("");
	if teks.trim().is_empty() {
		return Err(AppError::InvalidInput("PDF tidak berisi teks (mungkin hasil scan/foto). Isi baris SI secara manual".into()));
	}
	Ok(teks.to_string())
}

/// Baca satu proforma invoice PDF. File hanya dibaca, tidak diubah atau disalin.
#[tauri::command(async)]
pub fn invoice_pdf_baca(path: String) -> AppResult<InvoicePdf> {
	let path = Path::new(path.trim());
	validasi(path)?;
	let teks = ekstrak_teks(path)?;
	Ok(parse_invoice(&teks))
}
