use crate::platform::{window_handle_to_isize, WindowHandle, WindowOperations};
use std::collections::HashMap;
use std::{thread, time::Duration};
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub fn start_window_watch(app: AppHandle) {
    thread::spawn(move || {
        let mut last_hwnd: Option<WindowHandle> = None;
        let mut icon_cache: HashMap<WindowHandle, (String, String)> = HashMap::new();

        loop {
            let current_hwnd = crate::platform::platform_impl::get_active_window_id();
            let hwnd_opt = current_hwnd;

            if let Some(hwnd) = hwnd_opt {
                if Some(hwnd) != last_hwnd {
                    last_hwnd = Some(hwnd);

                    // Check cache first
                    let (app_name, icon_data) = if let Some(cached) = icon_cache.get(&hwnd) {
                        cached.clone()
                    } else {
                        // Extract app name and icon using WindowOperations trait
                        let app_name = hwnd.get_app_name();
                        let title = hwnd.get_title();
                        let final_app_name = if !app_name.is_empty() {
                            app_name
                        } else {
                            title
                        };

                        let icon_data = hwnd
                            .get_icon_base64()
                            .map(|icon| format!("data:image/png;base64,{}", icon))
                            .unwrap_or_else(|| "".to_string());

                        // Cache the result
                        icon_cache.insert(hwnd, (final_app_name.clone(), icon_data.clone()));
                        (final_app_name, icon_data)
                    };

                    // Emit the active window changed event
                    let hwnd_isize = window_handle_to_isize(hwnd);
                    let _ = app.emit("active_window_changed", serde_json::json!({
                        "name": app_name,
                        "icon": icon_data,
                        "hwnd": hwnd_isize
                    }));
                }
            }

            thread::sleep(Duration::from_millis(100));
        }
    });
}