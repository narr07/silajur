/** Riwayat versi Lajur, dulu SIBOS (terbaru di atas). Tampil di halaman Changelog. */
export interface VersiRilis {
	versi: string
	tanggal: string
	judul: string
	ringkasan: string
	perubahan: { jenis: "baru" | "perbaikan" | "ubah", teks: string }[]
}

export const CHANGELOG: VersiRilis[] = [
	{
		versi: "0.5.0",
		tanggal: "2026-11-28",
		judul: "Ceklis BOSP, Surat BOSP, dan pengingat tanggal 20",
		ringkasan: "Tugas BOSP kepala sekolah dan bendahara, beserta surat-suratnya, kini ada di SiLajur. Ada juga pengingat bulanan untuk membelanjakan anggaran dan membuat SI.",
		perubahan: [
			{ jenis: "baru", teks: "Menu Administrasi BOSP > Ceklis BOSP: tugas kepala sekolah dan bendahara per tahun anggaran, dengan ringkasan aturan (Juknis BOSP, belanja barang/jasa, ARKAS, pajak) dan tautan ke halaman SiLajur terkait" },
			{ jenis: "baru", teks: "Menu Administrasi BOSP > Surat BOSP: paket rapat RKAS, SK Tim BOSP, dokumen persiapan belanja, BA perbandingan penyedia, pengumuman dana, daftar honor PPh 21, dan SPJ honor; isian otomatis dari Pengaturan, bisa dicetak atau disimpan sebagai .docx" },
			{ jenis: "baru", teks: "Pengingat mulai tanggal 20 tiap bulan bila rencana belanja RKAS bulan itu belum terealisasi atau SI bulan itu belum dibuat; muncul sebagai pemberitahuan dan di Dashboard, bisa ditunda atau diatur di Pengaturan" },
			{ jenis: "baru", teks: "Nomor surat mengikuti SE Bupati Majalengka No. 7/2025 (K/N/S/Y) dengan pilihan kode klasifikasi arsip Perbup Majalengka No. 25/2023; tombol Ambil nomor dari Agenda (bersama Ceklis SD lewat Google Drive) tersedia di generator Rapat, SPPD, SI, Surat BOSP, dan BA Rekonsiliasi, dan akan aktif di rilis berikutnya" },
			{ jenis: "ubah", teks: "Nomor bawaan surat BOSP memakai pola SE Penomoran Naskah Dinas; nomor Berita Acara rapat RKAS kini bisa diisi" }
		]
	},
	{
		versi: "0.4.4",
		tanggal: "2026-11-25",
		judul: "Impor invoice PDF ke SI, SPPD manual",
		ringkasan: "Proforma invoice SIPLah bisa langsung diimpor ke Standing Instruction, dan SPPD kini bisa dibuat manual dengan isi surat tugas yang lebih bebas.",
		perubahan: [
			{ jenis: "baru", teks: "Impor Invoice PDF di Generator SI: pilih satu atau beberapa proforma invoice SIPLah (Toko Ladang, Blibli), setiap invoice langsung jadi satu baris berisi penyedia, bank, nomor Virtual Account, total tagihan, dan keterangan barang" },
			{ jenis: "baru", teks: "Rekening sekolah, bank tujuan, dan NIK kepala sekolah serta bendahara diisi sekali di Pengaturan, lalu otomatis terisi di setiap SI baru" },
			{ jenis: "baru", teks: "SPPD manual: buat SPPD tanpa memilih belanja di BKU, tersimpan dan bisa dibuka atau dihapus kapan saja" },
			{ jenis: "baru", teks: "Pelaksana lain di SPPD untuk orang di luar daftar guru, atau salinan guru dengan jabatan/pangkat khusus" },
			{ jenis: "baru", teks: "Dasar surat tugas boleh lebih dari satu baris dan bisa disusun dari surat undangan; poin Untuk bisa ditulis sendiri, misalnya barang yang harus dibawa" },
			{ jenis: "ubah", teks: "Tabel rincian SI lebih ringkas: nama penerima satu baris dan huruf lebih kecil agar banyak baris tetap muat" }
		]
	},
	{
		versi: "0.4.1",
		tanggal: "2026-11-02",
		judul: "Toko SIPLah dari lima marketplace",
		ringkasan: "Katalog toko SIPLah kini bisa diambil dari Gramedia, Intan Pariwara, Temprina, dan Masmedia, selain Toko Ladang.",
		perubahan: [
			{ jenis: "baru", teks: "Tambah toko SIPLah dari Gramedia, Intan Pariwara, Temprina, dan Masmedia cukup dengan menempel link toko; marketplace dikenali otomatis" },
			{ jenis: "baru", teks: "Harga zona ditampilkan sebagai rentang; perbandingan, perkiraan, dan Pakai harga memakai harga tertinggi agar anggaran tidak kurang" },
			{ jenis: "baru", teks: "Tautan Lihat di situs toko membuka halaman produk di marketplace asalnya" },
			{ jenis: "ubah", teks: "Toko yang sangat besar diambil sampai sekitar 3.000 produk, dengan peringatan bila katalog terpotong" },
			{ jenis: "perbaikan", teks: "Nama barang yang panjang di tabel pencocokan Toko SIPLah tidak lagi menumpuk dengan kolom harga" }
		]
	},
	{
		versi: "0.4.0",
		tanggal: "2026-11-02",
		judul: "Lajur: nama baru, banding harga draft RKAS",
		ringkasan: "SIBOS berganti nama menjadi Lajur. Draft RKAS kini bisa dibandingkan dengan harga toko SIPLah, dan aplikasi lebih responsif serta aman saat backup dan restore.",
		perubahan: [
			{ jenis: "ubah", teks: "SIBOS kini bernama Lajur, dengan logo baru. Data, pengaturan, dan koneksi ARKAS tetap sama; tidak perlu mengatur ulang apa pun" },
			{ jenis: "baru", teks: "Bandingkan harga draft RKAS dengan toko SIPLah (Toko Ladang): perkiraan biaya, selisih per item, ganti produk pasangan, dan tombol Pakai harga untuk memperbarui harga satuan draft" },
			{ jenis: "baru", teks: "Sinkronisasi katalog SIPLah menampilkan progres per halaman dan bisa dibatalkan; katalog tidak berubah bila dibatalkan" },
			{ jenis: "ubah", teks: "Halaman Penganggaran RKAS lebih lega: daftar draft pindah ke pemilih di atas sehingga tabel memakai lebar penuh" },
			{ jenis: "ubah", teks: "Tampilan bersudut siku di seluruh aplikasi" },
			{ jenis: "perbaikan", teks: "Aplikasi tidak lagi membeku saat memuat buku kas, export Excel, atau backup; semua proses berat berjalan di latar belakang" },
			{ jenis: "perbaikan", teks: "Salin database ARKAS kini menyertakan transaksi terakhir yang belum tersimpan permanen oleh ARKAS (file -wal)" },
			{ jenis: "perbaikan", teks: "Restore backup aman bila gagal di tengah jalan: data lama dikembalikan otomatis" },
			{ jenis: "perbaikan", teks: "Angka Hemat di SIPLah dan Belanja hanya membandingkan barang yang ditemukan di toko, tidak lagi terlalu besar" },
			{ jenis: "perbaikan", teks: "Total terpilih di Generator SI sama dengan nominal yang dimasukkan ke rincian" },
			{ jenis: "perbaikan", teks: "Pesan gagal SIPLah lebih jelas: toko tidak ditemukan, tidak ada internet, atau server tidak menjawab" },
			{ jenis: "perbaikan", teks: "Muat ulang koneksi ARKAS tidak lagi menghapus salinan sementara yang sedang dipakai" }
		]
	},
	{
		versi: "0.3.0",
		tanggal: "2026-10-29",
		judul: "Katalog Toko SIPLah & Generator Standing Instruction (SI)",
		ringkasan: "Fitur belanja komparasi katalog toko SIPLah otomatis dan Generator Standing Instruction (SI) Bank untuk pemindahbukuan rekening.",
		perubahan: [
			{ jenis: "baru", teks: "Katalog Toko SIPLah: Simpan toko mitra SIPLah (Toko Ladang) hanya dengan link toko, otomatis sinkronisasi katalog dan foto produk" },
			{ jenis: "baru", teks: "Komparasi Belanja SIPLah: Halaman Belanja dengan tampilan kartu komparasi berdampingan (RKAS vs Produk Toko SIPLah) untuk melihat estimasi dan selisih harga" },
			{ jenis: "baru", teks: "Pencocokan Harga Cerdas: Algoritma tokenisasi pencocokan nama produk fleksibel dengan toleransi perbedaan penamaan kata kunci" },
			{ jenis: "baru", teks: "Filter Belanja Realisasi: Menampilkan hanya barang yang belum dibelanjakan berdasarkan realisasi transaksi BKU ARKAS" },
			{ jenis: "baru", teks: "Generator Standing Instruction (SI): Pembuat surat instruksi pemindahbukuan / transfer bank resmi ke Bank Kas Daerah / BJB" },
			{ jenis: "baru", teks: "Pilihan Belanja dari RKAS Bulanan: Ambil rencana belanja bulanan langsung dari kertas kerja ARKAS dengan filter item yang belum dibelanjakan" },
			{ jenis: "baru", teks: "Dukungan Rekanan Non-SIPLah: Input manual rekening penyedia mamin, fotokopi, atau rekanan lokal lainnya beserta potong pajak" },
			{ jenis: "perbaikan", teks: "Pemuatan gambar produk toko SIPLah Toko Ladang menggunakan host Object Storage (OSS) resmi" }
		]
	},
	{
		versi: "0.2.0",
		tanggal: "2026-10-14",
		judul: "Generator dokumen SPJ",
		ringkasan: "Menu Generator baru untuk membuat bukti SPJ konsumsi rapat dan perjalanan dinas langsung dari belanja di BKU ARKAS.",
		perubahan: [
			{ jenis: "baru", teks: "Generator Konsumsi Rapat: Surat Undangan, Daftar Hadir, Berita Acara, dan Notulen dari belanja konsumsi di BKU" },
			{ jenis: "baru", teks: "Judul rapat diambil dari uraian belanja, bisa diganti atau dipilih dari saran; isi notulen menyesuaikan judul" },
			{ jenis: "baru", teks: "Notulis rapat bergilir otomatis dan bisa dipilih dari daftar guru" },
			{ jenis: "baru", teks: "Generator SPPD: Surat Tugas, SPD, Kuitansi, Rincian Biaya & SPPD Rampung, Daftar Pengeluaran Riil, dan Laporan Pelaksanaan Tugas" },
			{ jenis: "baru", teks: "Belanja yang tercatat di rekening lain bisa dicari dan dipilih sendiri di generator" },
			{ jenis: "baru", teks: "Pengaturan: daftar guru dan tenaga kependidikan (NIP, pangkat/golongan, tugas, wali kelas/mata pelajaran)" },
			{ jenis: "ubah", teks: "Dokumen generator memakai huruf maksimal 12pt, termasuk kop surat" }
		]
	},
	{
		versi: "0.1.0",
		tanggal: "2026-10-05",
		judul: "Rilis pertama SIBOS",
		ringkasan: "Pendamping ARKAS untuk menyusun SPJ BOSP: buku kas, laporan, dokumen belanja, dan RKAS dalam satu aplikasi ringan.",
		perubahan: [
			{ jenis: "baru", teks: "Buku Kas Umum, Buku Pembantu Tunai, Bank, dan Pajak langsung dari database ARKAS (hanya baca)" },
			{ jenis: "baru", teks: "Kertas Kerja RKAS format Tahunan, Triwulan, Bulanan, dan Lembar Kertas Kerja, export Excel & PDF" },
			{ jenis: "baru", teks: "Realisasi belanja, Cari Barang & Rekening, dan penyusun draft RKAS (Perubahan/Pergeseran)" },
			{ jenis: "baru", teks: "Cetak Kwitansi A2, Bukti Pengeluaran, Nota Toko, dan dokumen dari template (SP, Kwitansi, BA Serah Terima)" },
			{ jenis: "baru", teks: "Template kanvas dari foto/scan kwitansi kosong, plus export/import template" },
			{ jenis: "baru", teks: "Laporan BA Rekonsiliasi, Rekonsiliasi Bank, SPTJM, K7/K7a, Register Penutupan Kas & Berita Acara" },
			{ jenis: "baru", teks: "Pajak dicatat manual per nota dan otomatis masuk Buku Pembantu Pajak" },
			{ jenis: "baru", teks: "Kop surat, pejabat penandatangan, dan ketua komite otomatis dari ARKAS, tetap bisa diubah" },
			{ jenis: "baru", teks: "Backup & restore data SIBOS, backup otomatis, dan salin arkas.db" },
			{ jenis: "baru", teks: "Tema warna, mode terang/gelap, dan notifikasi pembaruan otomatis" }
		]
	}
];
