#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
	if let Some(kode) = sibos_lib::subproses() {
		std::process::exit(kode);
	}
	sibos_lib::run();
}
