<template>
	<template v-for="(s, i) in segmen" :key="i">
		<b v-if="s.tebal" class="font-semibold text-highlighted">{{ s.teks }}</b>
		<code v-else-if="s.kode" class="rounded bg-accented px-1 font-mono text-xs">{{ s.teks }}</code>
		<span v-else>{{ s.teks }}</span>
	</template>
</template>

<script lang="ts" setup>
	// Satu baris catatan rilis: teks biasa, **tebal**, dan `kode` (lihat utils/catatanRilis.ts).
	import type { SegmenTeks } from "~/utils/catatanRilis";

	defineProps<{ segmen: SegmenTeks[] }>();
</script>
