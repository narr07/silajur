<template>
	<template v-for="it in items" :key="it.g.key">
		<!-- Lembar kendali SPJ -->
		<PrintSheet>
			<div class="doc">
				<PrintKopSurat ringkas />
				<p class="mt-2 text-center text-[12pt] font-bold underline">
					LEMBAR KENDALI SPJ
				</p>
				<PrintFields
					class="mt-3"
					label-width="8rem"
					:rows="[
						['Tanggal', tanggalPanjang(it.g.tanggal)],
						['No. Bukti', it.g.noBukti || '-'],
						['Uraian', it.g.uraian],
						['Penyedia', it.g.nota?.namaToko || '-'],
						['Jenis belanja', it.jenis],
						['Jumlah', rupiah(it.g.total)],
						['Sumber dana', it.g.fundName]
					]"
				/>
				<table class="tabel mt-3">
					<thead>
						<tr>
							<th class="w-8">
								No
							</th>
							<th>Dokumen</th>
							<th class="w-24">
								Status
							</th>
							<th class="w-56">
								Keterangan
							</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(d, i) in it.dok" :key="d.id">
							<td class="text-center">
								{{ i + 1 }}
							</td>
							<td>{{ d.label }}<span v-if="d.opsional" class="italic"> (bila ada)</span></td>
							<td class="text-center font-bold">
								{{ ada(d, it) ? "✓ Ada" : d.opsional ? "-" : "Belum" }}
							</td>
							<td class="text-[9pt]">
								{{ ket(d, it) }}
							</td>
						</tr>
					</tbody>
				</table>
				<p v-if="it.pdf.length" class="mt-2 text-[9pt]">
					Lampiran yang tidak bisa dibaca (cetak terpisah): {{ it.pdf.map((f) => `${f.dok}: ${f.nama}`).join("; ") }}
				</p>
				<p class="mt-2 text-[9pt] italic">
					Kelengkapan: {{ it.status.ada }}/{{ it.status.wajib }} dokumen wajib{{ it.status.kurang.length ? ` · belum ada: ${it.status.kurang.join(", ")}` : " · lengkap" }}.
				</p>
			</div>
		</PrintSheet>

		<PrintNotaBuktiPengeluaran :groups="[it.g]" />
		<PrintNotaKwitansiA2 :groups="[it.g]" />

		<!-- Foto/scan lampiran, satu per halaman -->
		<PrintSheet v-for="f in it.gambar" :key="f.id">
			<div class="doc flex flex-col items-center gap-2">
				<p class="self-start text-[10pt] font-bold">
					Lampiran {{ it.g.noBukti || "" }} · {{ f.dok }}
				</p>
				<img :src="f.data" :alt="f.nama" class="max-h-[240mm] max-w-full object-contain">
			</div>
		</PrintSheet>
	</template>
</template>

<script lang="ts" setup>
	import type { DokumenSpj, ItemPaketSpj } from "~/utils/spj";
	import { dokumenAda } from "~/utils/spj";

	defineProps<{ items: ItemPaketSpj[] }>();

	const ada = (d: DokumenSpj, it: ItemPaketSpj) => dokumenAda(d, it.centang);
	const ket = (d: DokumenSpj, it: ItemPaketSpj) => {
		const n = it.berkasDok[d.id]?.length ?? 0;
		if (n) return `${n} berkas terlampir`;
		if (d.otomatis) return "Dibuat di SiLajur";
		if (it.centang[d.id]) return "Ditandai ada (berkas fisik)";
		return d.ket ?? "";
	};
</script>
