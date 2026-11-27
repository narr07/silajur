<template>
	<PrintSheet v-for="(page, pi) in pages" :key="pi" :landscape="page.orientasi === 'landscape'" :margin="page.orientasi === 'landscape' ? 15 : 20">
		<div class="doc naskah-bosp">
			<template v-for="(b, bi) in page.blocks" :key="bi">
				<!-- KOP -->
				<div v-if="b.t === 'kop'" class="mb-4 border-b-[3px] border-double border-black pb-2">
					<div class="flex items-center gap-3">
						<div v-if="profil.logoKiri" class="w-[14%] shrink-0">
							<img :src="profil.logoKiri" alt="" class="mx-auto h-16 w-16 object-contain">
						</div>
						<div class="flex-1 text-center leading-tight">
							<p v-if="kop.pemda" class="text-[13pt] font-bold uppercase">
								{{ kop.pemda }}
							</p>
							<p v-if="kop.dinas" class="text-[13pt] font-bold uppercase">
								{{ kop.dinas }}
							</p>
							<p v-if="kop.sekolah" class="text-[15pt] font-bold">
								{{ kop.sekolah }}
							</p>
							<p v-if="kop.alamat" class="text-[9.5pt] italic">
								{{ kop.alamat }}
							</p>
							<p v-if="kop.kontak" class="text-[9.5pt] italic">
								{{ kop.kontak }}
							</p>
						</div>
						<div v-if="profil.logoKanan" class="w-[14%] shrink-0">
							<img :src="profil.logoKanan" alt="" class="mx-auto h-16 w-16 object-contain">
						</div>
					</div>
				</div>

				<div v-else-if="b.t === 'title'" class="mb-3 text-center font-bold">
					<p class="text-[13pt]" :class="!b.sub ? 'underline' : ''">
						{{ b.text }}
					</p>
					<p v-for="(l, li) in lines(b.sub || '')" :key="li">
						{{ l }}
					</p>
				</div>

				<div v-else-if="b.t === 'p'" class="mb-2" :class="{ 'font-bold': b.bold, 'italic': b.italic }" :style="{ textAlign: b.align || 'left' }">
					<p v-for="(l, li) in lines(b.text)" :key="li" :class="b.indent ? 'indent-10' : ''">
						<span v-for="(s, si) in parseBold(l)" :key="si" :class="s.bold ? 'font-bold' : ''">{{ s.text }}</span>
					</p>
				</div>

				<div v-else-if="b.t === 'space'" :style="{ height: `${(b.n || 1) * 1.2}em` }" />

				<!-- Daftar bernomor: penomoran ditulis sendiri agar sama dengan file .docx. -->
				<ol v-else-if="b.t === 'list'" class="mb-3 space-y-1 pl-6 text-justify">
					<li v-for="(it, i) in b.items" :key="i" class="flex gap-2">
						<span class="w-5 shrink-0">{{ mark(b.style, i) }}</span>
						<span>
							<span v-for="(s, si) in parseBold(it)" :key="si" :class="s.bold ? 'font-bold' : ''">{{ s.text }}</span>
						</span>
					</li>
				</ol>

				<!-- Tabel label : isi tanpa garis (bukan data). -->
				<table v-else-if="b.t === 'meta'" class="mb-3 w-full table-fixed">
					<tbody>
						<tr v-for="([k, v], ri) in b.rows" :key="ri" class="align-top" :class="b.bold?.includes(ri) ? 'font-bold' : ''">
							<td class="w-[24%] py-0.5">
								{{ k }}
							</td>
							<td class="w-[3%] text-center">
								:
							</td>
							<td class="text-justify">
								<p v-for="(l, li) in barisMeta(v)" :key="li" :class="l.nomor || l.lanjutan ? 'pl-[2.2em]' : ''" :style="l.nomor ? { textIndent: '-2.2em' } : undefined">
									<span v-if="l.nomor" class="inline-block w-[2.2em]" style="text-indent: 0">{{ l.nomor }}</span>
									<span v-for="(s, si) in parseBold(l.isi)" :key="si" :class="s.bold ? 'font-bold' : ''">{{ s.text }}</span>
								</p>
							</td>
						</tr>
					</tbody>
				</table>

				<table v-else-if="b.t === 'table'" class="tabel naskah-tabel mb-4" :class="b.kecil ? 'kecil' : ''">
					<colgroup>
						<col v-for="(w, wi) in lebarKolom(b)" :key="wi" :style="{ width: `${w}%` }">
					</colgroup>
					<thead>
						<tr>
							<th v-for="(h, hi) in judulAtas(b)" :key="hi" :rowspan="h.rowspan" :colspan="h.colspan">
								{{ h.teks }}
							</th>
						</tr>
						<tr v-if="b.kelompok?.length">
							<th v-for="(h, hi) in judulBawah(b)" :key="hi">
								{{ h }}
							</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(r, ri) in b.rows" :key="ri" :class="b.tall ? 'tall' : ''">
							<td v-for="(c, ci) in r" :key="ci" :style="{ textAlign: alignKolom(b)[ci] }">
								<p v-for="(l, li) in lines(c)" :key="li">
									<span v-for="(s, si) in parseBold(l)" :key="si" :class="s.bold ? 'font-bold' : ''">{{ s.text }}</span>
								</p>
							</td>
						</tr>
					</tbody>
				</table>

				<div v-else-if="b.t === 'sign'" class="mt-4 mb-2 flex break-inside-avoid">
					<div v-for="(s, si) in signColumns(b)" :key="si" class="flex-1" :class="s?.rata === 'left' ? 'text-left' : 'text-center'">
						<template v-if="s">
							<p v-for="(l, li) in lines(s.atas || '')" :key="`a${li}`" class="whitespace-pre">
								{{ l || NBSP }}
							</p>
							<p v-for="(l, li) in lines(s.jabatan)" :key="`j${li}`">
								{{ l }}
							</p>
							<div class="flex h-20 items-center" :class="s.rata === 'left' ? 'justify-start' : 'justify-center'">
								<span v-if="s.meterai" class="border border-dashed border-gray-400 px-2 py-1 text-[8pt] italic text-gray-500">Meterai Rp10.000</span>
							</div>
							<p class="font-bold" :class="s.garisBawah === false ? '' : 'underline'">
								{{ s.nama }}
							</p>
							<p v-if="s.pangkat">
								{{ s.pangkat }}
							</p>
							<p v-if="s.nip">
								NIP. {{ s.nip }}
							</p>
						</template>
					</div>
				</div>

				<div v-else-if="b.t === 'photos'" class="mb-4 grid grid-cols-2 gap-3">
					<div v-for="n in b.n" :key="n" class="text-center text-[10pt]">
						<div class="flex aspect-[4/3] items-center justify-center border border-gray-500 italic text-gray-500">
							[ Tempel foto di sini ]
						</div>
						<p>{{ b.captions?.[n - 1] ?? `Foto ${n}` }}</p>
					</div>
				</div>
			</template>
		</div>
	</PrintSheet>
</template>

<script lang="ts" setup>
	// Naskah dinas dari blok Surat BOSP. Dipakai untuk pratinjau di editor dan untuk cetak (usePrint).
	import type { Block, Orientasi } from "~/utils/bosp/blocks";
	import type { ProfilSurat } from "~/utils/bosp/profil";
	import { alignKolom, lebarKolom, parseBold, polaNomor, signColumns } from "~/utils/bosp/blocks";
	import { kopLines } from "~/utils/bosp/profil";

	const props = defineProps<{ blocks: Block[], profil: ProfilSurat }>();
	const kop = computed(() => kopLines(props.profil));

	/** Pecah menjadi halaman per blok `break` / `halaman`; `halaman` juga mengganti orientasi kertas. */
	const pages = computed(() => {
		const out: { orientasi: Orientasi, blocks: Block[] }[] = [{ orientasi: "portrait", blocks: [] }];
		for (const b of props.blocks) {
			const akhir = out.at(-1)!;
			if (b.t === "break") {
				out.push({ orientasi: akhir.orientasi, blocks: [] });
			} else if (b.t === "halaman") {
				if (akhir.blocks.length) out.push({ orientasi: b.orientasi, blocks: [] });
				else akhir.orientasi = b.orientasi;
			} else {
				akhir.blocks.push(b);
			}
		}
		return out;
	});

	/** Spasi tak terputus agar baris kosong di atas jabatan tetap setinggi satu baris. */
	const NBSP = " ";
	const lines = (s: string) => s.split("\n");
	const mark = (style: string | undefined, i: number) => style === "alpha" ? `${String.fromCharCode(97 + i)}.` : style === "bullet" ? "•" : `${i + 1}.`;

	/** Baris judul tabel bertingkat: kolom berkelompok di baris kedua, kolom lain memakai rowspan 2. */
	function judulAtas(b: Extract<Block, { t: "table" }>) {
		const out: { teks: string, rowspan?: number, colspan?: number }[] = [];
		for (let i = 0; i < b.head.length;) {
			const k = b.kelompok?.find((g) => g.mulai === i);
			if (k) {
				out.push({ teks: k.teks, colspan: k.jumlah });
				i += k.jumlah;
			} else {
				out.push({ teks: b.head[i]!, rowspan: b.kelompok?.length ? 2 : undefined });
				i++;
			}
		}
		return out;
	}
	const judulBawah = (b: Extract<Block, { t: "table" }>) =>
		(b.kelompok ?? []).flatMap((k) => b.head.slice(k.mulai, k.mulai + k.jumlah));

	/** Baris daftar bernomor di Menimbang/Mengingat diberi indentasi gantung. */
	function barisMeta(v: string) {
		let dalamDaftar = false;
		return lines(v).map((l) => {
			const n = polaNomor(l);
			if (n) dalamDaftar = true;
			return { nomor: n?.nomor, isi: n ? n.isi : l, lanjutan: !n && dalamDaftar };
		});
	}
</script>
