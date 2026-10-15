use std::fs;
use std::io::Write;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

const VAULT_FILE: &str = "vault.json";

fn vault_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(VAULT_FILE))
}

/// Writes `contents` atomically: temp file + fsync + rename, keeping the previous version as `.bak`.
fn atomic_write(path: &PathBuf, contents: &str) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(contents.as_bytes()).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    if path.exists() {
        let _ = fs::copy(path, path.with_extension("json.bak"));
    }
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// Returns the encrypted vault blob, or `None` if no vault exists yet.
#[tauri::command]
fn vault_read(app: AppHandle) -> Result<Option<String>, String> {
    let path = vault_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_write(app: AppHandle, contents: String) -> Result<(), String> {
    // The frontend only ever sends encrypted blobs; refuse anything that isn't one.
    let v: serde_json::Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
    if v.get("v").is_none() || v.get("data").is_none() || v.get("iv").is_none() {
        return Err("refusing to write non-encrypted vault".into());
    }
    atomic_write(&vault_path(&app)?, &contents)
}

#[tauri::command]
fn vault_delete(app: AppHandle) -> Result<(), String> {
    let path = vault_path(&app)?;
    for p in [path.clone(), path.with_extension("json.bak")] {
        if p.exists() {
            fs::remove_file(p).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Shows a native "Save as" dialog and writes the file. Returns false if the user cancelled.
#[tauri::command]
async fn save_file(app: AppHandle, name: String, contents: String) -> Result<bool, String> {
    let picked = app.dialog().file().set_file_name(&name).blocking_save_file();
    match picked {
        Some(fp) => {
            let path = fp.into_path().map_err(|e| e.to_string())?;
            fs::write(path, contents).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![vault_read, vault_write, vault_delete, save_file])
        .run(tauri::generate_context!())
        .expect("error while running Kasa");
}
