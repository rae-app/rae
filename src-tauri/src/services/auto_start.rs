// Using println! for logging since tracing crate is not available

#[tauri::command]
pub async fn set_auto_start_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart_manager = app.autolaunch();
    if enabled {
        match autostart_manager.enable() {
            Ok(_) => {
                println!("Auto-start enabled successfully");
                Ok(())
            },
            Err(e) => {
                println!("Failed to enable auto-start: {}", e);
                Err(format!("Failed to enable auto-start: {}", e))
            },
        }
    } else {
        match autostart_manager.disable() {
            Ok(_) => {
                println!("Auto-start disabled successfully");
                Ok(())
            },
            Err(e) => {
                println!("Failed to disable auto-start: {}", e);
                Err(format!("Failed to disable auto-start: {}", e))
            },
        }
    }
}

#[tauri::command]
pub async fn get_auto_start_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart_manager = app.autolaunch();
    match autostart_manager.is_enabled() {
        Ok(enabled) => Ok(enabled),
        Err(e) => Err(format!("Failed to get auto-start status: {}", e)),
    }
}
