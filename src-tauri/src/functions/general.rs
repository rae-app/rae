use crate::platform::{
    exe_path_from_hwnd, get_icon_base64_from_exe, get_packaged_app_icon_from_hwnd,
    get_window_icon_base64_from_hwnd, get_window_title,
};
use base64::{Engine as _, engine::general_purpose};
use image::{DynamicImage, ImageFormat};
use std::collections::HashMap;
use std::io;
use std::os::windows::ffi::OsStrExt;
use std::{thread, time::Duration};
use tauri::{AppHandle, Emitter};
use tracing::{info, warn, error};
use winapi::ctypes::c_void;
use winapi::shared::windef::HWND as WinHWND;
use winapi::shared::windef::RECT;
use winapi::um::wingdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits,
    SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY,
};
use winapi::um::winuser::{
    FindWindowW, GetDC, GetSystemMetrics, GetWindowRect, PrintWindow, ReleaseDC, SM_CXSCREEN, SM_CYSCREEN,
    GetForegroundWindow,
};

#[tauri::command]
pub fn start_window_watch(app: AppHandle) {
    thread::spawn(move || {
        let mut last_hwnd: Option<WinHWND> = None;
        let mut icon_cache: HashMap<WinHWND, (String, String)> = HashMap::new();

        loop {
            unsafe {
                let hwnd = GetForegroundWindow();
                if !hwnd.is_null() && Some(hwnd) != last_hwnd {
                    last_hwnd = Some(hwnd);

                    // Check cache first
                    let (app_name, icon_data) = if let Some(cached) = icon_cache.get(&hwnd) {
                        cached.clone()
                    } else {
                        // Extract app name
                        let mut app_name = get_window_title(hwnd);
                        if app_name.is_empty() {
                            if let Some(exe_path) = exe_path_from_hwnd(hwnd) {
                                app_name = exe_path
                                    .file_stem()
                                    .and_then(|s| s.to_str())
                                    .unwrap_or("")
                                    .to_string();
                            }
                        }

                        // Extract icon (try fastest method first)
                        let icon_base64 = get_window_icon_base64_from_hwnd(hwnd)
                            .or_else(|| get_packaged_app_icon_from_hwnd(hwnd));

                        let icon_data = if let Some(icon) = icon_base64 {
                            format!("data:image/png;base64,{}", icon)
                        } else {
                            // Fallback to exe icon if needed, but cache it
                            exe_path_from_hwnd(hwnd)
                                .and_then(|p| get_icon_base64_from_exe(&p))
                                .map(|icon| format!("data:image/png;base64,{}", icon))
                                .unwrap_or_else(|| "".to_string())
                        };

                        // Cache the result
                        let result = (app_name.clone(), icon_data.clone());
                        icon_cache.insert(hwnd, result.clone());
                        result
                    };

                    // Only emit if we have valid data
                    if !app_name.is_empty() {
                        let _ = app.emit(
                            "active_window_changed",
                            serde_json::json!({
                                "name": app_name,
                                "icon": icon_data,
                                "hwnd": hwnd as isize,
                            }),
                        );
                    }
                }
            }
            thread::sleep(Duration::from_millis(50)); // Faster polling
        }
    });
}


#[derive(serde::Serialize)]
pub struct WindowInfo {
    pub hwnd: isize,
    pub title: String,
}

#[tauri::command]
pub fn capture_window_screenshot() -> Result<String, String> {
    unsafe {
        // Get screen dimensions
        let screen_width = GetSystemMetrics(SM_CXSCREEN);
        let screen_height = GetSystemMetrics(SM_CYSCREEN);

        if screen_width <= 0 || screen_height <= 0 {
            return Err("Invalid screen dimensions".to_string());
        }

        // Get screen DC
        let screen_dc = GetDC(std::ptr::null_mut());
        if screen_dc.is_null() {
            return Err("Failed to get screen DC".to_string());
        }

        // Create memory DC
        let memory_dc = CreateCompatibleDC(screen_dc);
        if memory_dc.is_null() {
            ReleaseDC(std::ptr::null_mut(), screen_dc);
            return Err("Failed to create memory DC".to_string());
        }

        // Create bitmap
        let bitmap = CreateCompatibleBitmap(screen_dc, screen_width, screen_height);
        if bitmap.is_null() {
            DeleteDC(memory_dc);
            ReleaseDC(std::ptr::null_mut(), screen_dc);
            return Err("Failed to create bitmap".to_string());
        }

        let old_bitmap = SelectObject(memory_dc, bitmap as *mut c_void);

        // Copy screen to bitmap
        if BitBlt(
            memory_dc,
            0,
            0,
            screen_width,
            screen_height,
            screen_dc,
            0,
            0,
            SRCCOPY,
        ) == 0
        {
            SelectObject(memory_dc, old_bitmap);
            DeleteObject(bitmap as *mut c_void);
            DeleteDC(memory_dc);
            ReleaseDC(std::ptr::null_mut(), screen_dc);
            return Err("Failed to capture screen".to_string());
        }

        // Get bitmap data
        let mut bitmap_info: BITMAPINFO = std::mem::zeroed();
        bitmap_info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bitmap_info.bmiHeader.biWidth = screen_width;
        bitmap_info.bmiHeader.biHeight = -screen_height; // Negative for top-down
        bitmap_info.bmiHeader.biPlanes = 1;
        bitmap_info.bmiHeader.biBitCount = 32;
        bitmap_info.bmiHeader.biCompression = BI_RGB;

        let bitmap_size = (screen_width * screen_height * 4) as usize;
        let mut buffer: Vec<u8> = vec![0; bitmap_size];

        if GetDIBits(
            memory_dc,
            bitmap,
            0,
            screen_height as u32,
            buffer.as_mut_ptr() as *mut c_void,
            &mut bitmap_info,
            DIB_RGB_COLORS,
        ) == 0
        {
            SelectObject(memory_dc, old_bitmap);
            DeleteObject(bitmap as *mut c_void);
            DeleteDC(memory_dc);
            ReleaseDC(std::ptr::null_mut(), screen_dc);
            return Err("Failed to get bitmap data".to_string());
        }

        // Convert BGRA to RGBA
        for chunk in buffer.chunks_exact_mut(4) {
            let b = chunk[0];
            let g = chunk[1];
            let r = chunk[2];
            let a = chunk[3];
            chunk[0] = r;
            chunk[1] = g;
            chunk[2] = b;
            chunk[3] = a;
        }

        // Create image
        let img =
            match image::RgbaImage::from_raw(screen_width as u32, screen_height as u32, buffer) {
                Some(img) => img,
                None => {
                    SelectObject(memory_dc, old_bitmap);
                    DeleteObject(bitmap as *mut c_void);
                    DeleteDC(memory_dc);
                    ReleaseDC(std::ptr::null_mut(), screen_dc);
                    return Err("Failed to create image".to_string());
                }
            };

        // Convert to PNG
        let dynamic_img = DynamicImage::ImageRgba8(img);
        let mut png_data = Vec::new();
        if dynamic_img
            .write_to(&mut io::Cursor::new(&mut png_data), ImageFormat::Png)
            .is_err()
        {
            SelectObject(memory_dc, old_bitmap);
            DeleteObject(bitmap as *mut c_void);
            DeleteDC(memory_dc);
            ReleaseDC(std::ptr::null_mut(), screen_dc);
            return Err("Failed to encode PNG".to_string());
        }

        // Cleanup
        SelectObject(memory_dc, old_bitmap);
        DeleteObject(bitmap as *mut c_void);
        DeleteDC(memory_dc);
        ReleaseDC(std::ptr::null_mut(), screen_dc);

        let base64_data = general_purpose::STANDARD.encode(&png_data);
        Ok(format!("data:image/png;base64,{}", base64_data))
    }
}

fn capture_hwnd_to_png_base64(hwnd: WinHWND) -> Result<String, String> {
    unsafe {
        let mut window_rect: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut window_rect) == 0 {
            return Err("Failed to get window rectangle".to_string());
        }

        let width = (window_rect.right - window_rect.left).max(0);
        let height = (window_rect.bottom - window_rect.top).max(0);
        if width == 0 || height == 0 {
            return Err("Invalid window dimensions".to_string());
        }

        let window_dc = GetDC(hwnd);
        if window_dc.is_null() {
            return Err("Failed to get window DC".to_string());
        }

        let memory_dc = CreateCompatibleDC(window_dc);
        if memory_dc.is_null() {
            ReleaseDC(hwnd, window_dc);
            return Err("Failed to create memory DC".to_string());
        }

        let bitmap = CreateCompatibleBitmap(window_dc, width, height);
        if bitmap.is_null() {
            DeleteDC(memory_dc);
            ReleaseDC(hwnd, window_dc);
            return Err("Failed to create compatible bitmap".to_string());
        }

        let old_bitmap = SelectObject(memory_dc, bitmap as *mut c_void);

        // Try PrintWindow with full-content first (more robust for occluded/UWP windows)
        let mut pw_ok = PrintWindow(hwnd, memory_dc, 2);
        if pw_ok == 0 {
            // Fallback to default flags
            pw_ok = PrintWindow(hwnd, memory_dc, 0);
        }
        if pw_ok == 0 {
            // Fallback to BitBlt from window DC
            if BitBlt(memory_dc, 0, 0, width, height, window_dc, 0, 0, SRCCOPY) == 0 {
                SelectObject(memory_dc, old_bitmap);
                DeleteObject(bitmap as *mut c_void);
                DeleteDC(memory_dc);
                ReleaseDC(hwnd, window_dc);
                return Err("Failed to capture window content".to_string());
            }
        }

        // Prepare to extract bitmap bits
        let mut bitmap_info: BITMAPINFO = std::mem::zeroed();
        bitmap_info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bitmap_info.bmiHeader.biWidth = width;
        bitmap_info.bmiHeader.biHeight = -height; // top-down
        bitmap_info.bmiHeader.biPlanes = 1;
        bitmap_info.bmiHeader.biBitCount = 32; // BGRA
        bitmap_info.bmiHeader.biCompression = BI_RGB;

        let bitmap_size = (width * height * 4) as usize;
        let mut buffer: Vec<u8> = vec![0; bitmap_size];
        if GetDIBits(
            memory_dc,
            bitmap,
            0,
            height as u32,
            buffer.as_mut_ptr() as *mut c_void,
            &mut bitmap_info,
            DIB_RGB_COLORS,
        ) == 0
        {
            SelectObject(memory_dc, old_bitmap);
            DeleteObject(bitmap as *mut c_void);
            DeleteDC(memory_dc);
            ReleaseDC(hwnd, window_dc);
            return Err("Failed to get bitmap data".to_string());
        }

        // Convert BGRA -> RGBA
        for chunk in buffer.chunks_exact_mut(4) {
            let b = chunk[0];
            let g = chunk[1];
            let r = chunk[2];
            let a = chunk[3];
            chunk[0] = r;
            chunk[1] = g;
            chunk[2] = b;
            chunk[3] = a;
        }

        let img = match image::RgbaImage::from_raw(width as u32, height as u32, buffer) {
            Some(img) => img,
            None => {
                SelectObject(memory_dc, old_bitmap);
                DeleteObject(bitmap as *mut c_void);
                DeleteDC(memory_dc);
                ReleaseDC(hwnd, window_dc);
                return Err("Failed to create image".to_string());
            }
        };

        let dynamic_img = DynamicImage::ImageRgba8(img);
        let mut png_data = Vec::new();
        if dynamic_img
            .write_to(&mut io::Cursor::new(&mut png_data), ImageFormat::Png)
            .is_err()
        {
            SelectObject(memory_dc, old_bitmap);
            DeleteObject(bitmap as *mut c_void);
            DeleteDC(memory_dc);
            ReleaseDC(hwnd, window_dc);
            return Err("Failed to encode PNG".to_string());
        }

        // Cleanup
        SelectObject(memory_dc, old_bitmap);
        DeleteObject(bitmap as *mut c_void);
        DeleteDC(memory_dc);
        ReleaseDC(hwnd, window_dc);

        let base64_data = general_purpose::STANDARD.encode(&png_data);
        Ok(format!("data:image/png;base64,{}", base64_data))
    }
}

#[tauri::command]
pub fn capture_window_screenshot_by_title(window_title: String) -> Result<String, String> {
    unsafe {
        let wide_title: Vec<u16> = std::ffi::OsStr::new(&window_title)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let hwnd = FindWindowW(std::ptr::null(), wide_title.as_ptr());
        if hwnd.is_null() {
            return Err(format!("Window '{}' not found", window_title));
        }

        capture_hwnd_to_png_base64(hwnd)
    }
}

#[tauri::command]
pub fn capture_window_screenshot_by_hwnd(hwnd: isize) -> Result<String, String> {
    let hwnd_ptr = hwnd as WinHWND;
    if hwnd_ptr.is_null() {
        return Err("Invalid HWND".to_string());
    }
    capture_hwnd_to_png_base64(hwnd_ptr)
}

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

#[tauri::command]
pub async fn get_auto_start_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart_manager = app.autolaunch();
    match autostart_manager.is_enabled() {
        Ok(enabled) => Ok(enabled),
        Err(e) => Err(format!("Failed to get auto-start status: {}", e)),
    }
}