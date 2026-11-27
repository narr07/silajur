<template>
	<span class="hidden" />
</template>

<script lang="ts" setup>
	// Pemberitahuan "belanjakan & buat SI" mulai tanggal pengingat (bawaan 20) tiap bulan.
	// Muncul sekali per hari per jalannya aplikasi; tombolnya menunda atau menandai selesai.
	const { connected, year } = useArkas();
	const { status, periksa, tundaBesok, selesaiBulanIni } = usePengingatBelanja();
	const toast = useToast();
	const router = useRouter();
	const sudahTampil = useState<string>("pengingat-belanja-tampil", () => "");

	const tampilkan = async () => {
		const hari = new Date().toDateString();
		if (sudahTampil.value === hari) return;
		const s = await periksa();
		if (!s?.tampil) return;
		sudahTampil.value = hari;

		const bagian = [
			s.sisa > 0 ? `Masih ada ${s.itemBelum} item RKAS senilai ${rupiah(s.sisa)} yang belum dibelanjakan` : "",
			s.siDibuat ? "" : `${s.sisa > 0 ? "s" : "S"}tanding Instruction (SI) bulan ini belum dibuat`
		].filter(Boolean);
		toast.add({
			id: "pengingat-belanja",
			title: `Pengingat tanggal ${new Date().getDate()} ${BULAN[s.bulan - 1]}`,
			description: `${bagian.join("; ")}. Segera belanjakan dan buat SI sebelum akhir bulan.`,
			icon: "i-lucide-bell-ring",
			color: "warning",
			duration: 0,
			actions: [
				{ label: "Rencana belanja", icon: "i-lucide-shopping-cart", color: "warning", variant: "solid", onClick: () => {
					router.push("/penganggaran/belanja");
				} },
				{ label: "Buat SI", icon: "i-lucide-landmark", color: "warning", variant: "outline", onClick: () => {
					router.push("/generator/si");
				} },
				{ label: "Ingatkan besok", color: "neutral", variant: "ghost", onClick: () => {
					tundaBesok().catch(() => {});
				} },
				{ label: "Sudah selesai", color: "neutral", variant: "ghost", onClick: () => {
					selesaiBulanIni().catch(() => {});
				} }
			]
		});
	};

	watch([connected, year], () => {
		tampilkan().catch(() => {});
	}, { immediate: true });

	// Aplikasi sering dibiarkan terbuka berhari-hari: periksa lagi tiap jam.
	useIntervalFn(() => {
		tampilkan().catch(() => {});
	}, 60 * 60 * 1000);

	// Status di Dashboard ikut berubah ketika tombol tunda/selesai dipakai.
	watch(() => status.value?.tampil, (v) => {
		if (v === false) toast.remove("pengingat-belanja");
	});
</script>
