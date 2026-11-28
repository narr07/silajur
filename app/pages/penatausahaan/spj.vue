<template>
	<LayoutPageShell title="Kelengkapan SPJ">
		<template #actions>
			<USelect v-model="bulan" :items="bulanItems" class="w-36" />
			<UButton color="neutral" variant="outline" icon="i-lucide-printer" :disabled="!lengkapList.length" :loading="mencetak === 'semua'" @click="cetak(lengkapList, 'semua')">
				Cetak yang lengkap ({{ lengkapList.length }})
			</UButton>
		</template>

		<div v-if="!connected" class="py-16 text-center text-muted">
			Hubungkan ARKAS terlebih dahulu.
		</div>
		<div v-else class="space-y-4 pb-16">
			<UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="error" />

			<div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
				<UCard :ui="{ body: 'p-4 sm:p-4' }">
					<p class="text-xs text-muted">
						Transaksi belanja
					</p>
					<p class="text-2xl font-semibold tabular">
						{{ rows.length }}
					</p>
				</UCard>
				<UCard :ui="{ body: 'p-4 sm:p-4' }">
					<p class="text-xs text-muted">
						SPJ lengkap
					</p>
					<p class="text-2xl font-semibold tabular text-success">
						{{ lengkapList.length }}
					</p>
				</UCard>
				<UCard :ui="{ body: 'p-4 sm:p-4' }">
					<p class="text-xs text-muted">
						Belum lengkap
					</p>
					<p class="text-2xl font-semibold tabular" :class="rows.length - lengkapList.length ? 'text-warning' : ''">
						{{ rows.length - lengkapList.length }}
					</p>
				</UCard>
				<UCard :ui="{ body: 'p-4 sm:p-4' }">
					<p class="text-xs text-muted">
						Kelengkapan dokumen
					</p>
					<div class="flex items-center gap-2">
						<p class="text-2xl font-semibold tabular">
							{{ persen }}%
						</p>
						<UProgress :model-value="persen" size="sm" class="flex-1" />
					</div>
				</UCard>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<UFieldGroup size="sm">
					<UButton :color="saring === 'belum' ? 'primary' : 'neutral'" :variant="saring === 'belum' ? 'solid' : 'outline'" @click="saring = 'belum'">
						Belum lengkap
					</UButton>
					<UButton :color="saring === 'semua' ? 'primary' : 'neutral'" :variant="saring === 'semua' ? 'solid' : 'outline'" @click="saring = 'semua'">
						Semua
					</UButton>
				</UFieldGroup>
				<UInput v-model="cari" icon="i-lucide-search" placeholder="Cari uraian, no. bukti, toko…" size="sm" class="w-64" />
				<p class="ml-auto text-xs text-muted">
					Dokumen ditandai otomatis bila sudah dicetak/dibuat di SiLajur atau sudah diunggah.
				</p>
			</div>

			<USkeleton v-if="loading" class="h-64 w-full" />
			<UEmpty v-else-if="!tampil.length" icon="i-lucide-clipboard-check" :title="saring === 'belum' && rows.length ? 'Semua SPJ bulan ini sudah lengkap' : 'Tidak ada transaksi belanja'" :description="saring === 'belum' && rows.length ? 'Pilih Semua untuk melihat daftar lengkapnya.' : 'Pilih bulan lain atau ubah pencarian.'" />

			<UCard v-for="r in tampil" v-else :key="r.g.key" :ui="{ body: 'p-0 sm:p-0', header: 'p-3 sm:px-4' }">
				<template #header>
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
						<UButton color="neutral" variant="ghost" size="xs" :icon="terbuka[r.g.key] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" :aria-label="terbuka[r.g.key] ? 'Tutup' : 'Buka'" @click="terbuka[r.g.key] = !terbuka[r.g.key]" />
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium text-highlighted" :title="r.g.uraian">
								{{ r.g.uraian }}
							</p>
							<p class="text-xs text-muted">
								{{ tanggalId(r.g.tanggal) }} · <span class="font-mono">{{ r.g.noBukti || "-" }}</span>
								<template v-if="r.g.nota?.namaToko">
									· {{ r.g.nota.namaToko }}
								</template>
							</p>
						</div>
						<UBadge color="neutral" variant="subtle" :icon="JENIS_BELANJA[r.jenis].icon">
							{{ JENIS_BELANJA[r.jenis].label }}
						</UBadge>
						<UBadge v-if="r.g.isSiplah" color="info" variant="subtle">
							SIPLah
						</UBadge>
						<span class="tabular text-sm font-medium">{{ rupiah(r.g.total) }}</span>
						<UBadge :color="r.status.lengkap ? 'success' : 'warning'" variant="subtle" :title="r.status.kurang.length ? `Belum ada: ${r.status.kurang.join(', ')}` : 'Lengkap'">
							{{ r.status.ada }}/{{ r.status.wajib }}
						</UBadge>
						<UButton size="xs" color="neutral" variant="outline" icon="i-lucide-printer" :loading="mencetak === r.g.key" @click="cetak([r], r.g.key)">
							Cetak paket
						</UButton>
					</div>
				</template>

				<ul v-if="terbuka[r.g.key]" class="divide-y divide-default">
					<li v-for="d in r.dok" :key="d.id" class="flex flex-wrap items-start gap-3 px-4 py-2.5">
						<UIcon :name="dokumenAda(d, data.centang[r.g.key]) ? 'i-lucide-circle-check' : d.opsional ? 'i-lucide-circle-dashed' : 'i-lucide-circle-alert'" class="mt-0.5 size-5 shrink-0" :class="dokumenAda(d, data.centang[r.g.key]) ? 'text-success' : d.opsional ? 'text-muted' : 'text-warning'" />
						<div class="min-w-0 flex-1 space-y-1">
							<p class="text-sm text-highlighted">
								{{ d.label }}
								<UBadge v-if="d.opsional" size="sm" color="neutral" variant="outline" class="ml-1">
									bila ada
								</UBadge>
								<UBadge v-if="d.otomatis && !berkasDok(r.g.key, d.id).length" size="sm" color="success" variant="subtle" class="ml-1">
									otomatis
								</UBadge>
							</p>
							<p v-if="d.ket" class="text-xs text-muted">
								{{ d.ket }}
							</p>
							<div v-if="berkasDok(r.g.key, d.id).length" class="flex flex-wrap gap-1.5">
								<UBadge v-for="f in berkasDok(r.g.key, d.id)" :key="f.id" color="neutral" variant="outline" class="gap-1">
									<UIcon :name="f.mime === 'application/pdf' ? 'i-lucide-file-text' : 'i-lucide-image'" class="size-3.5" />
									<button type="button" class="hover:underline" @click="lihat(f)">
										{{ namaBerkas(f) }}
									</button>
									<UButton size="xs" color="error" variant="link" icon="i-lucide-x" :aria-label="`Hapus ${namaBerkas(f)}`" class="p-0" @click="hapusTarget = f" />
								</UBadge>
							</div>
						</div>
						<div class="flex flex-wrap items-center gap-1.5">
							<UCheckbox v-if="!d.otomatis" :model-value="!!data.centang[r.g.key]?.[d.id]" label="Ada (fisik)" @update:model-value="(v) => tandai(r.g.key, d.id, !!v)" />
							<UButton size="xs" color="neutral" variant="outline" icon="i-lucide-upload" :loading="mengunggah === `${r.g.key}:${d.id}`" @click="unggah(r.g, d.id)">
								Unggah
							</UButton>
							<UButton v-if="d.tautan" size="xs" color="primary" variant="soft" icon="i-lucide-arrow-right" :to="d.tautan.to">
								{{ d.tautan.label }}
							</UButton>
						</div>
					</li>
				</ul>
			</UCard>
		</div>

		<UModal :open="!!pratinjau" :title="pratinjau?.nama" @update:open="(v) => { if (!v) pratinjau = null }">
			<template #body>
				<USkeleton v-if="pratinjau?.memuat" class="h-96 w-full" />
				<div v-else-if="pratinjau?.halaman.length" class="max-h-[70vh] space-y-3 overflow-auto">
					<img v-for="(h, i) in pratinjau.halaman" :key="i" :src="h" :alt="`${pratinjau.nama} halaman ${i + 1}`" class="mx-auto w-full object-contain shadow">
				</div>
				<p v-else class="text-sm text-muted">
					Berkas tidak bisa ditampilkan.
				</p>
			</template>
		</UModal>

		<UModal :open="!!hapusTarget" title="Hapus berkas lampiran?" description="Berkas dihapus dari penyimpanan SiLajur di komputer ini dan tidak bisa dikembalikan." @update:open="(v) => { if (!v) hapusTarget = null }">
			<template #body>
				<p v-if="hapusTarget" class="text-sm">
					{{ namaBerkas(hapusTarget) }}
				</p>
			</template>
			<template #footer>
				<div class="flex w-full justify-end gap-2">
					<UButton color="neutral" variant="outline" label="Batal" @click="hapusTarget = null" />
					<UButton color="error" icon="i-lucide-trash-2" label="Hapus" @click="hapus" />
				</div>
			</template>
		</UModal>
	</LayoutPageShell>
</template>

<script lang="ts" setup>
	import type { DataSpj, ItemPaketSpj, JenisBelanja } from "~/utils/spj";
	import type { NotaFile, NotaGroup } from "~/utils/types";
	import PaketSpj from "~/components/Print/Spj/Paket.vue";
	import { settingRapat } from "~/utils/rapat";
	import { dataSpjKosong, dokumenAda, dokumenSpj, hitungBerkas, JENIS_BELANJA, jenisBelanja, settingSpj, statusSpj } from "~/utils/spj";
	import { settingSppd } from "~/utils/sppd";

	const { connected, year, fund } = useArkas();
	const { open: openPrint } = usePrint();
	const toast = useToast();

	const bulan = ref(new Date().getMonth() + 1);
	const bulanItems = BULAN.map((label, i) => ({ label, value: i + 1 }));
	const saring = ref<"belum" | "semua">("belum");
	const cari = ref("");
	const terbuka = ref<Record<string, boolean>>({});

	const groups = ref<NotaGroup[]>([]);
	const files = ref<NotaFile[]>([]);
	const rekeningNames = ref<Record<string, string>>({});
	const rapat = ref<Record<string, unknown>>({});
	const sppd = ref<Record<string, unknown>>({});
	const data = ref<DataSpj>(dataSpjKosong());
	const loading = ref(false);
	const error = ref("");
	const fundArg = computed(() => (fund.value === ALL_FUNDS ? null : fund.value));

	const muat = async () => {
		if (!connected.value || !year.value) return;
		loading.value = true;
		error.value = "";
		try {
			const [g, kk, r, s, d, f] = await Promise.all([
				api.notaList(year.value, bulan.value, fundArg.value),
				api.kertasKerja(year.value, null).catch(() => null),
				api.settingsGet<Record<string, unknown>>(settingRapat(year.value)).catch(() => null),
				api.settingsGet<Record<string, unknown>>(settingSppd(year.value)).catch(() => null),
				api.settingsGet<DataSpj>(settingSpj(year.value)).catch(() => null),
				api.notaFileList(year.value).catch(() => [])
			]);
			groups.value = g;
			rekeningNames.value = kk?.rekeningNames ?? {};
			rapat.value = r ?? {};
			sppd.value = s ?? {};
			data.value = { ...dataSpjKosong(), ...d };
			files.value = f;
		} catch (err) {
			error.value = errorMessage(err);
		} finally {
			loading.value = false;
		}
	};
	watch([year, connected, bulan, fund], muat, { immediate: true });

	const berkasPer = computed(() => hitungBerkas(files.value, data.value.berkas));
	const rows = computed(() => groups.value.map((g) => {
		const dok = dokumenSpj(g, { rekeningNames: rekeningNames.value, rapat: rapat.value, sppd: sppd.value }, berkasPer.value[g.key]);
		return { g, jenis: jenisBelanja(g, rekeningNames.value) as JenisBelanja, dok, status: statusSpj(dok, data.value.centang[g.key]) };
	}));
	type Baris = (typeof rows.value)[number];
	const lengkapList = computed(() => rows.value.filter((r) => r.status.lengkap));
	const persen = computed(() => {
		const wajib = rows.value.reduce((n, r) => n + r.status.wajib, 0);
		return wajib ? Math.round((rows.value.reduce((n, r) => n + r.status.ada, 0) / wajib) * 100) : 0;
	});
	const tampil = computed(() => {
		const q = cari.value.trim().toLowerCase();
		return rows.value.filter((r) =>
			(saring.value === "semua" || !r.status.lengkap)
			&& (!q || `${r.g.uraian} ${r.g.noBukti} ${r.g.nota?.namaToko ?? ""}`.toLowerCase().includes(q))
		);
	});

	const berkasDok = (key: string, dok: string) => files.value.filter((f) => f.refId === key && (data.value.berkas[f.id] ?? "nota") === dok);
	const namaBerkas = (f: NotaFile) => f.fileName.split("/").pop() ?? f.fileName;

	const simpan = async () => {
		if (!year.value) return;
		try {
			await api.settingsSet(settingSpj(year.value), toRaw(data.value));
		} catch (err) {
			toast.add({ title: "Gagal menyimpan", description: errorMessage(err), color: "error" });
		}
	};

	const tandai = (key: string, dok: string, v: boolean) => {
		const per = { ...data.value.centang[key] };
		if (v) per[dok] = true;
		else delete per[dok];
		data.value = { ...data.value, centang: { ...data.value.centang, [key]: per } };
		simpan();
	};

	/* ── Unggah, lihat, hapus berkas ── */
	const mengunggah = ref<string | null>(null);
	const unggah = async (g: NotaGroup, dok: string) => {
		if (!year.value) return;
		const picked = await useTauriDialogOpen({ multiple: true, filters: [{ name: "Scan/foto/PDF", extensions: ["jpg", "jpeg", "png", "pdf"] }] });
		const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];
		if (!paths.length) return;
		mengunggah.value = `${g.key}:${dok}`;
		const m = Number(g.tanggal.slice(5, 7)) || bulan.value;
		let ok = 0;
		try {
			for (const p of paths) {
				const id = await api.notaFileUpload(year.value, g.key, m, p);
				data.value.berkas[id] = dok;
				ok++;
			}
		} catch (err) {
			toast.add({ title: "Gagal mengunggah berkas", description: errorMessage(err), color: "error" });
		} finally {
			mengunggah.value = null;
			await simpan();
			files.value = await api.notaFileList(year.value).catch(() => files.value);
			if (ok) toast.add({ title: `${ok} berkas terlampir`, color: "success", icon: "i-lucide-paperclip" });
		}
	};

	/** Halaman siap tampil/cetak: gambar apa adanya, PDF dirender per halaman. */
	const halamanBerkas = async (f: NotaFile): Promise<string[]> => {
		const isi = await api.notaFileData(f.id).catch(() => "");
		if (!isi) return [];
		return f.mime === "application/pdf" ? pdfKeGambar(isi) : [isi];
	};

	const pratinjau = ref<{ nama: string, halaman: string[], memuat: boolean } | null>(null);
	const lihat = async (f: NotaFile) => {
		pratinjau.value = { nama: namaBerkas(f), halaman: [], memuat: true };
		const halaman = await halamanBerkas(f).catch(() => []);
		if (pratinjau.value?.nama === namaBerkas(f)) pratinjau.value = { nama: namaBerkas(f), halaman, memuat: false };
	};

	const hapusTarget = ref<NotaFile | null>(null);
	const hapus = async () => {
		const f = hapusTarget.value;
		hapusTarget.value = null;
		if (!f) return;
		try {
			await api.notaFileDelete(f.id);
			files.value = files.value.filter((x) => x.id !== f.id);
			const { [f.id]: _, ...sisa } = data.value.berkas;
			data.value = { ...data.value, berkas: sisa };
			await simpan();
		} catch (err) {
			toast.add({ title: "Gagal menghapus berkas", description: errorMessage(err), color: "error" });
		}
	};

	/* ── Cetak paket SPJ ── */
	const mencetak = ref<string | null>(null);
	const labelDok = (r: Baris, id: string) => r.dok.find((d) => d.id === id)?.label ?? "Nota / faktur";
	const cetak = async (list: Baris[], kunci: string) => {
		mencetak.value = kunci;
		try {
			const items: ItemPaketSpj[] = [];
			for (const r of list) {
				const milik = files.value.filter((f) => f.refId === r.g.key);
				const gambar: ItemPaketSpj["gambar"] = [];
				const gagal: { nama: string, dok: string }[] = [];
				// Urut sesuai daftar dokumen agar lampiran tercetak rapi per jenis.
				const urut = (f: NotaFile) => {
					const i = r.dok.findIndex((d) => d.id === (data.value.berkas[f.id] ?? "nota"));
					return i < 0 ? 99 : i;
				};
				for (const f of [...milik].sort((a, b) => urut(a) - urut(b))) {
					const dok = labelDok(r, data.value.berkas[f.id] ?? "nota");
					const halaman = await halamanBerkas(f).catch(() => []);
					if (!halaman.length) gagal.push({ nama: namaBerkas(f), dok });
					halaman.forEach((isi, i) => gambar.push({ id: `${f.id}-${i}`, nama: halaman.length > 1 ? `${namaBerkas(f)} (hal. ${i + 1}/${halaman.length})` : namaBerkas(f), dok, data: isi }));
				}
				const berkasDokMap: Record<string, string[]> = {};
				for (const f of milik) (berkasDokMap[data.value.berkas[f.id] ?? "nota"] ??= []).push(namaBerkas(f));
				items.push({
					g: r.g,
					jenis: JENIS_BELANJA[r.jenis].label,
					dok: r.dok,
					centang: data.value.centang[r.g.key] ?? {},
					status: r.status,
					berkasDok: berkasDokMap,
					gambar,
					pdf: gagal
				});
			}
			openPrint({ title: list.length === 1 ? `Paket SPJ ${list[0]!.g.noBukti || ""}` : `Paket SPJ ${BULAN[bulan.value - 1]} (${list.length} transaksi)`, component: PaketSpj, props: { items } });
		} finally {
			mencetak.value = null;
		}
	};
</script>
