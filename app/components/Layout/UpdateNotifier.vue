<template>
	<UModal
		v-model:open="open"
		:dismissible="!installing"
		:close="!installing"
		:title="update ? `Lajur ${update.version} tersedia` : 'Pembaruan Lajur'"
		:description="update ? `Versi terpasang ${update.currentVersion}${update.date ? ` · dirilis ${tanggalRilis}` : ''}` : ''"
	>
		<template #body>
			<div class="space-y-3">
				<div v-if="catatan.length" class="max-h-72 space-y-2 overflow-auto rounded-md bg-elevated p-3 text-sm">
					<template v-for="(b, i) in catatan" :key="i">
						<p v-if="b.jenis === 'judul'" class="font-semibold text-highlighted">
							<LayoutTeksCatatan :segmen="b.segmen" />
						</p>
						<p v-else-if="b.jenis === 'bagian'" class="pt-1 text-xs font-semibold uppercase tracking-wide text-primary">
							<LayoutTeksCatatan :segmen="b.segmen" />
						</p>
						<ul v-else-if="b.jenis === 'daftar'" class="list-disc space-y-1 pl-5 text-default">
							<li v-for="(it, j) in b.item" :key="j">
								<LayoutTeksCatatan :segmen="it" />
							</li>
						</ul>
						<p v-else class="text-default">
							<LayoutTeksCatatan :segmen="b.segmen" />
						</p>
					</template>
				</div>
				<p v-else class="text-sm text-muted">
					Versi baru berisi perbaikan dan fitur terbaru.
				</p>
				<template v-if="installing">
					<UProgress :model-value="progress || null" />
					<p class="text-xs text-muted">
						{{ progress < 100 ? `Mengunduh pembaruan... ${progress}%` : "Memasang pembaruan, Lajur akan dibuka kembali." }}
					</p>
				</template>
				<UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" title="Pembaruan gagal" :description="error" />
				<p class="text-xs text-muted">
					Data Lajur dan koneksi ARKAS tetap aman; pembaruan hanya mengganti program.
				</p>
			</div>
		</template>
		<template #footer>
			<div class="flex w-full justify-end gap-2">
				<UButton color="neutral" variant="outline" :disabled="installing" @click="nanti">
					Nanti
				</UButton>
				<UButton icon="i-lucide-download" :loading="installing" @click="pasang">
					Update sekarang
				</UButton>
			</div>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
	/** Cek pembaruan diam-diam saat aplikasi dibuka, hanya bila ada internet. */
	const { update, open, installing, progress, error, cek, pasang, nanti } = useUpdater();

	const tanggalRilis = computed(() => (update.value?.date ? tanggalPanjang(update.value.date.slice(0, 10)) : ""));
	/** Catatan rilis (Markdown) dirender sebagai judul, bagian, dan daftar, bukan teks mentah. */
	const catatan = computed(() => uraiCatatan(update.value?.body ?? ""));

	let tunggu: ReturnType<typeof setTimeout> | undefined;
	const cekSekali = () => {
		window.removeEventListener("online", cekSekali);
		cek(true);
	};

	onMounted(() => {
		if (!inTauri()) return;
		if (navigator.onLine) {
			// Beri waktu aplikasi selesai memuat data dulu.
			tunggu = setTimeout(cek, 5000, true);
		} else {
			// Offline: cek begitu internet tersambung.
			window.addEventListener("online", cekSekali);
		}
	});

	onBeforeUnmount(() => {
		clearTimeout(tunggu);
		window.removeEventListener("online", cekSekali);
	});
</script>
