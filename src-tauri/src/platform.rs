//! macOS-specific platform module for window management,
//! icon extraction, and screenshots.

#[path = "platform_macos.rs"]
pub mod platform_impl;

// Re-export platform-specific implementations with a common interface
pub use platform_impl::*;

// On macOS, we use u32 as the window identifier (CGWindowID)
pub type WindowHandle = platform_impl::WindowId;

// Common trait for platform-agnostic window operations
pub trait WindowOperations {
    fn get_title(&self) -> String;
    fn get_app_name(&self) -> String;
    fn get_icon_base64(&self) -> Option<String>;
}

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
pub fn window_handle_to_isize(handle: WindowHandle) -> isize {
    handle as isize
}

pub fn isize_to_window_handle(value: isize) -> WindowHandle {
    value as WindowHandle
}
