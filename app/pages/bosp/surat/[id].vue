<template>
	<LayoutPageShell :title="dok.judul">
		<template #actions>
			<UButton to="/bosp/surat" color="neutral" variant="ghost" icon="i-lucide-arrow-left">
				Daftar surat
			</UButton>
			<UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="resetOpen = true">
				Nilai bawaan
			</UButton>
			<UButton color="neutral" variant="outline" icon="i-lucide-file-down" :loading="busy" :disabled="!siap" @click="unduhDocx">
				Simpan .docx
			</UButton>
			<UButton icon="i-lucide-printer" :disabled="!siap" @click="cetak">
				Pratinjau & Cetak
			</UButton>
		</template>

		<div class="grid gap-4 pb-16 xl:grid-cols-[26rem_minmax(0,1fr)]">
			<div class="space-y-4">
				<p class="text-sm text-muted">
					{{ dok.deskripsi }}
				</p>

				<UAlert
					v-if="!loading && kurang.length"
					color="warning"
					variant="subtle"
					icon="i-lucide-triangle-alert"
					title="Data belum lengkap"
					:description="`Masih kosong: ${kurang.join(', ')}. Bagian itu akan tercetak titik-titik.`"
					:actions="[{ label: 'Buka Pengaturan', to: '/lainnya/pengaturan', color: 'warning', variant: 'outline' }]"
				/>

				<USkeleton v-if="!siap" class="h-96 w-full" />
				<UCard v-else>
					<div class="space-y-3">
						<UFormField v-for="f in dok.fields" :key="f.key" :label="f.label" :help="f.hint">
							<UTextarea v-if="f.type === 'textarea'" v-model="nilai[f.key]" :rows="4" autoresize class="w-full" />
							<UInput v-else v-model="nilai[f.key]" :type="f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'" class="w-full" />
							<PenomoranAmbilNomor
								v-if="nomorSurat[f.key]"
								v-model:nomor="nilai[f.key]!"
								:sumber="nomorSurat[f.key]!.sumber"
								:perihal="nomorSurat[f.key]!.perihal"
								:tgl-surat="nomorSurat[f.key]!.tgl"
								:jenis-naskah="nomorSurat[f.key]!.jenis"
								class="mt-1.5"
							/>
						</UFormField>
						<p class="text-xs text-muted">
							Kolom bertanda "|" diisi satu baris per data, misalnya <code>Nama|Jumlah</code>. Isian tersimpan otomatis untuk TA {{ ta }}.
						</p>
					</div>
				</UCard>
			</div>

			<div class="min-w-0 overflow-x-auto bg-elevated p-4">
				<div class="mx-auto flex w-max flex-col items-center gap-6">
					<BospNaskah v-if="siap" :blocks="blocks" :profil="profil" />
				</div>
			</div>
		</div>

		<UModal v-model:open="resetOpen" title="Kembalikan nilai bawaan?">
			<template #body>
				<p class="text-sm">
					Semua isian <span class="font-semibold">{{ dok.judul }}</span> untuk TA {{ ta }} dikembalikan ke nilai bawaan dari Pengaturan.
				</p>
			</template>
			<template #footer>
				<div class="flex w-full justify-end gap-2">
					<UButton color="neutral" variant="outline" @click="resetOpen = false">
						Batal
					</UButton>
					<UButton color="error" icon="i-lucide-rotate-ccw" @click="kembalikan">
						Kembalikan
					</UButton>
				</div>
			</template>
		</UModal>
	</LayoutPageShell>
</template>

<script lang="ts" setup>
	import type { JenisNaskah } from "~/utils/agenda/agendaSurat";
	import type { Values } from "~/utils/bosp/templates";
	import BospNaskah from "~/components/Bosp/Naskah.vue";
	import { buildDocx } from "~/utils/bosp/docx";
	import { settingIsianSurat } from "~/utils/bosp/profil";
	import { cariDokumen, nilaiAwal } from "~/utils/bosp/templates";

	const route = useRoute();
	const id = route.params.id as string;
	const found = cariDokumen(id);
	if (!found) throw createError({ statusCode: 404, statusMessage: "Template surat tidak ditemukan" });
	const dok = found;

	const toast = useToast();
	const { open: openPrint } = usePrint();
	const { busy, save } = useSaveFile();
	const { ta, profil, kurang, loading, load } = useSuratBosp();

	const nilai = ref<Values>({});
	const siap = ref(false);
	const resetOpen = ref(false);

	const blocks = computed(() => dok.build(profil.value, nilai.value));

	/**
	 * Kolom nomor yang bisa diambil dari Agenda Surat. Dokumen RKAS (satuan maupun paket) berbagi
	 * nomor per tahun anggaran, jadi mengambil dari paket atau dokumen satuan memakai entri yang sama.
	 */
	const nomorSurat = computed<Record<string, { sumber: string, perihal: string, tgl: string, jenis: JenisNaskah }>>(() => {
		const v = nilai.value;
		return {
			nomorUndangan: { sumber: `bosp:rkas:${ta.value}:undangan`, perihal: `Undangan Rapat Penyusunan RKAS TA ${v.ta ?? ta.value}`, tgl: v.tglSurat ?? "", jenis: "surat" },
			nomorBa: { sumber: `bosp:rkas:${ta.value}:ba`, perihal: `Berita Acara Penyusunan RKAS TA ${v.ta ?? ta.value}`, tgl: v.tglRapat ?? "", jenis: "berita-acara" },
			...(id === "sk-tim-bosp" ? { nomor: { sumber: `bosp:sk-tim-bosp:${ta.value}`, perihal: `SK Tim Pengelola Dana BOSP TA ${v.ta ?? ta.value}`, tgl: v.tgl ?? "", jenis: "keputusan" as const } } : {})
		};
	});

	const muat = async () => {
		siap.value = false;
		await load();
		const tersimpan = await api.settingsGet<Values>(settingIsianSurat(ta.value, id)).catch(() => null);
		nilai.value = { ...nilaiAwal(dok.fields, profil.value, ta.value), ...tersimpan };
		siap.value = true;
	};

	const simpanIsian = useDebounceFn(async () => {
		try {
			await api.settingsSet(settingIsianSurat(ta.value, id), toRaw(nilai.value));
		} catch (err) {
			toast.add({ title: "Isian gagal disimpan", description: errorMessage(err), color: "error" });
		}
	}, 600);

	watch(nilai, () => {
		if (siap.value) simpanIsian();
	}, { deep: true });

	const kembalikan = () => {
		nilai.value = nilaiAwal(dok.fields, profil.value, ta.value);
		resetOpen.value = false;
		toast.add({ title: "Isian dikembalikan ke nilai bawaan", color: "neutral" });
	};

	const cetak = () => {
		openPrint({
			title: dok.judul,
			component: BospNaskah,
			props: { blocks: structuredClone(toRaw(blocks.value)), profil: structuredClone(toRaw(profil.value)) }
		});
	};

	const unduhDocx = () => save({
		defaultName: `${dok.judul} TA ${ta.value}.docx`,
		filters: [{ name: "Dokumen Word", extensions: ["docx"] }],
		success: "Dokumen Word tersimpan",
		run: async (path) => {
			const blob = await buildDocx(blocks.value, profil.value);
			return api.simpanDocx(path, new Uint8Array(await blob.arrayBuffer()));
		}
	});

	watch(ta, muat, { immediate: true });
</script>
