<template>
	<div class="space-y-1">
		<USelectMenu
			v-model="kode"
			v-model:search-term="cari"
			:items="items"
			value-key="value"
			ignore-filter
			:loading="memuat"
			:search-input="{ placeholder: 'Cari kode atau kata, mis. 400.3.5 atau rapat' }"
			placeholder="Pilih kode klasifikasi"
			:ui="{ content: 'min-w-96', itemDescription: 'whitespace-normal line-clamp-2' }"
			class="w-full font-mono"
		>
			<template #empty>
				<span class="text-xs">{{ cari ? "Tidak ada kode yang cocok." : "Memuat daftar kode…" }}</span>
			</template>
			<template #content-bottom>
				<p v-if="cari && hasil.length >= MAKS" class="px-2 py-1 text-xs text-muted">
					Menampilkan {{ MAKS }} hasil pertama; perjelas pencarian.
				</p>
			</template>
		</USelectMenu>
		<p v-if="uraian" class="line-clamp-2 text-xs text-muted">
			{{ uraian }}
		</p>
	</div>
</template>

<script lang="ts" setup>
	// Pemilih kode klasifikasi arsip (Perbup Majalengka No. 25 Tahun 2023), sama dengan Ceklis SD.
	// Data ±3.000 kode dimuat saat pertama dibutuhkan; hasil pencarian dibatasi agar daftar ringan.
	const kode = defineModel<string>({ required: true });

	type Kode = readonly [kode: string, uraian: string];
	const data = shallowRef<readonly Kode[]>([]);
	const memuat = ref(false);
	const cari = ref("");
	const MAKS = 80;
	const SPASI = /\s+/;

	onMounted(async () => {
		memuat.value = true;
		try {
			data.value = (await import("~/utils/agenda/klasifikasiArsip")).KLASIFIKASI_ARSIP;
		} finally {
			memuat.value = false;
		}
	});

	/** Kode yang sering dipakai SPJ BOSP: tampil saat belum mencari. */
	const SERING = ["000.1.5", "000.1.6", "000.1.2.3", "400.3.5", "400.3.5.5", "900", "900.1"];

	const hasil = computed(() => {
		const q = cari.value.trim().toLowerCase();
		if (!q) return data.value.filter(([k]) => SERING.includes(k) || k === kode.value);
		const kata = q.split(SPASI);
		const cocok: Kode[] = [];
		for (const r of data.value) {
			const teks = `${r[0]} ${r[1]}`.toLowerCase();
			if (r[0].startsWith(q) || kata.every((k) => teks.includes(k))) cocok.push(r);
			if (cocok.length >= MAKS) break;
		}
		return cocok;
	});

	const items = computed(() => hasil.value.map(([k, u]) => ({ value: k, label: k, description: u })));
	const uraian = computed(() => data.value.find(([k]) => k === kode.value)?.[1] ?? "");
</script>
