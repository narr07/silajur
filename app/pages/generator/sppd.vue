<template>
	<LayoutPageShell title="Generator SPPD">
		<template #actions>
			<UButton color="neutral" variant="outline" icon="i-lucide-save" :loading="saving" :disabled="!form" @click="save()">
				Simpan
			</UButton>
			<UButton icon="i-lucide-printer" :disabled="!form || !jenis.length || !jumlahPelaksana" @click="print">
				Pratinjau & cetak
			</UButton>
		</template>

		<div v-if="!connected" class="py-16 text-center text-muted">
			Hubungkan ARKAS terlebih dahulu.
		</div>

		<div v-else class="grid lg:grid-cols-[22rem_1fr] gap-4">
			<div class="space-y-4">
				<UCard :ui="{ body: 'space-y-2' }">
					<div class="flex items-center justify-between gap-2">
						<p class="text-sm font-medium">
							SPPD manual
						</p>
						<UButton size="xs" icon="i-lucide-file-plus" @click="buatManual">
							Buat SPPD manual
						</UButton>
					</div>
					<p class="text-xs text-muted">
						Tanpa memilih belanja di BKU, tinggal diisi.
					</p>
					<div v-if="daftarManual.length" class="space-y-1">
						<UButton
							v-for="m in daftarManual"
							:key="m.key"
							block
							:color="m.key === selectedKey ? 'primary' : 'neutral'"
							:variant="m.key === selectedKey ? 'soft' : 'outline'"
							class="justify-start text-left"
							@click="bukaManual(m.key)"
						>
							<div class="min-w-0 w-full">
								<p class="text-sm font-medium line-clamp-2">
									{{ m.data.maksud || "SPPD tanpa maksud" }}
								</p>
								<p class="text-xs text-muted">
									{{ tanggalId(m.data.tanggalBerangkat) }} · {{ pelaksanaSppd(m.data, guru).length }} orang
								</p>
							</div>
						</UButton>
					</div>
				</UCard>

				<GeneratorDaftarBelanja
					v-model:month="month"
					v-model:search="search"
					v-model:hanya="hanyaCocok"
					:groups="filtered"
					:selected-key="selectedKey"
					:tersimpan="saved"
					:loading="loading"
					:error="error"
					label-saring="Hanya belanja transport / perjalanan dinas"
					@pick="pick"
				/>
			</div>

			<div v-if="form && (selected || manual)" class="space-y-4 max-w-4xl pb-12">
				<GeneratorInfoBelanja v-if="selected" :g="selected" :nama-kegiatan="namaKegiatanArkas" />

				<UCard>
					<template #header>
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<p class="font-medium">
									Perjalanan dinas
								</p>
								<UBadge v-if="manual" color="neutral" variant="subtle" size="sm">
									{{ tersimpanSekarang ? "SPPD manual" : "SPPD manual · belum disimpan" }}
								</UBadge>
							</div>
							<UButton
								v-if="manual"
								size="xs"
								color="error"
								variant="ghost"
								icon="i-lucide-trash-2"
								:disabled="!tersimpanSekarang"
								@click="konfirmasiHapus = true"
							>
								Hapus SPPD ini
							</UButton>
							<UButton v-else size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" @click="reset">
								Isi ulang dari ARKAS
							</UButton>
						</div>
					</template>
					<div class="grid sm:grid-cols-2 gap-3">
						<UFormField label="Maksud perjalanan dinas" class="sm:col-span-2" help="Tulis sebagai kalimat tugas, mis. &quot;Mengikuti Rapat K3S&quot; atau &quot;Melaksanakan tugas sebagai Pengawas TKA&quot;.">
							<UTextarea v-model="form.maksud" :rows="1" autoresize class="w-full" />
						</UFormField>
						<UFormField label="Tempat tujuan">
							<UInput v-model="form.tujuan" placeholder="mis. SD Negeri Rajagaluh I" class="w-full" />
						</UFormField>
						<UFormField label="Tempat berangkat">
							<UInput v-model="form.berangkatDari" class="w-full" />
						</UFormField>
						<UFormField label="Tanggal berangkat" :hint="hariDari(form.tanggalBerangkat)">
							<UInput v-model="form.tanggalBerangkat" type="date" class="w-full" />
						</UFormField>
						<UFormField label="Tanggal kembali" :hint="`Lama: ${lamaTeks(form)}`">
							<UInput v-model="form.tanggalKembali" type="date" class="w-full" />
						</UFormField>
						<UFormField label="Jam berangkat">
							<UInput v-model="form.jamBerangkat" type="time" />
						</UFormField>
						<UFormField label="Alat angkutan">
							<UInput v-model="form.angkutan" placeholder="Kendaraan umum / kendaraan pribadi" class="w-full" />
						</UFormField>
						<UFormField label="Jenis perjalanan">
							<USelect v-model="form.daerah" :items="DAERAH" class="w-full" />
						</UFormField>
					</div>
				</UCard>

				<UCard>
					<template #header>
						<div class="flex items-center justify-between gap-2">
							<p class="font-medium">
								Pelaksana · {{ jumlahPelaksana }} orang
							</p>
							<UButton v-if="guru.length" size="xs" color="neutral" variant="ghost" @click="toggleSemua">
								{{ pelaksanaIds.size === guru.length ? "Kosongkan" : "Pilih semua" }}
							</UButton>
						</div>
					</template>
					<p v-if="!guru.length" class="text-sm">
						Daftar guru masih kosong.
						<NuxtLink to="/lainnya/pengaturan" class="text-primary underline">
							Isi di menu Pengaturan
						</NuxtLink>
						(nama, NIP, pangkat/golongan, tugas).
					</p>
					<div v-else class="grid sm:grid-cols-2 gap-x-4 gap-y-2">
						<UCheckbox
							v-for="g in guru"
							:key="g.id"
							:model-value="pelaksanaIds.has(g.id)"
							:label="g.nama"
							:description="[jabatanSppd(g), g.pangkat].filter(Boolean).join(' · ')"
							@update:model-value="(v) => setPelaksana(g.id, !!v)"
						/>
					</div>

					<div class="mt-4 pt-3 border-t border-default space-y-2">
						<div class="flex items-center justify-between gap-2">
							<p class="text-sm font-medium">
								Pelaksana lain
								<span class="text-xs font-normal text-muted">(tidak ada di daftar guru)</span>
							</p>
							<div class="flex items-center gap-2">
								<USelectMenu
									v-if="guru.length"
									:model-value="undefined"
									:items="pilihanGuru"
									placeholder="Tambah dari daftar guru"
									icon="i-lucide-users"
									size="xs"
									class="w-56"
									:search-input="{ placeholder: 'Cari nama guru...' }"
									@update:model-value="(v) => v && tambahDariGuru(v.value)"
								/>
								<UButton size="xs" color="neutral" variant="outline" icon="i-lucide-user-plus" @click="tambahPelaksanaLain">
									Tambah kosong
								</UButton>
							</div>
						</div>
						<div
							v-for="(p, i) in form.pelaksanaLain ?? []"
							:key="p.id"
							class="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 items-end"
						>
							<UFormField label="Nama">
								<UInput v-model="p.nama" placeholder="Nama lengkap & gelar" class="w-full" />
							</UFormField>
							<UFormField label="NIP / NUPTK">
								<UInput v-model="p.nip" placeholder="Boleh kosong" class="w-full font-mono" />
							</UFormField>
							<UFormField label="Pangkat/Gol">
								<UInput v-model="p.pangkat" placeholder="Boleh kosong" class="w-full" />
							</UFormField>
							<UFormField label="Jabatan">
								<UInput v-model="p.tugas" placeholder="Guru" class="w-full" />
							</UFormField>
							<UButton
								icon="i-lucide-x"
								color="error"
								variant="ghost"
								aria-label="Hapus pelaksana"
								@click="hapusPelaksanaLain(i)"
							/>
						</div>
					</div>

					<p class="mt-3 text-xs text-muted">
						Surat Tugas memuat semua pelaksana; dokumen lainnya dicetak satu berkas per orang.
					</p>
				</UCard>

				<UCard>
					<template #header>
						<p class="font-medium">
							Biaya per orang · {{ rupiah(perOrang) }}
						</p>
					</template>
					<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
						<UFormField v-for="b in BIAYA_SPPD" :key="b.key" :label="b.label">
							<UInputNumber v-model="form.biaya[b.key]" :min="0" :step="1000" :format-options="{ maximumFractionDigits: 0 }" class="w-full" />
						</UFormField>
					</div>
					<p v-if="selected" class="mt-3 text-xs" :class="totalSemua === selected.total ? 'text-muted' : 'text-warning'">
						{{ jumlahPelaksana }} orang × {{ rupiah(perOrang) }} = {{ rupiah(totalSemua) }} · belanja di BKU: {{ rupiah(selected.total) }}
					</p>
					<p v-else class="mt-3 text-xs text-muted">
						{{ jumlahPelaksana }} orang × {{ rupiah(perOrang) }} = {{ rupiah(totalSemua) }}
					</p>
				</UCard>

				<UCard>
					<template #header>
						<p class="font-medium">
							Surat tugas, SPD & kuitansi
						</p>
					</template>
					<div class="grid sm:grid-cols-2 gap-3">
						<UFormField label="Nomor surat tugas">
							<UInput v-model="form.nomorSuratTugas" :placeholder="`800/012/SD/${year}`" class="w-full" />
						</UFormField>
						<UFormField label="Tanggal surat tugas / SPD" :hint="hariDari(form.tanggalSurat)">
							<UInput v-model="form.tanggalSurat" type="date" class="w-full" />
						</UFormField>
						<UFormField
							label="Dasar surat tugas"
							class="sm:col-span-2"
							help="Satu dasar per baris; lebih dari satu baris dicetak bernomor. Kosong = titik-titik."
						>
							<template #hint>
								<UButton size="xs" color="neutral" variant="link" icon="i-lucide-mail-plus" class="p-0" @click="bukaSusunDasar">
									Susun dari surat undangan
								</UButton>
							</template>
							<UTextarea
								v-model="form.dasar"
								:rows="2"
								autoresize
								placeholder="mis. Surat Kepala Dinas Pendidikan Kabupaten Majalengka Nomor 800.1.10.3/122/SEKRET/2026 tanggal 19 November 2026 perihal Undangan Bimtek"
								class="w-full"
							/>
						</UFormField>
						<UFormField
							label="Untuk (isi surat tugas)"
							class="sm:col-span-2"
							help="Satu poin per baris, mis. tambahkan barang yang harus dibawa. Kosong = poin bawaan seperti contoh di dalam kotak."
						>
							<template #hint>
								<UButton size="xs" color="neutral" variant="link" icon="i-lucide-wand-sparkles" class="p-0" @click="isiUntukBawaan">
									Isi dengan poin bawaan
								</UButton>
							</template>
							<UTextarea
								v-model="form.untuk"
								:rows="3"
								autoresize
								:placeholder="untukBawaan(form).join('\n')"
								class="w-full"
							/>
						</UFormField>
						<UFormField label="Nomor SPD">
							<UInput v-model="form.nomorSpd" :placeholder="`090/012/SPD/${year}`" class="w-full" />
						</UFormField>
						<UFormField label="Tingkat biaya perjalanan dinas" hint="Boleh kosong">
							<UInput v-model="form.tingkatBiaya" class="w-full" />
						</UFormField>
						<UFormField label="Instansi (pembebanan anggaran)">
							<UInput v-model="form.instansi" class="w-full" />
						</UFormField>
						<UFormField label="Kode rekening / akun">
							<UInput v-model="form.kodeRekening" class="w-full" />
						</UFormField>
						<UFormField label="Nomor kuitansi">
							<UInput v-model="form.nomorKuitansi" class="w-full" />
						</UFormField>
						<UFormField label="Tanggal kuitansi (dibayar)" :hint="hariDari(form.tanggalBayar)">
							<UInput v-model="form.tanggalBayar" type="date" class="w-full" />
						</UFormField>
						<UFormField label="Sumber dana" class="sm:col-span-2">
							<UInput v-model="form.sumberDana" placeholder="BOSP Reguler" class="w-full" />
						</UFormField>
					</div>
				</UCard>

				<UCard>
					<template #header>
						<p class="font-medium">
							Laporan pelaksanaan tugas
						</p>
					</template>
					<UFormField label="Rangkaian acara" hint="Satu acara per baris">
						<UTextarea v-model="form.acara" :rows="4" autoresize class="w-full" />
					</UFormField>
				</UCard>

				<UCard>
					<template #header>
						<p class="font-medium">
							Dokumen yang dicetak
						</p>
					</template>
					<div class="flex flex-wrap gap-x-6 gap-y-2">
						<UCheckbox
							v-for="d in DOKUMEN_SPPD"
							:key="d.value"
							:model-value="jenis.includes(d.value)"
							:label="d.label"
							@update:model-value="(v) => toggleJenis(d.value, !!v)"
						/>
					</div>
				</UCard>
			</div>
			<div v-else class="py-16 text-center text-muted">
				Pilih belanja transport di sebelah kiri untuk membuat SPPD-nya. Bila belanjanya tercatat di rekening lain
				(mis. konsumsi), matikan saringan lalu cari. Bisa juga klik <strong>Buat SPPD manual</strong> untuk mengisi tanpa belanja BKU.
			</div>
		</div>

		<UModal v-model:open="susunDasar" title="Susun dasar dari surat undangan" description="Salin dari kop dan bagian atas surat undangan. Hasilnya ditambahkan sebagai satu baris dasar.">
			<template #body>
				<div class="grid sm:grid-cols-2 gap-3">
					<UFormField label="Surat dari (jabatan pengirim)" class="sm:col-span-2">
						<UInput v-model="surat.asal" placeholder="Kepala Dinas Pendidikan Kabupaten Majalengka" class="w-full" />
					</UFormField>
					<UFormField label="Nomor surat">
						<UInput v-model="surat.nomor" placeholder="800.1.10.3/122/SEKRET/2026" class="w-full" />
					</UFormField>
					<UFormField label="Tanggal surat">
						<UInput v-model="surat.tanggal" type="date" class="w-full" />
					</UFormField>
					<UFormField label="Perihal / Hal" class="sm:col-span-2">
						<UInput v-model="surat.perihal" placeholder="Undangan Bimtek" class="w-full" />
					</UFormField>
				</div>
				<p class="mt-3 text-xs text-muted">
					Hasil: {{ dasarDariSurat(surat) }}
				</p>
			</template>
			<template #footer>
				<div class="flex justify-end gap-2 w-full">
					<UButton color="neutral" variant="ghost" @click="susunDasar = false">
						Batal
					</UButton>
					<UButton icon="i-lucide-plus" :disabled="!surat.nomor.trim()" @click="tambahDasar">
						Tambahkan ke dasar
					</UButton>
				</div>
			</template>
		</UModal>

		<UModal v-model:open="konfirmasiHapus" title="Hapus SPPD manual?">
			<template #body>
				<p class="text-sm">
					SPPD <strong>{{ form?.maksud || "tanpa maksud" }}</strong> akan dihapus dari Lajur. Dokumen yang sudah dicetak tidak terpengaruh.
				</p>
			</template>
			<template #footer>
				<div class="flex justify-end gap-2 w-full">
					<UButton color="neutral" variant="ghost" @click="konfirmasiHapus = false">
						Batal
					</UButton>
					<UButton color="error" icon="i-lucide-trash-2" @click="hapusManual">
						Hapus
					</UButton>
				</div>
			</template>
		</UModal>
	</LayoutPageShell>
</template>

<script lang="ts" setup>
	import Dokumen from "~/components/Print/Sppd/Dokumen.vue";

	const { open: openPrint } = usePrint();

	const DAERAH = [{ label: "Dalam daerah", value: "dalam daerah" }, { label: "Luar daerah", value: "luar daerah" }];

	const {
		connected,
		year,
		guru,
		saved,
		loading,
		saving,
		error,
		month,
		search,
		hanyaCocok,
		selectedKey,
		selected,
		form,
		manual,
		filtered,
		namaKegiatanArkas,
		sekolah,
		pick,
		pickManual,
		reset,
		save,
		hapus
	} = useGeneratorBelanja<SppdData>({
		setting: settingSppd,
		cocok: isTransport,
		pesanSimpan: "SPPD tersimpan",
		buat: (g, tersimpan, ctx) => {
			const bawaan = sppdBawaan(g, { sekolah: ctx.sekolah });
			if (!tersimpan) return bawaan;
			const ids = new Set(ctx.guru.map((x) => x.id));
			return { ...bawaan, ...tersimpan, biaya: { ...bawaan.biaya, ...tersimpan.biaya }, pelaksana: tersimpan.pelaksana.filter((id) => ids.has(id)) };
		}
	});

	const jenis = ref<JenisDokumenSppd[]>(DOKUMEN_SPPD.map((d) => d.value));

	const pelaksanaIds = computed(() => new Set(form.value?.pelaksana ?? []));
	const jumlahPelaksana = computed(() => (form.value ? pelaksanaSppd(form.value, guru.value).length : 0));
	const perOrang = computed(() => (form.value ? totalBiaya(form.value.biaya) : 0));
	const totalSemua = computed(() => perOrang.value * jumlahPelaksana.value);

	// SPPD manual: disimpan bersama SPPD dari BKU dengan kunci berawalan "manual-".
	const daftarManual = computed(() =>
		Object.entries(saved.value)
			.filter(([key]) => isSppdManual(key))
			.map(([key, data]) => ({ key, data }))
			.sort((a, b) => b.data.tanggalBerangkat.localeCompare(a.data.tanggalBerangkat)));
	const tersimpanSekarang = computed(() => !!selectedKey.value && selectedKey.value in saved.value);

	const isianManual = (tersimpan?: SppdData): SppdData => {
		const kosong = sppdKosong({ sekolah: sekolah.value?.nama });
		if (!tersimpan) return kosong;
		const ids = new Set(guru.value.map((x) => x.id));
		return {
			...kosong,
			...tersimpan,
			biaya: { ...kosong.biaya, ...tersimpan.biaya },
			pelaksana: tersimpan.pelaksana.filter((id) => ids.has(id)),
			pelaksanaLain: tersimpan.pelaksanaLain ?? []
		};
	};
	const buatManual = () => pickManual(kunciSppdManual(), isianManual());
	const bukaManual = (key: string) => {
		const tersimpan = saved.value[key];
		if (tersimpan) pickManual(key, isianManual(structuredClone(toRaw(tersimpan))));
	};

	// Dasar & poin "Untuk" surat tugas yang bisa ditulis bebas.
	const susunDasar = ref(false);
	const surat = reactive({ asal: "", nomor: "", tanggal: "", perihal: "" });
	const bukaSusunDasar = () => {
		Object.assign(surat, { nomor: "", tanggal: "", perihal: "" });
		susunDasar.value = true;
	};
	const tambahDasar = () => {
		if (!form.value) return;
		form.value.dasar = [...barisTeks(form.value.dasar), dasarDariSurat(surat)].join("\n");
		susunDasar.value = false;
	};
	const isiUntukBawaan = () => {
		if (form.value) form.value.untuk = untukBawaan(form.value).join("\n");
	};

	const konfirmasiHapus = ref(false);
	const hapusManual = async () => {
		if (selectedKey.value && isSppdManual(selectedKey.value)) await hapus(selectedKey.value);
		konfirmasiHapus.value = false;
	};

	const tambahPelaksanaLain = () => {
		if (!form.value) return;
		form.value.pelaksanaLain = [
			...(form.value.pelaksanaLain ?? []),
			{ id: `lain-${Date.now().toString(36)}`, nama: "", nip: "", pangkat: "", tugas: "Guru", kelasMapel: "" }
		];
	};
	/** Salin data guru sebagai pelaksana yang bisa diubah khusus untuk SPPD ini (mis. jabatan/pangkat). */
	const pilihanGuru = computed(() => guru.value.map((g) => ({
		label: g.nama,
		description: [jabatanSppd(g), g.nip].filter(Boolean).join(" · "),
		value: g.id
	})));
	const tambahDariGuru = (id: string) => {
		const g = guru.value.find((x) => x.id === id);
		if (!g || !form.value) return;
		// Bila guru ini sudah dicentang di atas, centangnya dilepas agar tidak tercetak dua kali.
		form.value.pelaksana = form.value.pelaksana.filter((x) => x !== id);
		form.value.pelaksanaLain = [
			...(form.value.pelaksanaLain ?? []),
			{ ...structuredClone(toRaw(g)), id: `lain-${Date.now().toString(36)}`, tugas: jabatanSppd(g), pangkat: g.pangkat ?? "" }
		];
	};
	const hapusPelaksanaLain = (i: number) => {
		form.value?.pelaksanaLain?.splice(i, 1);
	};

	const setPelaksana = (id: string, ikut: boolean) => {
		if (!form.value) return;
		// Urutan mengikuti daftar guru di Pengaturan.
		form.value.pelaksana = guru.value.map((g) => g.id).filter((x) => (x === id ? ikut : pelaksanaIds.value.has(x)));
	};
	const toggleSemua = () => {
		if (form.value) form.value.pelaksana = pelaksanaIds.value.size === guru.value.length ? [] : guru.value.map((g) => g.id);
	};
	const toggleJenis = (j: JenisDokumenSppd, on: boolean) => {
		jenis.value = DOKUMEN_SPPD.map((d) => d.value).filter((v) => (v === j ? on : jenis.value.includes(v)));
	};

	const print = async () => {
		if (!form.value || (!selected.value && !manual.value)) return;
		await save(true);
		openPrint({
			title: `SPPD ${form.value.maksud}`,
			component: Dokumen,
			props: { d: structuredClone(toRaw(form.value)), guru: toRaw(guru.value), jenis: [...jenis.value] }
		});
	};
</script>
