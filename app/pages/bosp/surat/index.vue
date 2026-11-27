<template>
	<LayoutPageShell title="Surat BOSP">
		<div class="space-y-4 max-w-6xl pb-16">
			<UAlert
				v-if="!loading && kurang.length"
				color="warning"
				variant="subtle"
				icon="i-lucide-triangle-alert"
				title="Data penanda tangan belum lengkap"
				:description="`Masih kosong: ${kurang.join(', ')}. Bagian itu akan tercetak titik-titik.`"
				:actions="[{ label: 'Buka Pengaturan', to: '/lainnya/pengaturan', color: 'warning', variant: 'outline' }]"
			/>

			<UCard>
				<div class="flex flex-wrap items-end gap-3">
					<UFormField label="Singkatan unit kerja (S) di nomor surat" help="Pola SE Bupati Majalengka 7/2025: K/N/S/Y, mis. 000.1.5/12/SDN1/2026. Samakan dengan Profil di Ceklis SD." class="w-80">
						<UInput v-model="kodeSurat" class="w-full font-mono" />
					</UFormField>
					<UButton color="neutral" variant="outline" icon="i-lucide-save" :loading="saving" :disabled="kodeSurat === surat.kodeSurat" @click="simpanKode">
						Simpan
					</UButton>
					<p class="text-xs text-muted ml-auto max-w-sm">
						Kop surat, kepala sekolah, bendahara, komite, kota, dan daftar guru diambil dari Pengaturan. Tahun anggaran mengikuti pilihan tahun di kanan atas.
					</p>
				</div>
			</UCard>

			<div class="flex flex-wrap items-center gap-2">
				<UFieldGroup size="sm">
					<UButton
						v-for="o in peranItems"
						:key="o.value"
						:color="peran === o.value ? 'primary' : 'neutral'"
						:variant="peran === o.value ? 'solid' : 'outline'"
						@click="peran = o.value"
					>
						{{ o.label }}
					</UButton>
				</UFieldGroup>
				<UFieldGroup size="sm">
					<UButton
						v-for="k in kategoriItems"
						:key="k"
						:color="kategori === k ? 'primary' : 'neutral'"
						:variant="kategori === k ? 'solid' : 'outline'"
						@click="kategori = k"
					>
						{{ k }}
					</UButton>
				</UFieldGroup>
			</div>

			<UCard v-if="tampilPaket" class="border-primary/40">
				<div class="flex flex-wrap items-center gap-3">
					<UIcon name="i-lucide-package" class="size-6 text-primary" />
					<div class="min-w-0 flex-1">
						<p class="font-semibold text-highlighted">
							{{ paket[0]!.judul }}
						</p>
						<p class="text-sm text-muted">
							{{ paket[0]!.deskripsi }}
						</p>
					</div>
					<UButton :to="`/bosp/surat/${paket[0]!.id}`" icon="i-lucide-arrow-right">
						Buka paket
					</UButton>
				</div>
			</UCard>

			<div v-if="hasil.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				<UCard v-for="t in hasil" :key="t.id" class="flex flex-col" :ui="{ body: 'flex-1' }">
					<div class="space-y-2">
						<div class="flex items-center gap-1.5">
							<UBadge color="neutral" variant="subtle" size="sm">
								{{ t.kategori }}
							</UBadge>
							<UBadge v-for="p in t.peran" :key="p" color="primary" variant="outline" size="sm">
								{{ peranBospInfo[p].nama }}
							</UBadge>
						</div>
						<p class="font-semibold text-highlighted">
							{{ t.judul }}
						</p>
						<p class="text-sm text-muted">
							{{ t.deskripsi }}
						</p>
					</div>
					<template #footer>
						<UButton :to="`/bosp/surat/${t.id}`" block color="neutral" variant="outline" icon="i-lucide-file-pen">
							Isi & cetak
						</UButton>
					</template>
				</UCard>
			</div>
			<UEmpty v-else icon="i-lucide-file-search" title="Tidak ada surat yang cocok" description="Ubah filter peran atau kategori." />

			<UAlert
				color="neutral"
				variant="subtle"
				icon="i-lucide-info"
				title="Dokumen BOSP lain sudah dibuat otomatis dari data ARKAS"
				description="SPTJM ada di Laporan > Cetak SPTJM, BA Pemeriksaan Kas di Laporan > Register Kas, sedangkan kwitansi dan BA serah terima per nota di Penatausahaan > Cetak Kwitansi A2."
			/>
		</div>
	</LayoutPageShell>
</template>

<script lang="ts" setup>
	import type { PeranBosp, Template } from "~/utils/bosp/templates";
	import { peranBospInfo } from "~/utils/bosp/ceklis";
	import { paket, templates } from "~/utils/bosp/templates";

	const toast = useToast();
	const { surat, kurang, loading, load, simpanSurat } = useSuratBosp();

	const peran = ref<"semua" | PeranBosp>("semua");
	const kategori = ref<"Semua" | Template["kategori"]>("Semua");
	const peranItems: { label: string, value: "semua" | PeranBosp }[] = [
		{ label: "Semua peran", value: "semua" },
		...(Object.keys(peranBospInfo) as PeranBosp[]).map((p) => ({ label: peranBospInfo[p].nama, value: p }))
	];
	const kategoriItems = ["Semua", "RKAS", "SK", "Pengadaan", "Keuangan"] as const;

	const hasil = computed(() => templates.filter((t) =>
		(peran.value === "semua" || t.peran.includes(peran.value))
		&& (kategori.value === "Semua" || t.kategori === kategori.value)
	));
	const tampilPaket = computed(() => (kategori.value === "Semua" || kategori.value === "RKAS") && peran.value !== "bendahara");

	const kodeSurat = ref("");
	const saving = ref(false);
	watch(() => surat.value.kodeSurat, (v) => {
		kodeSurat.value = v;
	}, { immediate: true });

	const simpanKode = async () => {
		saving.value = true;
		try {
			await simpanSurat({ ...surat.value, kodeSurat: kodeSurat.value.trim() || "SD" });
			toast.add({ title: "Kode surat disimpan", color: "success" });
		} catch (err) {
			toast.add({ title: "Gagal menyimpan", description: errorMessage(err), color: "error" });
		} finally {
			saving.value = false;
		}
	};

	onMounted(load);
</script>
