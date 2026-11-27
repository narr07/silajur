<template>
	<UCard>
		<template #header>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="font-medium">
					Google Drive sekolah (penomoran surat)
				</p>
				<UBadge v-if="status" :color="status.terhubung ? 'success' : 'neutral'" variant="subtle" :icon="status.terhubung ? 'i-lucide-cloud-check' : 'i-lucide-cloud-off'">
					{{ status.terhubung ? "Terhubung" : "Belum terhubung" }}
				</UBadge>
			</div>
		</template>

		<div class="space-y-3 text-sm">
			<p class="text-muted">
				Nomor surat keluar SiLajur (undangan, berita acara, surat tugas, SPD, SI, SK) diambil dari Agenda Surat yang sama dengan Ceklis SD,
				disimpan di <span class="font-mono">Ceklis SD/Agenda Surat/Agenda Surat {{ npsn || "<NPSN>" }}.json</span> di Google Drive sekolah.
				Dengan begitu kedua aplikasi memakai satu urutan nomor. Hubungkan dengan akun Google yang sama dengan Ceklis SD.
			</p>

			<UAlert
				v-if="status && !status.tersedia"
				color="warning"
				variant="subtle"
				icon="i-lucide-key-round"
				title="Fitur Google Drive tidak aktif di build ini"
				description="Installer perlu dibangun dengan Client ID Google yang sama dengan Ceklis SD."
			/>
			<UAlert v-else-if="!npsn" color="warning" variant="subtle" icon="i-lucide-database" title="NPSN belum terbaca" description="Hubungkan ARKAS agar NPSN sekolah terbaca; nama berkas agenda memakai NPSN." />

			<div v-if="status?.terhubung" class="flex flex-wrap items-center gap-2">
				<span>{{ status.nama || status.email }}</span>
				<span v-if="status.nama && status.email" class="font-mono text-xs text-muted">{{ status.email }}</span>
				<div class="ml-auto flex gap-2">
					<UButton size="sm" color="neutral" variant="outline" icon="i-lucide-folder-open" label="Buka folder Agenda" @click="jalankan(bukaFolder)" />
					<UButton size="sm" color="error" variant="ghost" icon="i-lucide-unplug" label="Putuskan" @click="konfirmasiPutus = true" />
				</div>
			</div>
			<div v-else-if="status?.tersedia" class="flex flex-wrap gap-2">
				<UButton icon="i-lucide-log-in" :loading="masukJalan" label="Hubungkan Google Drive" @click="hubungkan" />
				<UButton v-if="masukJalan" color="neutral" variant="ghost" label="Batal" @click="batalMasuk" />
				<p v-if="masukJalan" class="w-full text-xs text-muted">
					Selesaikan login di browser yang terbuka (maks. 5 menit).
				</p>
			</div>
		</div>

		<UModal v-model:open="konfirmasiPutus" title="Putuskan Google Drive?" description="Token login dihapus dari komputer ini. Berkas di Google Drive tidak dihapus.">
			<template #footer>
				<div class="flex w-full justify-end gap-2">
					<UButton color="neutral" variant="outline" label="Batal" @click="konfirmasiPutus = false" />
					<UButton color="error" icon="i-lucide-unplug" label="Putuskan" @click="putuskan" />
				</div>
			</template>
		</UModal>
	</UCard>
</template>

<script lang="ts" setup>
	const { status, npsn, muatStatus, masuk, batalMasuk, putus, bukaFolder, muatAgenda } = usePenomoranSurat();
	const toast = useToast();
	const masukJalan = ref(false);
	const konfirmasiPutus = ref(false);

	onMounted(() => {
		muatStatus();
	});

	const jalankan = async (kerja: () => Promise<unknown>) => {
		try {
			await kerja();
		} catch (err) {
			toast.add({ title: "Google Drive", description: errorMessage(err), color: "error" });
		}
	};

	const hubungkan = async () => {
		masukJalan.value = true;
		try {
			await masuk();
			await muatAgenda().catch(() => null);
			toast.add({ title: "Google Drive terhubung", description: status.value?.email, color: "success", icon: "i-lucide-cloud-check" });
		} catch (err) {
			toast.add({ title: "Gagal menghubungkan Google Drive", description: errorMessage(err), color: "error" });
		} finally {
			masukJalan.value = false;
		}
	};

	const putuskan = async () => {
		konfirmasiPutus.value = false;
		await jalankan(putus);
	};
</script>
