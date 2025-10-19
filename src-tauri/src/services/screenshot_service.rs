use crate::platform::WindowHandle;
use base64::{engine::general_purpose, Engine as _};
use image::{DynamicImage, ImageFormat};
use std::io;

#[tauri::command]
pub fn capture_window_screenshot() -> Result<String, String> {
    crate::platform::capture_full_screenshot()
}

#[tauri::command]
pub fn capture_window_screenshot_by_title(window_title: String) -> Result<String, String> {
    // Find window by title and capture it
    Err(format!(
        "Window screenshot by title not yet fully implemented on macOS for '{}'",
        window_title
    ))
}

#[tauri::command]
pub fn capture_window_screenshot_by_hwnd(hwnd: isize) -> Result<String, String> {
    let window_id = hwnd as WindowHandle;
    crate::platform::platform_impl::capture_window_screenshot_by_id(window_id)
}