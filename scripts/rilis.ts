/**
 * Build installer Lajur (.exe NSIS + .msi; nama file masih SIBOS_ mengikuti productName) yang ditandatangani untuk pembaruan otomatis,
 * lalu (opsional) terbitkan ke GitHub Releases beserta latest.json.
 *
 *   bun run rilis              -> build + siapkan latest.json
 *   bun run rilis --terbitkan  -> build + buat GitHub Release (butuh `gh` yang sudah login)
 *
 * Kunci tanda tangan dibaca dari env TAURI_SIGNING_PRIVATE_KEY (GitHub Actions, lihat
 * .github/workflows/rilis.yml), atau dari %USERPROFILE%\.tauri\sibos.key saat build di komputer.
 * Kunci tidak pernah masuk repo. Catatan rilis diambil dari CATATAN_RILIS.md.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { $ } from "bun";

const REPO = "narr07/silajur";
const root = join(import.meta.dir, "..");
const conf = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const versi: string = conf.version;
const tag = `v${versi}`;
const terbitkan = process.argv.includes("--terbitkan");

// Di GitHub Actions, tag yang di-push harus sama dengan versi di tauri.conf.json.
const refTag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;
if (refTag && refTag !== tag) {
	console.error(`Tag ${refTag} tidak sama dengan versi aplikasi ${tag} (tauri.conf.json). Naikkan versi dulu lalu buat tag ulang.`);
	process.exit(1);
}

const kunciFile = join(homedir(), ".tauri", "sibos.key");
const kunci = process.env.TAURI_SIGNING_PRIVATE_KEY?.trim() || (existsSync(kunciFile) ? readFileSync(kunciFile, "utf8") : "");
if (!kunci) {
	console.error(`Kunci tanda tangan tidak ditemukan: isi env TAURI_SIGNING_PRIVATE_KEY atau buat ${kunciFile}`);
	process.exit(1);
}

console.log(`Build SiLajur ${versi} ...`);
await $`bun run tauri build`.cwd(root).env({
	...process.env,
	TAURI_SIGNING_PRIVATE_KEY: kunci,
	TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? ""
});

const bundle = join(root, "src-tauri", "target", "release", "bundle");
const exe = join(bundle, "nsis", `SiLajur_${versi}_x64-setup.exe`);
const msi = join(bundle, "msi", `SiLajur_${versi}_x64_en-US.msi`);
for (const f of [exe, `${exe}.sig`, msi, `${msi}.sig`]) {
	if (!existsSync(f)) {
		console.error(`File hasil build tidak ditemukan: ${f}`);
		process.exit(1);
	}
}

const catatanFile = join(root, "CATATAN_RILIS.md");
const catatan = existsSync(catatanFile) ? readFileSync(catatanFile, "utf8").trim() : `SiLajur ${versi}`;

// Pembaruan otomatis memakai installer NSIS (mode passive, terpasang di Program Files).
const latest = {
	version: versi,
	notes: catatan,
	pub_date: new Date().toISOString(),
	platforms: {
		"windows-x86_64": {
			signature: readFileSync(`${exe}.sig`, "utf8").trim(),
			url: `https://github.com/${REPO}/releases/download/${tag}/SiLajur_${versi}_x64-setup.exe`
		}
	}
};
const latestFile = join(bundle, "latest.json");
writeFileSync(latestFile, `${JSON.stringify(latest, null, 2)}\n`);

console.log("\nHasil build:");
for (const f of [exe, msi, latestFile]) console.log(`  ${f}`);

if (terbitkan) {
	console.log(`\nMenerbitkan ${tag} ke GitHub Releases ...`);
	await $`gh release create ${tag} ${exe} ${`${exe}.sig`} ${msi} ${`${msi}.sig`} ${latestFile} --repo ${REPO} --title ${`SiLajur ${versi}`} --notes ${catatan}`.cwd(root);
	console.log("Selesai. Aplikasi yang sudah terpasang akan menerima notifikasi pembaruan.");
} else {
	console.log("\nBelum diterbitkan. Jalankan `bun run rilis --terbitkan` untuk membuat GitHub Release.");
}
