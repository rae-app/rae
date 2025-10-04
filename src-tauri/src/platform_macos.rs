//! This module contains macOS-specific functionality using Core Graphics and Cocoa APIs.
//! It handles getting information about the active window, its process, and its icon.

use base64::{engine::general_purpose, Engine as _};
use cocoa::base::{id, nil};
use cocoa::foundation::NSAutoreleasePool;
use core_foundation::array::CFArrayRef;
use core_foundation::base::{CFIndex, TCFType};
use core_foundation::dictionary::CFDictionaryRef;
use core_foundation::number::{CFNumber, CFNumberRef};
use core_foundation::string::{CFString, CFStringRef};

use core_graphics::window::{
    kCGNullWindowID, kCGWindowListOptionOnScreenOnly, CGWindowListCopyWindowInfo,
};

use objc::{class, msg_send, sel, sel_impl};
use std::path::PathBuf;

// Type alias for window ID (similar to HWND on Windows)
pub type WindowId = u32;

/// Gets the active (frontmost) window ID
pub fn get_active_window_id() -> Option<WindowId> {
    unsafe {
        let window_list_info =
            CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID);

        if window_list_info.is_null() {
            return None;
        }

        let array_ref = window_list_info as CFArrayRef;
        let count = core_foundation::array::CFArrayGetCount(array_ref);

        if count > 0 {
            // Get the first window (frontmost)
            let window_dict_ref =
                core_foundation::array::CFArrayGetValueAtIndex(array_ref, 0) as CFDictionaryRef;

            // Try to get window number
            let key = CFString::from_static_string("kCGWindowNumber");
            let value_ptr = core_foundation::dictionary::CFDictionaryGetValue(
                window_dict_ref,
                key.as_concrete_TypeRef() as *const _,
            );

            if !value_ptr.is_null() {
                let window_number = CFNumber::wrap_under_get_rule(value_ptr as CFNumberRef);
                if let Some(wid) = window_number.to_i32() {
                    core_foundation::base::CFRelease(window_list_info as *const _);
                    return Some(wid as u32);
                }
            }
        }

        core_foundation::base::CFRelease(window_list_info as *const _);
        None
    }
}

/// Gets the window title from a window ID
pub fn get_window_title(window_id: WindowId) -> String {
    unsafe {
        let window_list_info =
            CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID);

        if window_list_info.is_null() {
            return String::new();
        }

        let array_ref = window_list_info as CFArrayRef;
        let count = core_foundation::array::CFArrayGetCount(array_ref);

        for i in 0..count {
            let window_dict_ref =
                core_foundation::array::CFArrayGetValueAtIndex(array_ref, i) as CFDictionaryRef;

            // Get window number
            let num_key = CFString::from_static_string("kCGWindowNumber");
            let num_value_ptr = core_foundation::dictionary::CFDictionaryGetValue(
                window_dict_ref,
                num_key.as_concrete_TypeRef() as *const _,
            );

            if !num_value_ptr.is_null() {
                let window_number = CFNumber::wrap_under_get_rule(num_value_ptr as CFNumberRef);
                if let Some(wid) = window_number.to_i32() {
                    if wid as u32 == window_id {
                        // Get window name
                        let name_key = CFString::from_static_string("kCGWindowName");
                        let name_value_ptr = core_foundation::dictionary::CFDictionaryGetValue(
                            window_dict_ref,
                            name_key.as_concrete_TypeRef() as *const _,
                        );

                        if !name_value_ptr.is_null() {
                            let name = CFString::wrap_under_get_rule(name_value_ptr as CFStringRef);
                            let result = name.to_string();
                            core_foundation::base::CFRelease(window_list_info as *const _);
                            return result;
                        }
                    }
                }
            }
        }

        core_foundation::base::CFRelease(window_list_info as *const _);
        String::new()
    }
}

/// Gets the process ID (PID) from a window ID
pub fn get_pid_from_window_id(window_id: WindowId) -> Option<i32> {
    unsafe {
        let window_list_info =
            CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID);

        if window_list_info.is_null() {
            return None;
        }

        let array_ref = window_list_info as CFArrayRef;
        let count = core_foundation::array::CFArrayGetCount(array_ref);

        for i in 0..count {
            let window_dict_ref =
                core_foundation::array::CFArrayGetValueAtIndex(array_ref, i) as CFDictionaryRef;

            // Get window number
            let num_key = CFString::from_static_string("kCGWindowNumber");
            let num_value_ptr = core_foundation::dictionary::CFDictionaryGetValue(
                window_dict_ref,
                num_key.as_concrete_TypeRef() as *const _,
            );

            if !num_value_ptr.is_null() {
                let window_number = CFNumber::wrap_under_get_rule(num_value_ptr as CFNumberRef);
                if let Some(wid) = window_number.to_i32() {
                    if wid as u32 == window_id {
                        // Get PID
                        let pid_key = CFString::from_static_string("kCGWindowOwnerPID");
                        let pid_value_ptr = core_foundation::dictionary::CFDictionaryGetValue(
                            window_dict_ref,
                            pid_key.as_concrete_TypeRef() as *const _,
                        );

                        if !pid_value_ptr.is_null() {
                            let pid = CFNumber::wrap_under_get_rule(pid_value_ptr as CFNumberRef);
                            let result = pid.to_i32();
                            core_foundation::base::CFRelease(window_list_info as *const _);
                            return result;
                        }
                    }
                }
            }
        }

        core_foundation::base::CFRelease(window_list_info as *const _);
        None
    }
}

/// Gets the application name from a window ID
pub fn get_app_name_from_window_id(window_id: WindowId) -> String {
    unsafe {
        let window_list_info =
            CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID);

        if window_list_info.is_null() {
            return String::new();
        }

        let array_ref = window_list_info as CFArrayRef;
        let count = core_foundation::array::CFArrayGetCount(array_ref);

        for i in 0..count {
            let window_dict_ref =
                core_foundation::array::CFArrayGetValueAtIndex(array_ref, i) as CFDictionaryRef;

            // Get window number
            let num_key = CFString::from_static_string("kCGWindowNumber");
            let num_value_ptr = core_foundation::dictionary::CFDictionaryGetValue(
                window_dict_ref,
                num_key.as_concrete_TypeRef() as *const _,
            );

            if !num_value_ptr.is_null() {
                let window_number = CFNumber::wrap_under_get_rule(num_value_ptr as CFNumberRef);
                if let Some(wid) = window_number.to_i32() {
                    if wid as u32 == window_id {
                        // Get owner name
                        let name_key = CFString::from_static_string("kCGWindowOwnerName");
                        let name_value_ptr = core_foundation::dictionary::CFDictionaryGetValue(
                            window_dict_ref,
                            name_key.as_concrete_TypeRef() as *const _,
                        );

                        if !name_value_ptr.is_null() {
                            let name = CFString::wrap_under_get_rule(name_value_ptr as CFStringRef);
                            let result = name.to_string();
                            core_foundation::base::CFRelease(window_list_info as *const _);
                            return result;
                        }
                    }
                }
            }
        }

        core_foundation::base::CFRelease(window_list_info as *const _);
        String::new()
    }
}

/// Gets the icon for a window and returns it as a Base64 encoded PNG
pub fn get_window_icon_base64_from_window_id(window_id: WindowId) -> Option<String> {
    let pid = get_pid_from_window_id(window_id)?;

    unsafe {
        let pool = NSAutoreleasePool::new(nil);

        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let running_apps: id = msg_send![workspace, runningApplications];
        let count: usize = msg_send![running_apps, count];

        for i in 0..count {
            let app: id = msg_send![running_apps, objectAtIndex: i];
            let app_pid: i32 = msg_send![app, processIdentifier];

            if app_pid == pid {
                let icon: id = msg_send![app, icon];

                if icon != nil {
                    // Convert NSImage to PNG data
                    let tiff_rep: id = msg_send![icon, TIFFRepresentation];
                    if tiff_rep != nil {
                        let bitmap_rep_class = class!(NSBitmapImageRep);
                        let bitmap_rep: id =
                            msg_send![bitmap_rep_class, imageRepWithData: tiff_rep];
                        if bitmap_rep != nil {
                            let png_file_type: u64 = 4;
                            let png_data: id = msg_send![bitmap_rep, representationUsingType:png_file_type properties:nil];
                            if png_data != nil {
                                let length: usize = msg_send![png_data, length];
                                let bytes: *const u8 = msg_send![png_data, bytes];
                                let data_slice = std::slice::from_raw_parts(bytes, length);

                                let base64_string = general_purpose::STANDARD.encode(data_slice);

                                let _: () = msg_send![pool, drain];
                                return Some(base64_string);
                            }
                        }
                    }
                }
                break;
            }
        }

        let _: () = msg_send![pool, drain];
        None
    }
}

/// Placeholder for packaged app icon retrieval (macOS apps are already packaged)
pub fn get_packaged_app_icon_from_window_id(window_id: WindowId) -> Option<String> {
    // On macOS, all apps are bundled, so we use the same method
    get_window_icon_base64_from_window_id(window_id)
}

/// Captures a screenshot of a specific window by window ID
pub fn capture_window_screenshot_by_id(window_id: WindowId) -> Result<String, String> {
    use xcap::Window;

    // Get all windows
    let windows = Window::all().map_err(|e| format!("Failed to get windows: {}", e))?;

    // Find the window with matching ID
    for window in windows {
        // xcap uses different window IDs, we need to match by other properties
        // For now, we'll try to match by title
        let title = get_window_title(window_id);
        if !title.is_empty() {
            let window_title = window.title();
            if window_title == title {
                if window.is_minimized() {
                    return Err("Window is minimized".to_string());
                }

                let image = window
                    .capture_image()
                    .map_err(|e| format!("Failed to capture window: {}", e))?;

                let mut png_bytes = Vec::new();
                image
                    .write_to(
                        &mut std::io::Cursor::new(&mut png_bytes),
                        xcap::image::ImageFormat::Png,
                    )
                    .map_err(|e| format!("Failed to encode PNG: {}", e))?;

                let base64_data = general_purpose::STANDARD.encode(&png_bytes);
                return Ok(format!("data:image/png;base64,{}", base64_data));
            }
        }
    }

    Err(format!("Window with ID {} not found", window_id))
}

/// Captures a full screenshot of the primary display
pub fn capture_full_screenshot() -> Result<String, String> {
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    // Get primary monitor
    let monitor = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .ok_or_else(|| "No primary monitor found".to_string())?;

    let image = monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture screen: {}", e))?;

    let mut png_bytes = Vec::new();
    image
        .write_to(
            &mut std::io::Cursor::new(&mut png_bytes),
            xcap::image::ImageFormat::Png,
        )
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    let base64_data = general_purpose::STANDARD.encode(&png_bytes);
    Ok(format!("data:image/png;base64,{}", base64_data))
}

/// Gets the icon for an application by path and returns it as a Base64 encoded PNG
pub fn get_icon_base64_from_path(path: &PathBuf) -> Option<String> {
    unsafe {
        let pool = NSAutoreleasePool::new(nil);

        let path_str = path.to_str()?;
        let ns_string: id =
            msg_send![class!(NSString), stringWithUTF8String: path_str.as_ptr() as *const i8];

        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let icon: id = msg_send![workspace, iconForFile: ns_string];

        if icon != nil {
            // Convert NSImage to PNG data
            let tiff_rep: id = msg_send![icon, TIFFRepresentation];
            if tiff_rep != nil {
                let bitmap_rep_class = class!(NSBitmapImageRep);
                let bitmap_rep: id = msg_send![bitmap_rep_class, imageRepWithData: tiff_rep];
                if bitmap_rep != nil {
                    let png_file_type: u64 = 4;
                    let png_data: id =
                        msg_send![bitmap_rep, representationUsingType:png_file_type properties:nil];
                    if png_data != nil {
                        let length: usize = msg_send![png_data, length];
                        let bytes: *const u8 = msg_send![png_data, bytes];
                        let data_slice = std::slice::from_raw_parts(bytes, length);

                        let base64_string = general_purpose::STANDARD.encode(data_slice);

                        let _: () = msg_send![pool, drain];
                        return Some(base64_string);
                    }
                }
            }
        }

        let _: () = msg_send![pool, drain];
        None
    }
}
