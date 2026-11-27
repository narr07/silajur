<template>
	<LayoutPageShell title="Ceklis BOSP">
		<template #actions>
			<UBadge color="neutral" variant="subtle" size="lg">
				TA {{ ta }}
			</UBadge>
			<UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" :disabled="!selesai" @click="resetOpen = true">
				Kosongkan
			</UButton>
		</template>

		<div class="space-y-4 max-w-5xl pb-16">
			<UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" title="Gagal memuat ceklis" :description="error" />

			<UTabs v-model="peran" :items="tabItems" :content="false" class="w-full" />

			<UCard>
				<div class="flex flex-wrap items-center gap-4">
					<UIcon :name="peranBospInfo[peran].icon" class="size-8 text-primary" />
					<div class="min-w-0 flex-1">
						<p class="font-semibold text-highlighted">
							{{ peranBospInfo[peran].nama }}
						</p>
						<p class="text-sm text-muted">
							{{ peranBospInfo[peran].deskripsi }}
						</p>
					</div>
					<div class="w-full sm:w-64">
						<div class="flex justify-between text-xs text-muted mb-1">
							<span>Progres TA {{ ta }}</span>
							<span class="tabular">{{ selesai }}/{{ total }}</span>
						</div>
						<UProgress :model-value="total ? (selesai / total) * 100 : 0" size="sm" />
					</div>
				</div>
			</UCard>

			<USkeleton v-if="loading" class="h-64 w-full" />

			<UCard v-for="k in ceklisBosp[peran]" v-else :key="k.id" :ui="{ body: 'p-0 sm:p-0' }">
				<template #header>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<p class="font-semibold text-highlighted">
							{{ k.judul }}
						</p>
						<UBadge :color="faseBospInfo[k.fase].color" variant="subtle">
							{{ faseBospInfo[k.fase].label }}
						</UBadge>
					</div>
				</template>

				<ul class="divide-y divide-default">
					<li v-for="it in k.items" :key="it.id" class="flex gap-3 px-4 py-3">
						<UCheckbox :model-value="!!status[it.id]" class="mt-0.5" :aria-label="it.judul" @update:model-value="(v) => tandai(it.id, !!v)" />
						<div class="min-w-0 flex-1 space-y-1.5">
							<p class="text-sm" :class="status[it.id] ? 'text-muted line-through' : 'text-highlighted'">
								{{ it.judul }}
							</p>
							<p v-if="it.detail" class="text-xs text-muted">
								{{ it.detail }}
							</p>
							<div class="flex flex-wrap items-center gap-1.5">
								<UBadge v-if="it.aplikasi" color="neutral" variant="outline" size="sm" icon="i-lucide-app-window">
									{{ it.aplikasi }}
								</UBadge>
								<UBadge v-if="it.tenggat" color="warning" variant="subtle" size="sm" icon="i-lucide-calendar-clock">
									Tenggat {{ it.tenggat }}
								</UBadge>
								<UPopover v-if="it.dasar && regulasiById[it.dasar]">
									<UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-scale">
										{{ regulasiById[it.dasar]!.nomor }}
									</UButton>
									<template #content>
										<div class="p-3 w-96 max-w-[90vw] space-y-2 text-sm">
											<p class="font-semibold text-highlighted">
												{{ regulasiById[it.dasar]!.judul }}
											</p>
											<p class="text-xs text-primary">
												{{ regulasiById[it.dasar]!.nomor }}
											</p>
											<ul class="list-disc space-y-1 pl-4 text-xs">
												<li v-for="(p, i) in regulasiById[it.dasar]!.poin" :key="i">
													{{ p }}
												</li>
											</ul>
											<p class="text-[11px] text-muted">
												Ringkasan diperiksa {{ regulasiById[it.dasar]!.diperiksa }}. Cocokkan dengan teks resmi dan arahan dinas.
											</p>
											<UButton v-if="regulasiById[it.dasar]!.url" size="xs" color="neutral" variant="outline" icon="i-lucide-external-link" @click="buka(regulasiById[it.dasar]!.url!)">
												Sumber resmi
											</UButton>
										</div>
									</template>
								</UPopover>
								<UButton v-if="it.template && templateById[it.template]" :to="`/bosp/surat/${it.template}`" size="xs" color="primary" variant="soft" icon="i-lucide-file-text">
									{{ templateById[it.template]!.judul }}
								</UButton>
								<UButton v-if="it.tautan" :to="it.tautan.to" size="xs" color="primary" variant="soft" icon="i-lucide-arrow-right">
									{{ it.tautan.label }}
								</UButton>
							</div>
						</div>
					</li>
				</ul>
			</UCard>

			<p class="text-xs text-muted">
				Centang disimpan per tahun anggaran di data SiLajur. Tahun anggaran mengikuti pilihan tahun di kanan atas.
			</p>
		</div>

		<UModal v-model:open="resetOpen" title="Kosongkan ceklis?">
			<template #body>
				<p class="text-sm">
					Semua centang <span class="font-semibold">{{ peranBospInfo[peran].nama }}</span> untuk TA {{ ta }} akan dihapus. Ceklis peran lain tidak berubah.
				</p>
			</template>
			<template #footer>
				<div class="flex w-full justify-end gap-2">
					<UButton color="neutral" variant="outline" @click="resetOpen = false">
						Batal
					</UButton>
					<UButton color="error" icon="i-lucide-rotate-ccw" @click="kosongkan">
						Kosongkan
					</UButton>
				</div>
			</template>
		</UModal>
	</LayoutPageShell>
</template>

<script lang="ts" setup>
	import type { StatusCeklisBosp } from "~/utils/bosp/ceklis";
	import type { PeranBosp } from "~/utils/bosp/templates";
	import { ceklisBosp, faseBospInfo, peranBospInfo, semuaItem, settingCeklisBosp } from "~/utils/bosp/ceklis";
	import { regulasi } from "~/utils/bosp/regulasi";
	import { templates } from "~/utils/bosp/templates";

	const { year } = useArkas();
	const toast = useToast();
	const ta = computed(() => year.value ?? new Date().getFullYear());

	const peran = ref<PeranBosp>("kepsek");
	const status = ref<StatusCeklisBosp>({});
	const loading = ref(false);
	const error = ref("");
	const resetOpen = ref(false);

	const regulasiById = Object.fromEntries(regulasi.map((r) => [r.id, r]));
	const templateById = Object.fromEntries(templates.map((t) => [t.id, t]));

	const hitung = (p: PeranBosp) => {
		const items = semuaItem(p);
		return { done: items.filter((i) => status.value[i.id]).length, total: items.length };
	};
	const tabItems = computed(() => (Object.keys(peranBospInfo) as PeranBosp[]).map((p) => {
		const h = hitung(p);
		return { label: `${peranBospInfo[p].nama} (${h.done}/${h.total})`, value: p, icon: peranBospInfo[p].icon };
	}));
	const selesai = computed(() => hitung(peran.value).done);
	const total = computed(() => hitung(peran.value).total);

	const load = async () => {
		loading.value = true;
		error.value = "";
		try {
			status.value = (await api.settingsGet<StatusCeklisBosp>(settingCeklisBosp(ta.value))) ?? {};
		} catch (err) {
			error.value = errorMessage(err);
			status.value = {};
		} finally {
			loading.value = false;
		}
	};

	const simpan = async () => {
		try {
			await api.settingsSet(settingCeklisBosp(ta.value), toRaw(status.value));
		} catch (err) {
			toast.add({ title: "Gagal menyimpan ceklis", description: errorMessage(err), color: "error" });
		}
	};

	const tandai = (id: string, v: boolean) => {
		const next = { ...status.value };
		if (v) next[id] = new Date().toISOString();
		else delete next[id];
		status.value = next;
		simpan();
	};

	const kosongkan = async () => {
		const ids = new Set(semuaItem(peran.value).map((i) => i.id));
		status.value = Object.fromEntries(Object.entries(status.value).filter(([id]) => !ids.has(id)));
		resetOpen.value = false;
		await simpan();
	};

	/** Tautan luar dibuka di browser bawaan. */
	const buka = async (url: string) => {
		try {
			if (inTauri()) await useTauriOpenerOpenUrl(url);
			else window.open(url, "_blank");
		} catch (err) {
			toast.add({ title: "Gagal membuka tautan", description: errorMessage(err), color: "error" });
		}
	};

	watch(ta, load, { immediate: true });
</script>
