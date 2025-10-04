//! Unified platform module that provides cross-platform APIs for window management,
//! icon extraction, and screenshots. The actual implementation is platform-specific.

#[cfg(target_os = "windows")]
#[path = "platform_windows.rs"]
pub mod platform_impl;

#[cfg(target_os = "macos")]
#[path = "platform_macos.rs"]
pub mod platform_impl;

// Re-export platform-specific implementations with a common interface
pub use platform_impl::*;

// On Windows, HWND is the window identifier
#[cfg(target_os = "windows")]
pub type WindowHandle = winapi::shared::windef::HWND;

// On macOS, we use u32 as the window identifier (CGWindowID)
#[cfg(target_os = "macos")]
pub type WindowHandle = platform_impl::WindowId;

// Common trait for platform-agnostic window operations
pub trait WindowOperations {
    fn get_title(&self) -> String;
    fn get_app_name(&self) -> String;
    fn get_icon_base64(&self) -> Option<String>;
}

#[cfg(target_os = "windows")]
impl WindowOperations for WindowHandle {
    fn get_title(&self) -> String {
        platform_windows::get_window_title(*self)
    }

    fn get_app_name(&self) -> String {
        // On Windows, get app name from exe path
        platform_windows::exe_path_from_hwnd(*self)
            .and_then(|p| {
                p.file_stem()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_default()
    }

    fn get_icon_base64(&self) -> Option<String> {
        platform_windows::get_window_icon_base64_from_hwnd(*self)
            .or_else(|| platform_windows::get_packaged_app_icon_from_hwnd(*self))
            .or_else(|| {
                platform_windows::exe_path_from_hwnd(*self)
                    .and_then(|p| platform_windows::get_icon_base64_from_exe(&p))
            })
    }
}

#[cfg(target_os = "macos")]
impl WindowOperations for WindowHandle {
    fn get_title(&self) -> String {
        platform_impl::get_window_title(*self)
    }

    fn get_app_name(&self) -> String {
        platform_impl::get_app_name_from_window_id(*self)
    }

    fn get_icon_base64(&self) -> Option<String> {
        platform_impl::get_window_icon_base64_from_window_id(*self)
            .or_else(|| platform_impl::get_packaged_app_icon_from_window_id(*self))
    }
}

// Helper function to convert platform-specific handle to generic representation
#[cfg(target_os = "windows")]
pub fn window_handle_to_isize(handle: WindowHandle) -> isize {
    handle as isize
}

#[cfg(target_os = "macos")]
pub fn window_handle_to_isize(handle: WindowHandle) -> isize {
    handle as isize
}

#[cfg(target_os = "windows")]
pub fn isize_to_window_handle(value: isize) -> WindowHandle {
    value as WindowHandle
}

#[cfg(target_os = "macos")]
pub fn isize_to_window_handle(value: isize) -> WindowHandle {
    value as WindowHandle
}
