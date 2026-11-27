//! Google Drive sekolah untuk penomoran surat: login OAuth (loopback + PKCE) dan JSON Agenda Surat
//! yang sama dengan Ceklis SD (`Ceklis SD/Agenda Surat/Agenda Surat <NPSN>.json`).
//!
//! - Izin hanya `drive.file`, dan Client ID harus sama dengan Ceklis SD (lihat build.rs): dengan
//!   begitu kedua aplikasi melihat folder & berkas yang sama, dan tidak ada berkas Drive lain yang terbaca.
//! - Refresh token disimpan di Windows Credential Manager, bukan di file.
//! - Frontend hanya mengirim NPSN dan isi agenda; URL Google dan ID berkas ditetapkan di sini.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use reqwest::{Method, RequestBuilder, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const CLIENT_ID: Option<&str> = option_env!("CEKLIS_GOOGLE_CLIENT_ID");
const CLIENT_SECRET: Option<&str> = option_env!("CEKLIS_GOOGLE_CLIENT_SECRET");

const SCOPE_DRIVE: &str = "https://www.googleapis.com/auth/drive.file";
const URL_AUTH: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const URL_TOKEN: &str = "https://oauth2.googleapis.com/token";
const URL_REVOKE: &str = "https://oauth2.googleapis.com/revoke";
const URL_API: &str = "https://www.googleapis.com/drive/v3";
const URL_UPLOAD: &str = "https://www.googleapis.com/upload/drive/v3/files";
const URL_FOLDER_WEB: &str = "https://drive.google.com/drive/folders/";

const LAYANAN_KREDENSIAL: &str = "SiLajur";
const KUNCI_AKUN: &str = "google-drive-akun";

const MIME_FOLDER: &str = "application/vnd.google-apps.folder";
const MIME_JSON: &str = "application/json";
/// Sama dengan Ceklis SD: folder utama dikenali lewat appProperties `ceklis=utama`.
const FOLDER_UTAMA: &str = "Ceklis SD";
const FOLDER_AGENDA: &str = "Agenda Surat";
const KOLOM_BERKAS: &str = "id,name,version,modifiedTime,webViewLink";

/// Harus sama dengan `FORMAT_AGENDA` di Ceklis SD.
pub const FORMAT_AGENDA: &str = "ceklis-agenda-surat";
const MAKS_AGENDA: usize = 5 * 1024 * 1024;
const BATAS_TUNGGU_LOGIN: Duration = Duration::from_secs(300);

/// Penanda galat konflik: `KONFLIK: <waktu ubah di Drive>`; dibaca frontend.
pub const GALAT_KONFLIK: &str = "KONFLIK: ";

static BATAL_MASUK: AtomicBool = AtomicBool::new(false);
static TOKEN_AKSES: Mutex<Option<(String, Instant)>> = Mutex::new(None);

#[derive(Serialize, Deserialize)]
struct AkunTersimpan {
	refresh_token: String,
	email: String,
	nama: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StatusGoogle {
	/// Build ini punya Client ID Google. Build lokal tanpa Client ID: false.
	pub tersedia: bool,
	pub terhubung: bool,
	pub email: String,
	pub nama: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InfoBerkas {
	pub versi: String,
	pub diubah: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HasilAgenda {
	pub data: Value,
	pub versi: String,
	pub diubah: String,
}

#[derive(Deserialize)]
struct ResponsToken {
	access_token: String,
	expires_in: Option<u64>,
	refresh_token: Option<String>,
	scope: Option<String>,
}

/* ── Validasi ── */

/// NPSN sebagai penanda berkas agenda: angka/huruf saja.
pub fn npsn_aman(npsn: &str) -> Result<String, String> {
	let n = npsn.trim();
	if n.is_empty() || n.len() > 20 || !n.chars().all(|c| c.is_ascii_alphanumeric()) {
		return Err("NPSN sekolah belum ada atau tidak valid; hubungkan ARKAS dulu.".to_string());
	}
	Ok(n.to_string())
}

/// ID berkas Google Drive hanya berisi huruf, angka, `-`, dan `_`.
pub fn id_drive_aman(id: &str) -> Result<&str, String> {
	if id.is_empty() || id.len() > 200 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
		return Err("ID berkas Google Drive tidak valid.".to_string());
	}
	Ok(id)
}

/// Bentuk JSON agenda sebelum diunggah: format, NPSN, dan daftar `masuk`/`keluar` berisi objek ber-`id`.
pub fn periksa_agenda(data: &Value, npsn: &str, ukuran: usize) -> Result<(), String> {
	if ukuran > MAKS_AGENDA {
		return Err("Data agenda surat terlalu besar (maks. 5 MB).".to_string());
	}
	let obj = data.as_object().ok_or_else(|| "Data agenda surat tidak valid.".to_string())?;
	if obj.get("format").and_then(|v| v.as_str()) != Some(FORMAT_AGENDA) {
		return Err("Berkas bukan agenda surat Ceklis SD.".to_string());
	}
	if obj.get("npsn").and_then(|v| v.as_str()).map(str::trim) != Some(npsn) {
		return Err(format!("Agenda surat bukan milik NPSN {npsn}; tidak dikirim."));
	}
	for kunci in ["masuk", "keluar"] {
		let daftar = obj
			.get(kunci)
			.and_then(|v| v.as_array())
			.ok_or_else(|| format!("Daftar surat {kunci} tidak ada."))?;
		if daftar.len() > 20_000 {
			return Err(format!("Daftar surat {kunci} terlalu panjang."));
		}
		if !daftar
			.iter()
			.all(|s| s.get("id").and_then(|v| v.as_str()).is_some_and(|id| !id.is_empty()))
		{
			return Err(format!("Ada surat {kunci} tanpa ID."));
		}
	}
	Ok(())
}

/* ── Kredensial lokal (Windows Credential Manager) ── */

fn entri(kunci: &str) -> Result<keyring::Entry, String> {
	keyring::Entry::new(LAYANAN_KREDENSIAL, kunci).map_err(|e| format!("Credential Manager Windows tidak bisa dibuka: {e}"))
}

fn baca_akun() -> Result<Option<AkunTersimpan>, String> {
	match entri(KUNCI_AKUN)?.get_password() {
		Ok(s) => Ok(serde_json::from_str(&s).ok()),
		Err(keyring::Error::NoEntry) => Ok(None),
		Err(e) => Err(format!("Gagal membaca Credential Manager: {e}")),
	}
}

fn simpan_akun(akun: &AkunTersimpan) -> Result<(), String> {
	let teks = serde_json::to_string(akun).map_err(|e| format!("Gagal menyimpan akun: {e}"))?;
	entri(KUNCI_AKUN)?.set_password(&teks).map_err(|e| format!("Gagal menyimpan ke Credential Manager: {e}"))
}

fn hapus_akun() -> Result<(), String> {
	match entri(KUNCI_AKUN)?.delete_credential() {
		Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
		Err(e) => Err(format!("Gagal menghapus dari Credential Manager: {e}")),
	}
}

fn kosongkan_token_akses() {
	*TOKEN_AKSES.lock().unwrap_or_else(|e| e.into_inner()) = None;
}

fn kredensial_aplikasi() -> Result<(&'static str, &'static str), String> {
	match (CLIENT_ID, CLIENT_SECRET) {
		(Some(id), Some(rahasia)) if !id.is_empty() => Ok((id, rahasia)),
		_ => Err("Fitur Google Drive tidak tersedia di build ini (Client ID Google belum dipasang).".to_string()),
	}
}

pub fn status() -> Result<StatusGoogle, String> {
	let akun = baca_akun()?;
	Ok(StatusGoogle {
		tersedia: kredensial_aplikasi().is_ok(),
		terhubung: akun.is_some(),
		email: akun.as_ref().map(|a| a.email.clone()).unwrap_or_default(),
		nama: akun.as_ref().map(|a| a.nama.clone()).unwrap_or_default(),
	})
}

/* ── Utilitas ── */

fn acak(n: usize) -> Result<Vec<u8>, String> {
	let mut b = vec![0u8; n];
	getrandom::fill(&mut b).map_err(|e| format!("Gagal membuat bilangan acak: {e}"))?;
	Ok(b)
}

/// Base64 URL-safe tanpa padding (RFC 4648 §5), untuk PKCE dan state.
pub fn base64url(bytes: &[u8]) -> String {
	const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
	let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
	for c in bytes.chunks(3) {
		let n = (u32::from(c[0]) << 16) | (u32::from(*c.get(1).unwrap_or(&0)) << 8) | u32::from(*c.get(2).unwrap_or(&0));
		for i in 0..c.len() + 1 {
			out.push(T[((n >> (18 - 6 * i)) & 63) as usize] as char);
		}
	}
	out
}

/// Tantangan PKCE S256 (RFC 7636).
pub fn tantangan_pkce(verifier: &str) -> String {
	base64url(&Sha256::digest(verifier.as_bytes()))
}

/// Kutip nilai untuk query pencarian Drive (`name = '...'`).
fn kutip(s: &str) -> String {
	s.replace('\\', "\\\\").replace('\'', "\\'")
}

fn klien() -> &'static reqwest::Client {
	static KLIEN: OnceLock<reqwest::Client> = OnceLock::new();
	KLIEN.get_or_init(|| {
		reqwest::Client::builder()
			.timeout(Duration::from_secs(120))
			.connect_timeout(Duration::from_secs(20))
			.user_agent(concat!("SiLajur/", env!("CARGO_PKG_VERSION")))
			.build()
			.expect("klien HTTP gagal dibuat")
	})
}

fn galat_jaringan(e: reqwest::Error) -> String {
	if e.is_timeout() || e.is_connect() {
		"Tidak bisa terhubung ke Google. Periksa koneksi internet lalu coba lagi.".to_string()
	} else {
		format!("Gagal berkomunikasi dengan Google: {e}")
	}
}

fn galat_api(status: StatusCode, teks: &str) -> String {
	let v: Value = serde_json::from_str(teks).unwrap_or(Value::Null);
	let pesan = v["error"]["message"]
		.as_str()
		.or_else(|| v["error_description"].as_str())
		.or_else(|| v["error"].as_str())
		.unwrap_or("")
		.to_string();
	let alasan = v["error"]["errors"][0]["reason"].as_str().unwrap_or("");
	match (status.as_u16(), alasan) {
		(401, _) => {
			kosongkan_token_akses();
			"Sesi Google berakhir. Coba lagi; bila tetap gagal, hubungkan ulang Google Drive.".to_string()
		}
		(403, "storageQuotaExceeded") => "Penyimpanan Google Drive penuh. Kosongkan ruang lalu coba lagi.".to_string(),
		(403, "insufficientPermissions" | "insufficientFilePermissions") => {
			"Izin Google Drive tidak cukup. Putuskan lalu hubungkan ulang, dan centang izin Drive di layar Google.".to_string()
		}
		(404, _) => "Berkas di Google Drive tidak ditemukan (mungkin dihapus).".to_string(),
		(429, _) | (403, "rateLimitExceeded" | "userRateLimitExceeded") => {
			"Terlalu banyak permintaan ke Google Drive. Tunggu sebentar lalu coba lagi.".to_string()
		}
		_ => format!("Google Drive menolak permintaan ({status}): {pesan}"),
	}
}

async fn kirim(rb: RequestBuilder) -> Result<Vec<u8>, String> {
	let res = rb.send().await.map_err(galat_jaringan)?;
	let status = res.status();
	let isi = res.bytes().await.map_err(galat_jaringan)?;
	if !status.is_success() {
		return Err(galat_api(status, &String::from_utf8_lossy(&isi)));
	}
	Ok(isi.to_vec())
}

async fn kirim_json(rb: RequestBuilder) -> Result<Value, String> {
	let isi = kirim(rb).await?;
	serde_json::from_slice(&isi).map_err(|e| format!("Respons Google tidak dikenali: {e}"))
}

/* ── Login OAuth ── */

const HALAMAN_SELESAI: &str = r#"<!doctype html><html lang="id"><meta charset="utf-8"><title>SiLajur</title>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;height:90vh;color:#13232b">
<div style="text-align:center;max-width:28rem"><h2 style="color:#0e6e66">JUDUL</h2><p>PESAN</p></div></body></html>"#;

fn balas(stream: &mut TcpStream, status: &str, judul: &str, pesan: &str) {
	let html = HALAMAN_SELESAI.replace("JUDUL", judul).replace("PESAN", pesan);
	let _ = write!(
		stream,
		"HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n{html}",
		html.len()
	);
	let _ = stream.flush();
}

/// Tangani satu koneksi ke server loopback. `None` = bukan balasan OAuth (mis. favicon), tunggu lagi.
fn tangani_koneksi(mut stream: TcpStream, state: &str) -> Option<Result<String, String>> {
	let _ = stream.set_nonblocking(false);
	let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
	let mut buf = Vec::with_capacity(2048);
	let mut potong = [0u8; 1024];
	while buf.len() < 8192 && !buf.windows(4).any(|w| w == b"\r\n\r\n") {
		match stream.read(&mut potong) {
			Ok(0) | Err(_) => break,
			Ok(n) => buf.extend_from_slice(&potong[..n]),
		}
	}
	let teks = String::from_utf8_lossy(&buf);
	let target = teks
		.lines()
		.next()
		.and_then(|baris| baris.strip_prefix("GET "))
		.and_then(|sisa| sisa.split(' ').next())
		.unwrap_or("");
	let Ok(url) = Url::parse(&format!("http://127.0.0.1{target}")) else {
		balas(&mut stream, "400 Bad Request", "Permintaan tidak dikenali", "");
		return None;
	};
	let ambil = |k: &str| url.query_pairs().find(|(a, _)| a == k).map(|(_, v)| v.into_owned());

	if url.path() != "/" || (ambil("code").is_none() && ambil("error").is_none()) {
		balas(&mut stream, "404 Not Found", "Tidak ditemukan", "");
		return None;
	}
	if ambil("state").as_deref() != Some(state) {
		balas(&mut stream, "400 Bad Request", "Login tidak valid", "Silakan ulangi dari aplikasi SiLajur.");
		return Some(Err("Balasan login Google tidak cocok dengan permintaan (state berbeda). Coba lagi.".to_string()));
	}
	if let Some(galat) = ambil("error") {
		balas(&mut stream, "200 OK", "Login dibatalkan", "Anda bisa menutup tab ini dan kembali ke SiLajur.");
		return Some(Err(if galat == "access_denied" {
			"Izin Google Drive tidak diberikan.".to_string()
		} else {
			format!("Login Google gagal: {galat}")
		}));
	}
	balas(&mut stream, "200 OK", "Google Drive terhubung", "Tab ini boleh ditutup. Silakan kembali ke aplikasi SiLajur.");
	ambil("code").map(Ok)
}

fn tunggu_kode(listener: TcpListener, state: String) -> Result<String, String> {
	listener.set_nonblocking(true).map_err(|e| format!("Gagal menyiapkan penerima login: {e}"))?;
	let mulai = Instant::now();
	loop {
		if BATAL_MASUK.load(Ordering::SeqCst) {
			return Err("Login Google dibatalkan.".to_string());
		}
		if mulai.elapsed() > BATAS_TUNGGU_LOGIN {
			return Err("Waktu login Google habis (5 menit). Silakan coba lagi.".to_string());
		}
		match listener.accept() {
			Ok((stream, _)) => {
				if let Some(hasil) = tangani_koneksi(stream, &state) {
					return hasil;
				}
			}
			Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(150)),
			Err(e) => return Err(format!("Penerima login Google gagal: {e}")),
		}
	}
}

pub fn batal_masuk() {
	BATAL_MASUK.store(true, Ordering::SeqCst);
}

/// Buka halaman login Google di browser bawaan, tunggu balasan di 127.0.0.1, tukar kode dengan token.
pub async fn masuk(app: &tauri::AppHandle) -> Result<StatusGoogle, String> {
	use tauri_plugin_opener::OpenerExt;

	let (client_id, client_secret) = kredensial_aplikasi()?;
	BATAL_MASUK.store(false, Ordering::SeqCst);

	let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Gagal membuka port login lokal: {e}"))?;
	let port = listener.local_addr().map_err(|e| format!("Gagal membaca port login lokal: {e}"))?.port();
	let redirect = format!("http://127.0.0.1:{port}");
	let verifier = base64url(&acak(48)?);
	let state = base64url(&acak(24)?);

	let url = Url::parse_with_params(
		URL_AUTH,
		&[
			("client_id", client_id),
			("redirect_uri", redirect.as_str()),
			("response_type", "code"),
			("scope", SCOPE_DRIVE),
			("code_challenge", tantangan_pkce(&verifier).as_str()),
			("code_challenge_method", "S256"),
			("state", state.as_str()),
			("access_type", "offline"),
			("prompt", "consent"),
		],
	)
	.map_err(|e| format!("URL login tidak valid: {e}"))?;
	app.opener()
		.open_url(url.as_str(), None::<&str>)
		.map_err(|e| format!("Gagal membuka browser untuk login Google: {e}"))?;

	let kode = tauri::async_runtime::spawn_blocking(move || tunggu_kode(listener, state))
		.await
		.map_err(|e| format!("Penerima login Google berhenti: {e}"))??;

	let token: ResponsToken = serde_json::from_value(
		kirim_json(klien().post(URL_TOKEN).form(&[
			("code", kode.as_str()),
			("client_id", client_id),
			("client_secret", client_secret),
			("code_verifier", verifier.as_str()),
			("redirect_uri", redirect.as_str()),
			("grant_type", "authorization_code"),
		]))
		.await?,
	)
	.map_err(|e| format!("Token Google tidak dikenali: {e}"))?;

	if !token.scope.as_deref().unwrap_or("").split(' ').any(|s| s == SCOPE_DRIVE) {
		return Err("Izin \"lihat, edit, dan buat file Google Drive yang dipakai aplikasi ini\" belum dicentang. Hubungkan ulang dan centang izin tersebut.".to_string());
	}
	let refresh_token = token
		.refresh_token
		.ok_or_else(|| "Google tidak memberikan token jangka panjang. Hubungkan ulang Google Drive.".to_string())?;
	simpan_token_akses(token.access_token.clone(), token.expires_in);

	let tentang = kirim_json(
		klien()
			.get(format!("{URL_API}/about"))
			.bearer_auth(&token.access_token)
			.query(&[("fields", "user(emailAddress,displayName)")]),
	)
	.await?;
	simpan_akun(&AkunTersimpan {
		refresh_token,
		email: tentang["user"]["emailAddress"].as_str().unwrap_or("").to_string(),
		nama: tentang["user"]["displayName"].as_str().unwrap_or("").to_string(),
	})?;
	status()
}

/// Putuskan Google Drive: cabut token di Google (bila bisa) dan hapus token dari komputer ini.
pub async fn putus() -> Result<StatusGoogle, String> {
	if let Some(akun) = baca_akun()? {
		// Gagal mencabut (mis. offline) tidak menghalangi penghapusan lokal.
		let _ = klien().post(URL_REVOKE).form(&[("token", akun.refresh_token.as_str())]).send().await;
	}
	kosongkan_token_akses();
	hapus_akun()?;
	status()
}

fn simpan_token_akses(token: String, berlaku_detik: Option<u64>) {
	let habis = Instant::now() + Duration::from_secs(berlaku_detik.unwrap_or(3600));
	*TOKEN_AKSES.lock().unwrap_or_else(|e| e.into_inner()) = Some((token, habis));
}

async fn token_akses() -> Result<String, String> {
	let tersimpan = TOKEN_AKSES.lock().unwrap_or_else(|e| e.into_inner()).clone();
	if let Some((token, habis)) = tersimpan {
		if Instant::now() + Duration::from_secs(60) < habis {
			return Ok(token);
		}
	}
	let (client_id, client_secret) = kredensial_aplikasi()?;
	let akun = baca_akun()?.ok_or_else(|| "Google Drive belum terhubung.".to_string())?;
	let res = klien()
		.post(URL_TOKEN)
		.form(&[
			("client_id", client_id),
			("client_secret", client_secret),
			("refresh_token", akun.refresh_token.as_str()),
			("grant_type", "refresh_token"),
		])
		.send()
		.await
		.map_err(galat_jaringan)?;
	let status = res.status();
	let teks = res.text().await.map_err(galat_jaringan)?;
	if !status.is_success() {
		if teks.contains("invalid_grant") {
			// Izin dicabut dari akun Google atau token kedaluwarsa: hapus agar UI meminta sambung ulang.
			let _ = hapus_akun();
			return Err("Izin Google Drive sudah dicabut atau kedaluwarsa. Hubungkan ulang Google Drive.".to_string());
		}
		return Err(galat_api(status, &teks));
	}
	let token: ResponsToken = serde_json::from_str(&teks).map_err(|e| format!("Token Google tidak dikenali: {e}"))?;
	simpan_token_akses(token.access_token.clone(), token.expires_in);
	Ok(token.access_token)
}

async fn api(metode: Method, url: &str) -> Result<RequestBuilder, String> {
	Ok(klien().request(metode, url).bearer_auth(token_akses().await?))
}

/* ── Berkas & folder (sama dengan Ceklis SD) ── */

async fn cari_satu(q: &str) -> Result<Option<Value>, String> {
	let v = kirim_json(api(Method::GET, &format!("{URL_API}/files")).await?.query(&[
		("q", q),
		("spaces", "drive"),
		("fields", &format!("files({KOLOM_BERKAS})")),
		("orderBy", "modifiedTime desc"),
		("pageSize", "10"),
	]))
	.await?;
	Ok(v["files"].as_array().and_then(|a| a.first().cloned()))
}

fn id_dari(v: &Value) -> Result<String, String> {
	let id = v["id"].as_str().ok_or_else(|| "Respons Google Drive tanpa ID berkas.".to_string())?;
	Ok(id_drive_aman(id)?.to_string())
}

async fn buat_folder(nama: &str, induk: Option<&str>, penanda: Option<Value>) -> Result<String, String> {
	let mut meta = json!({ "name": nama, "mimeType": MIME_FOLDER });
	if let Some(p) = induk {
		meta["parents"] = json!([p]);
	}
	if let Some(a) = penanda {
		meta["appProperties"] = a;
	}
	let v = kirim_json(api(Method::POST, &format!("{URL_API}/files")).await?.query(&[("fields", "id")]).json(&meta)).await?;
	id_dari(&v)
}

async fn folder_utama() -> Result<String, String> {
	let q = format!("mimeType = '{MIME_FOLDER}' and appProperties has {{ key='ceklis' and value='utama' }} and trashed = false");
	if let Some(f) = cari_satu(&q).await? {
		return id_dari(&f);
	}
	buat_folder(FOLDER_UTAMA, None, Some(json!({ "ceklis": "utama" }))).await
}

async fn folder_agenda() -> Result<String, String> {
	let utama = folder_utama().await?;
	let q = format!(
		"mimeType = '{MIME_FOLDER}' and name = '{}' and '{}' in parents and trashed = false",
		kutip(FOLDER_AGENDA),
		kutip(&utama)
	);
	if let Some(f) = cari_satu(&q).await? {
		return id_dari(&f);
	}
	buat_folder(FOLDER_AGENDA, Some(&utama), None).await
}

/// Unggah multipart (metadata + isi). `ada` = ID berkas lama yang diperbarui isinya.
async fn unggah(nama: &str, isi: Vec<u8>, induk: &str, penanda: Value, ada: Option<&str>) -> Result<Value, String> {
	let batas = format!("silajur{}", base64url(&acak(18)?).replace(['-', '_'], "x"));
	let meta = match ada {
		Some(_) => json!({ "name": nama, "mimeType": MIME_JSON }),
		None => json!({ "name": nama, "mimeType": MIME_JSON, "parents": [induk], "appProperties": penanda }),
	};
	let mut badan = Vec::with_capacity(isi.len() + 512);
	badan.extend_from_slice(
		format!("--{batas}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{meta}\r\n--{batas}\r\nContent-Type: {MIME_JSON}\r\n\r\n").as_bytes(),
	);
	badan.extend_from_slice(&isi);
	badan.extend_from_slice(format!("\r\n--{batas}--").as_bytes());

	let (metode, url) = match ada {
		Some(id) => (Method::PATCH, format!("{URL_UPLOAD}/{}", id_drive_aman(id)?)),
		None => (Method::POST, URL_UPLOAD.to_string()),
	};
	kirim_json(
		api(metode, &url)
			.await?
			.query(&[("uploadType", "multipart"), ("fields", KOLOM_BERKAS)])
			.header("Content-Type", format!("multipart/related; boundary={batas}"))
			.body(badan),
	)
	.await
}

fn info_dari(v: &Value) -> InfoBerkas {
	InfoBerkas {
		versi: v["version"].as_str().unwrap_or("").to_string(),
		diubah: v["modifiedTime"].as_str().unwrap_or("").to_string(),
	}
}

/* ── Agenda surat (JSON bersama Ceklis SD) ── */

async fn cari_agenda(npsn: &str) -> Result<Option<Value>, String> {
	let q = format!(
		"appProperties has {{ key='ceklis' and value='agenda' }} and appProperties has {{ key='npsn' and value='{}' }} and trashed = false",
		kutip(npsn)
	);
	cari_satu(&q).await
}

/// Ambil JSON agenda surat sekolah dari Drive; `None` bila belum pernah dibuat.
pub async fn ambil_agenda(npsn: &str) -> Result<Option<HasilAgenda>, String> {
	let npsn = npsn_aman(npsn)?;
	let Some(berkas) = cari_agenda(&npsn).await? else {
		return Ok(None);
	};
	let info = info_dari(&berkas);
	let id = id_dari(&berkas)?;
	let isi = kirim(api(Method::GET, &format!("{URL_API}/files/{id}")).await?.query(&[("alt", "media")])).await?;
	let data: Value = serde_json::from_slice(&isi).map_err(|e| format!("Isi agenda surat di Drive bukan JSON yang valid: {e}"))?;
	periksa_agenda(&data, &npsn, isi.len())?;
	Ok(Some(HasilAgenda { data, versi: info.versi, diubah: info.diubah }))
}

/// Simpan JSON agenda ke Drive. Bila berkas di Drive sudah berubah sejak `versi_dasar` dan `paksa` false,
/// kembalikan galat konflik (frontend lalu menggabungkan dan mengirim ulang).
pub async fn kirim_agenda(npsn: &str, data: Value, versi_dasar: &str, paksa: bool) -> Result<InfoBerkas, String> {
	let npsn = npsn_aman(npsn)?;
	let isi = serde_json::to_vec_pretty(&data).map_err(|e| format!("Gagal menyusun JSON agenda: {e}"))?;
	periksa_agenda(&data, &npsn, isi.len())?;

	let lama = cari_agenda(&npsn).await?;
	if let Some(f) = &lama {
		let info = info_dari(f);
		if !paksa && info.versi != versi_dasar {
			return Err(format!("{GALAT_KONFLIK}{}", info.diubah));
		}
	}
	let folder = folder_agenda().await?;
	let lama_id = lama.as_ref().map(id_dari).transpose()?;
	let v = unggah(
		&format!("Agenda Surat {npsn}.json"),
		isi,
		&folder,
		json!({ "ceklis": "agenda", "npsn": npsn }),
		lama_id.as_deref(),
	)
	.await?;
	Ok(info_dari(&v))
}

/// Alamat folder "Agenda Surat" di Google Drive.
pub async fn url_folder_agenda() -> Result<String, String> {
	Ok(format!("{URL_FOLDER_WEB}{}", folder_agenda().await?))
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn pkce_sesuai_rfc7636() {
		assert_eq!(tantangan_pkce("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
	}

	#[test]
	fn base64url_tanpa_padding() {
		assert_eq!(base64url(b"f"), "Zg");
		assert_eq!(base64url(b"foo"), "Zm9v");
		assert_eq!(base64url(&[0xfb, 0xff]), "-_8");
	}

	#[test]
	fn agenda_diperiksa_sebelum_dikirim() {
		let ok = json!({ "format": FORMAT_AGENDA, "npsn": "12345678", "masuk": [], "keluar": [{ "id": "a" }] });
		assert!(periksa_agenda(&ok, "12345678", 10).is_ok());
		assert!(periksa_agenda(&ok, "87654321", 10).is_err());
		assert!(periksa_agenda(&ok, "12345678", MAKS_AGENDA + 1).is_err());
		let tanpa_id = json!({ "format": FORMAT_AGENDA, "npsn": "12345678", "masuk": [], "keluar": [{}] });
		assert!(periksa_agenda(&tanpa_id, "12345678", 10).is_err());
		assert!(npsn_aman("' or 1=1").is_err());
		assert!(id_drive_aman("abc' or '1").is_err());
	}

	#[test]
	fn loopback_menolak_state_palsu() {
		let listener = TcpListener::bind("127.0.0.1:0").unwrap();
		let alamat = listener.local_addr().unwrap();
		let klien = std::thread::spawn(move || {
			let mut s = TcpStream::connect(alamat).unwrap();
			s.write_all(b"GET /?state=lain&code=x HTTP/1.1\r\n\r\n").unwrap();
			let mut b = String::new();
			let _ = s.read_to_string(&mut b);
		});
		let (stream, _) = listener.accept().unwrap();
		assert!(matches!(tangani_koneksi(stream, "abc"), Some(Err(_))));
		klien.join().unwrap();
	}
}
