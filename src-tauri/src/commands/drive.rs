//! Google Drive sekolah: login dan JSON Agenda Surat bersama Ceklis SD (lihat gdrive.rs).

use tauri_plugin_opener::OpenerExt;

use crate::error::{AppError, AppResult};
use crate::gdrive::{self, HasilAgenda, InfoBerkas, StatusGoogle};

fn drive<T>(r: Result<T, String>) -> AppResult<T> {
	r.map_err(AppError::Drive)
}

#[tauri::command(async)]
pub fn google_status() -> AppResult<StatusGoogle> {
	drive(gdrive::status())
}

#[tauri::command]
pub async fn google_masuk(app: tauri::AppHandle) -> AppResult<StatusGoogle> {
	drive(gdrive::masuk(&app).await)
}

#[tauri::command]
pub async fn google_batal_masuk() -> AppResult<()> {
	gdrive::batal_masuk();
	Ok(())
}

#[tauri::command]
pub async fn google_putus() -> AppResult<StatusGoogle> {
	drive(gdrive::putus().await)
}

#[tauri::command]
pub async fn agenda_ambil(npsn: String) -> AppResult<Option<HasilAgenda>> {
	drive(gdrive::ambil_agenda(&npsn).await)
}

#[tauri::command]
pub async fn agenda_kirim(npsn: String, data: serde_json::Value, versi_dasar: String, paksa: bool) -> AppResult<InfoBerkas> {
	drive(gdrive::kirim_agenda(&npsn, data, &versi_dasar, paksa).await)
}

/// Buka folder "Agenda Surat" di Google Drive (URL dibangun backend dari ID folder).
#[tauri::command]
pub async fn agenda_buka_folder(app: tauri::AppHandle) -> AppResult<()> {
	let url = drive(gdrive::url_folder_agenda().await)?;
	app.opener()
		.open_url(url, None::<&str>)
		.map_err(|e| AppError::Drive(format!("Gagal membuka Google Drive di browser: {e}")))
}
