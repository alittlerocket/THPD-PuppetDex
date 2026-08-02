use std::path::PathBuf;

#[tauri::command]
fn db_connection_string() -> String {
    let db = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent().unwrap()
        .parent().unwrap()
        .join("data")
        .join("puppetdex.db");
    format!("sqlite:{}", db.display())
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
