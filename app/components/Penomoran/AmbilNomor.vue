<template>
	<div class="space-y-1">
		<UButton
			size="xs"
			color="primary"
			variant="soft"
			icon="i-lucide-mail-plus"
			:label="entri ? `Agenda No. ${entri.noAgenda} · perbarui` : 'Ambil nomor dari Agenda'"
			@click="buka"
		/>

		<UModal v-model:open="open" :title="entri ? 'Perbarui nomor di Agenda Surat' : 'Ambil nomor dari Agenda Surat'" description="Nomor disusun sesuai SE Bupati Majalengka No. 7/2025 dan dicatat di Agenda Surat Keluar (Google Drive sekolah, sama dengan Ceklis SD).">
			<template #body>
				<UAlert
					v-if="!siap"
					color="warning"
					variant="subtle"
					icon="i-lucide-cloud-off"
					:title="status?.terhubung ? 'NPSN belum terbaca' : 'Google Drive sekolah belum terhubung'"
					:description="status?.terhubung ? 'Hubungkan ARKAS dulu agar NPSN sekolah terbaca.' : 'Hubungkan di Pengaturan > Google Drive sekolah. Nomor tetap bisa diketik manual.'"
					:actions="status?.terhubung ? [] : [{ label: 'Buka Pengaturan', to: '/lainnya/pengaturan', color: 'warning', variant: 'outline' }]"
				/>
				<div v-else class="space-y-3">
					<UFormField label="Jenis naskah">
						<USelect v-model="jenis" :items="jenisItems" class="w-full" />
					</UFormField>
					<UFormField label="Kode klasifikasi arsip (K)" help="Perbup Majalengka No. 25/2023.">
						<PenomoranPilihKlasifikasi v-model="kode" />
					</UFormField>
					<UCheckbox v-model="manual" label="Dinomori manual di luar SRIKANDI (/M)" />
					<p class="text-xs text-muted">
						Perihal: <span class="text-default">{{ perihal || "-" }}</span> · tanggal {{ tglSurat || "hari ini" }} · singkatan unit kerja (S): <span class="font-mono">{{ singkatan }}</span>
					</p>
				</div>
			</template>
			<template #footer>
				<div class="flex w-full justify-end gap-2">
					<UButton color="neutral" variant="outline" label="Batal" @click="open = false" />
					<UButton icon="i-lucide-check" :label="entri ? 'Perbarui' : 'Ambil nomor'" :loading="sibuk" :disabled="!siap" @click="ambil" />
				</div>
			</template>
		</UModal>
	</div>
</template>

<script lang="ts" setup>
	import type { JenisNaskah } from "~/utils/agenda/agendaSurat";
	import { bawaanKeluar, entriSumber, JENIS_NASKAH } from "~/utils/agenda/agendaSurat";

	// Ambil nomor surat keluar dari Agenda Surat (JSON bersama Ceklis SD) untuk dokumen SiLajur.
	// Dokumen yang sama dikenali lewat `sumber`, jadi mengambil ulang memperbarui entri yang sama.
	const props = withDefaults(defineProps<{
		sumber: string
		perihal: string
		tglSurat: string
		tujuan?: string
		jenisNaskah?: JenisNaskah
	}>(), { tujuan: "Arsip sekolah", jenisNaskah: "surat" });

	const nomor = defineModel<string>("nomor", { required: true });

	const { status, keluar, singkatan, siap, muatStatus, muatAgenda, pastikanTermuat, ambilNomor } = usePenomoranSurat();
	const toast = useToast();
	onMounted(() => {
		pastikanTermuat().catch(() => {});
	});

	const sumberLengkap = computed(() => `silajur:${props.sumber}`);
	const entri = computed(() => entriSumber(keluar.value, sumberLengkap.value));
	const open = ref(false);
	const sibuk = ref(false);
	const kode = ref("");
	const manual = ref(false);
	const jenis = ref<JenisNaskah>(props.jenisNaskah);
	const jenisItems = Object.entries(JENIS_NASKAH).map(([value, j]) => ({ value: value as JenisNaskah, label: j.label }));

	const buka = async () => {
		open.value = true;
		await muatStatus();
		await muatAgenda().catch(() => null);
		const bawaan = bawaanKeluar(keluar.value);
		kode.value = entri.value?.kodeKlasifikasi ?? bawaan.kodeKlasifikasi;
		manual.value = entri.value?.manual ?? bawaan.manual;
		jenis.value = entri.value?.jenisNaskah ?? props.jenisNaskah;
	};

	const ambil = async () => {
		sibuk.value = true;
		try {
			const ada = !!entri.value;
			const s = await ambilNomor({
				sumber: sumberLengkap.value,
				jenisNaskah: jenis.value,
				kodeKlasifikasi: kode.value,
				tglSurat: props.tglSurat || new Date().toISOString().slice(0, 10),
				perihal: props.perihal,
				tujuan: props.tujuan,
				manual: manual.value
			});
			nomor.value = s.noSurat;
			open.value = false;
			toast.add({ title: ada ? "Nomor di Agenda diperbarui" : "Nomor dicatat di Agenda Surat Keluar", description: s.noSurat, color: "success", icon: "i-lucide-mail-check" });
		} catch (err) {
			toast.add({ title: "Gagal mengambil nomor", description: errorMessage(err), color: "error" });
		} finally {
			sibuk.value = false;
		}
	};
</script>
