use std::fs;
use std::path::PathBuf;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

const DB_FILE: &str = "puppetdex.db";
const DB_STAMP: &str = "db.version";

/// Locate the database that ships with the app.
///
/// In a packaged build this is a bundled resource. Under `tauri dev` there is
/// no bundle, so fall back to the copy the parser writes into the repo's
/// `data/` directory.
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

/// Hand the SQL plugin a path to a writable copy of the database.
///
/// The bundled resource sits in a read-only install location, but the database
/// is in WAL mode and needs to create `-wal`/`-shm` sidecars beside itself.
/// Copy it into the app config dir on first run, and again whenever the app
/// version changes so an upgrade picks up refreshed data. The returned path is
/// relative because the plugin resolves it against that same config dir.
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
    let version = app.package_info().version.to_string();
    let installed_version = fs::read_to_string(&stamp).unwrap_or_default();

    if !installed.exists() || installed_version.trim() != version {
        let source = bundled_db(&app)?;
        fs::copy(&source, &installed).map_err(|e| {
            format!("copying {} to {}: {e}", source.display(), installed.display())
        })?;
        // Sidecars from the previous version would otherwise shadow the new file.
        let _ = fs::remove_file(config_dir.join(format!("{DB_FILE}-wal")));
        let _ = fs::remove_file(config_dir.join(format!("{DB_FILE}-shm")));
        fs::write(&stamp, &version).map_err(|e| format!("writing {}: {e}", stamp.display()))?;
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
