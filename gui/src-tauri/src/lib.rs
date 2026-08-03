use std::fs;
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

const DB_FILE: &str = "puppetdex.db";
const DB_STAMP: &str = "db.version";

fn bundled_db(app: &AppHandle) -> Result<PathBuf, String> {
	if let Ok(path) = app.path().resolve(DB_FILE, BaseDirectory::Resource) {
		if path.exists() {
			return Ok(path);
		}
	}

	let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
		.parent()
		.and_then(|p| p.parent())
		.map(|p| p.join("data").join(DB_FILE))
		.ok_or_else(|| "could not derive the development data directory".to_string())?;

	if dev_path.exists() {
		Ok(dev_path)
	} else {
		Err(format!(
			"database not found as a bundled resource or at {}. \
             Run `python3 parser/run_all.py` to build it.",
			dev_path.display()
		))
	}
}

fn db_fingerprint(app: &AppHandle, source: &Path) -> String {
	let version = app.package_info().version.to_string();
	let (len, modified) = fs::metadata(source)
		.map(|m| {
			let secs = m
				.modified()
				.ok()
				.and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
				.map(|d| d.as_secs())
				.unwrap_or(0);
			(m.len(), secs)
		})
		.unwrap_or((0, 0));
	format!("{version}:{len}:{modified}")
}

#[tauri::command]
fn db_connection_string(app: AppHandle) -> Result<String, String> {
	let config_dir = app
		.path()
		.app_config_dir()
		.map_err(|e| format!("no app config dir: {e}"))?;
	fs::create_dir_all(&config_dir)
		.map_err(|e| format!("creating {}: {e}", config_dir.display()))?;

	let installed = config_dir.join(DB_FILE);
	let stamp = config_dir.join(DB_STAMP);
	let source = bundled_db(&app)?;
	let fingerprint = db_fingerprint(&app, &source);
	let installed_fingerprint = fs::read_to_string(&stamp).unwrap_or_default();

	if !installed.exists() || installed_fingerprint.trim() != fingerprint {
		fs::copy(&source, &installed).map_err(|e| {
			format!(
				"copying {} to {}: {e}",
				source.display(),
				installed.display()
			)
		})?;
		let _ = fs::remove_file(config_dir.join(format!("{DB_FILE}-wal")));
		let _ = fs::remove_file(config_dir.join(format!("{DB_FILE}-shm")));
		fs::write(&stamp, &fingerprint).map_err(|e| format!("writing {}: {e}", stamp.display()))?;
	}

	Ok(format!("sqlite:{DB_FILE}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	tauri::Builder::default()
		.plugin(tauri_plugin_opener::init())
		.plugin(tauri_plugin_sql::Builder::new().build())
		.invoke_handler(tauri::generate_handler![db_connection_string])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
