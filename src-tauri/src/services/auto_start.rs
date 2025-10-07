use tracing::{info, warn, error};

#[tauri::command]
pub async fn set_auto_start_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart_manager = app.autolaunch();
    if enabled {
        match autostart_manager.enable() {
            Ok(_) => {
                info!("Auto-start enabled successfully");
                // Try to set up elevated privileges for Windows
                #[cfg(target_os = "windows")]
                {
                    if let Err(e) = setup_windows_elevated_startup(&app) {
                        warn!("Could not set up elevated startup: {}", e);
                        // Don't fail the whole operation, just warn
                    }
                }
                Ok(())
            },
            Err(e) => {
                error!("Failed to enable auto-start: {}", e);
                Err(format!("Failed to enable auto-start: {}", e))
            },
        }
    } else {
        match autostart_manager.disable() {
            Ok(_) => {
                info!("Auto-start disabled successfully");
                // Clean up elevated startup entry
                #[cfg(target_os = "windows")]
                {
                    if let Err(e) = cleanup_windows_elevated_startup() {
                        warn!("Could not clean up elevated startup: {}", e);
                    }
                }
                Ok(())
            },
            Err(e) => {
                error!("Failed to disable auto-start: {}", e);
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

#[cfg(target_os = "windows")]
fn setup_windows_elevated_startup(_app: &tauri::AppHandle) -> Result<(), String> {
    // Get the executable path
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .to_string_lossy()
        .to_string();

    // Create a scheduled task that runs as administrator
    // This requires Windows Task Scheduler
    let task_name = "RaeAutoStart";
    let command = format!("schtasks /create /tn \"{}\" /tr \"\\\"{}\\\"\" /sc onlogon /rl highest /f", task_name, exe_path);

    match std::process::Command::new("cmd")
        .args(&["/C", &command])
        .output() {
        Ok(output) => {
            if output.status.success() {
                info!("Elevated startup task created successfully");
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Failed to create elevated startup task: {}", stderr))
            }
        },
        Err(e) => Err(format!("Failed to run schtasks command: {}", e))
    }
}

#[cfg(target_os = "windows")]
fn cleanup_windows_elevated_startup() -> Result<(), String> {
    let task_name = "RaeAutoStart";
    let command = format!("schtasks /delete /tn \"{}\" /f", task_name);

    match std::process::Command::new("cmd")
        .args(&["/C", &command])
        .output() {
        Ok(output) => {
            if output.status.success() {
                info!("Elevated startup task removed successfully");
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                warn!("Failed to remove elevated startup task: {}", stderr);
                Ok(()) // Don't fail if cleanup fails
            }
        },
        Err(e) => {
            warn!("Failed to run schtasks delete command: {}", e);
            Ok(()) // Don't fail if cleanup fails
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn setup_windows_elevated_startup(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn cleanup_windows_elevated_startup() -> Result<(), String> {
    Ok(())
}
