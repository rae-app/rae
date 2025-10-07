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
            eprintln!("[macOS] Failed to get window list");
            return None;
        }

        let array_ref = window_list_info as CFArrayRef;
        let count = core_foundation::array::CFArrayGetCount(array_ref);

        // List of system processes to ignore
        let ignored_apps = [
            "Dock", "DockHelper", "Window Server", "SystemUIServer", 
            "ControlCenter", "Spotlight", "NotificationCenter", "Screenshot",
            "loginwindow", "screencapture", "Control Center",
        ];

        println!("[macOS] Scanning {} windows for active window...", count);

        for i in 0..count {
            let window_dict_ref =
                core_foundation::array::CFArrayGetValueAtIndex(array_ref, i) as CFDictionaryRef;

            // Get window number first for debugging
            let key = CFString::from_static_string("kCGWindowNumber");
            let value_ptr = core_foundation::dictionary::CFDictionaryGetValue(
                window_dict_ref,
                key.as_concrete_TypeRef() as *const _,
            );

            let window_id_debug = if !value_ptr.is_null() {
                let window_number = CFNumber::wrap_under_get_rule(value_ptr as CFNumberRef);
                window_number.to_i32().unwrap_or(-1)
            } else {
                -1
            };

            // Get window owner name to filter system windows
            let owner_key = CFString::from_static_string("kCGWindowOwnerName");
            let owner_value_ptr = core_foundation::dictionary::CFDictionaryGetValue(
                window_dict_ref,
                owner_key.as_concrete_TypeRef() as *const _,
            );

            let owner_str = if !owner_value_ptr.is_null() {
                let owner = CFString::wrap_under_get_rule(owner_value_ptr as CFStringRef);
                owner.to_string()
            } else {
                String::new()
            };

            // Get window name for debugging
            let name_key = CFString::from_static_string("kCGWindowName");
            let name_value_ptr = core_foundation::dictionary::CFDictionaryGetValue(
                window_dict_ref,
                name_key.as_concrete_TypeRef() as *const _,
            );

            let window_name = if !name_value_ptr.is_null() {
                let name = CFString::wrap_under_get_rule(name_value_ptr as CFStringRef);
                name.to_string()
            } else {
                String::new()
            };

            // Get window layer
            let layer_key = CFString::from_static_string("kCGWindowLayer");
            let layer_value_ptr = core_foundation::dictionary::CFDictionaryGetValue(
                window_dict_ref,
                layer_key.as_concrete_TypeRef() as *const _,
            );

            let layer_num = if !layer_value_ptr.is_null() {
                let layer = CFNumber::wrap_under_get_rule(layer_value_ptr as CFNumberRef);
                layer.to_i32().unwrap_or(-1)
            } else {
                -1
            };

            println!("[macOS]   Window {}: ID={}, Owner='{}', Name='{}', Layer={}", 
                i, window_id_debug, owner_str, window_name, layer_num);

            // Skip system/ignored windows
            if !owner_str.is_empty() && ignored_apps.iter().any(|&app| owner_str == app) {
                println!("[macOS]     → Skipped (system app)");
                continue;
            }

            // Only get windows at normal layer (0)
            if layer_num != 0 {
                println!("[macOS]     → Skipped (layer {})", layer_num);
                continue;
            }

            // Must have a valid owner name (not empty)
            if owner_str.is_empty() {
                println!("[macOS]     → Skipped (no owner)");
                continue;
            }

            // Get window number
            if !value_ptr.is_null() {
                let window_number = CFNumber::wrap_under_get_rule(value_ptr as CFNumberRef);
                if let Some(wid) = window_number.to_i32() {
                    core_foundation::base::CFRelease(window_list_info as *const _);
                    println!("[macOS] ✓ Active window found: ID={}, Owner='{}', Name='{}'", wid, owner_str, window_name);
                    return Some(wid as u32);
                }
            }
        }

        core_foundation::base::CFRelease(window_list_info as *const _);
        eprintln!("[macOS] No active window found (all windows filtered)");
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
    let pid = get_pid_from_window_id(window_id);
    
    if pid.is_none() {
        eprintln!("[macOS] Cannot get icon: no PID for window {}", window_id);
        return None;
    }
    
    let pid = pid.unwrap();
    let app_name = get_app_name_from_window_id(window_id);
    
    println!("[macOS] Getting icon for window {} (PID: {}, app: '{}')", window_id, pid, app_name);

    unsafe {
        let pool = NSAutoreleasePool::new(nil);

        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let running_apps: id = msg_send![workspace, runningApplications];
        let count: usize = msg_send![running_apps, count];

        println!("[macOS] Searching through {} running apps for PID {}", count, pid);

        for i in 0..count {
            let app: id = msg_send![running_apps, objectAtIndex: i];
            let app_pid: i32 = msg_send![app, processIdentifier];

            if app_pid == pid {
                println!("[macOS] ✓ Found matching app for PID {}", pid);
                
                // Get app bundle path for debugging
                let bundle_url: id = msg_send![app, bundleURL];
                if bundle_url != nil {
                    let path: id = msg_send![bundle_url, path];
                    if path != nil {
                        let path_ptr: *const i8 = msg_send![path, UTF8String];
                        if !path_ptr.is_null() {
                            let path_str = std::ffi::CStr::from_ptr(path_ptr).to_string_lossy();
                            println!("[macOS] App bundle path: {}", path_str);
                        }
                    }
                }
                
                let icon: id = msg_send![app, icon];

                if icon != nil {
                    println!("[macOS] Icon object obtained, converting to PNG...");
                    
                    // Set icon size for better quality (64x64 for better visibility)
                    let size = cocoa::foundation::NSSize {
                        width: 64.0,
                        height: 64.0,
                    };
                    let _: () = msg_send![icon, setSize: size];

                    // Convert NSImage to PNG data
                    let tiff_rep: id = msg_send![icon, TIFFRepresentation];
                    if tiff_rep != nil {
                        let bitmap_rep_class = class!(NSBitmapImageRep);
                        let bitmap_rep: id =
                            msg_send![bitmap_rep_class, imageRepWithData: tiff_rep];
                        if bitmap_rep != nil {
                            let png_file_type: u64 = 4; // NSBitmapImageFileTypePNG
                            let png_data: id = msg_send![bitmap_rep, representationUsingType:png_file_type properties:nil];
                            if png_data != nil {
                                let length: usize = msg_send![png_data, length];
                                let bytes: *const u8 = msg_send![png_data, bytes];
                                
                                if length > 0 && !bytes.is_null() {
                                    let data_slice = std::slice::from_raw_parts(bytes, length);
                                    let base64_string = general_purpose::STANDARD.encode(data_slice);

                                    println!("[macOS] ✓ Icon successfully extracted ({} bytes, {} base64 chars)", length, base64_string.len());
                                    let _: () = msg_send![pool, drain];
                                    return Some(base64_string);
                                } else {
                                    eprintln!("[macOS] Icon PNG data is empty for window {}", window_id);
                                }
                            } else {
                                eprintln!("[macOS] Failed to convert icon to PNG for window {}", window_id);
                            }
                        } else {
                            eprintln!("[macOS] Failed to create bitmap representation for window {}", window_id);
                        }
                    } else {
                        eprintln!("[macOS] Failed to get TIFF representation for window {}", window_id);
                    }
                } else {
                    eprintln!("[macOS] Icon is nil for window {} (PID: {})", window_id, pid);
                }
                break;
            }
        }

        let _: () = msg_send![pool, drain];
        eprintln!("[macOS] ✗ Could not find app for window {} (PID: {})", window_id, pid);
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

    // Get window info for matching
    let title = get_window_title(window_id);
    let app_name = get_app_name_from_window_id(window_id);
    let pid = get_pid_from_window_id(window_id).ok_or_else(|| {
        eprintln!("[macOS] Could not get PID for window {}", window_id);
        format!("Could not get PID for window {}", window_id)
    })?;

    println!("[macOS] Attempting to capture window {} (title: '{}', app: '{}', pid: {})", window_id, title, app_name, pid);

    // Get all windows
    let windows = Window::all().map_err(|e| {
        eprintln!("[macOS] Failed to get windows: {}", e);
        format!("Failed to get windows: {}", e)
    })?;

    println!("[macOS] Found {} windows via xcap", windows.len());

    // Try to find the best matching window using multiple criteria
    let mut best_match: Option<&Window> = None;
    let mut best_score = 0;

    for window in &windows {
        let mut score = 0;
        
        // Skip minimized windows
        if window.is_minimized() {
            continue;
        }

        let window_title = window.title();
        let window_app_name = window.app_name();
        let xcap_id = window.id();
        
        println!("[macOS] Checking xcap window: ID={}, app='{}', title='{}'", xcap_id, window_app_name, window_title);
        
        // Match by exact window ID if xcap exposes it (on macOS, xcap uses CGWindowID directly)
        // On macOS, xcap::Window::id() returns the CGWindowID
        if xcap_id == window_id {
            // Perfect match - use this window
            println!("[macOS] ✓ Perfect match found: window ID {} matches", window_id);
            best_match = Some(window);
            break;
        }
        
        // Match by app name (high priority)
        if !app_name.is_empty() && window_app_name == app_name {
            score += 100; // Increased priority
            println!("[macOS]   App name matches: +100");
        }
        
        // Match by title (medium priority)
        if !title.is_empty() && window_title == title {
            score += 50;
            println!("[macOS]   Title matches: +50");
        }
        
        // Match by partial title (lower priority)
        if !title.is_empty() && !window_title.is_empty() && window_title.contains(&title) {
            score += 25;
            println!("[macOS]   Partial title match: +25");
        }
        
        // Partial app name match (very low priority)
        if !app_name.is_empty() && !window_app_name.is_empty() && window_app_name.contains(&app_name) {
            score += 10;
            println!("[macOS]   Partial app name match: +10");
        }
        
        // Update best match if this window has a higher score
        if score > best_score {
            best_score = score;
            best_match = Some(window);
            println!("[macOS] → New best match: '{}' / '{}' (total score: {})", window_app_name, window_title, score);
        }
    }

    // Use the best match if found
    if let Some(window) = best_match {
        if window.is_minimized() {
            eprintln!("[macOS] Matched window is minimized");
            return Err("Window is minimized".to_string());
        }

        println!("[macOS] Capturing screenshot of window: '{}' / '{}'", window.app_name(), window.title());

        let image = window
            .capture_image()
            .map_err(|e| {
                eprintln!("[macOS] Failed to capture window: {}", e);
                format!("Failed to capture window: {}", e)
            })?;

        let mut png_bytes = Vec::new();
        image
            .write_to(
                &mut std::io::Cursor::new(&mut png_bytes),
                xcap::image::ImageFormat::Png,
            )
            .map_err(|e| {
                eprintln!("[macOS] Failed to encode PNG: {}", e);
                format!("Failed to encode PNG: {}", e)
            })?;

        println!("[macOS] Screenshot captured successfully, size: {} bytes", png_bytes.len());

        let base64_data = general_purpose::STANDARD.encode(&png_bytes);
        return Ok(format!("data:image/png;base64,{}", base64_data));
    }

    eprintln!("[macOS] No matching window found for ID {}", window_id);
    Err(format!("Window with ID {} not found (title: '{}', app: '{}')", window_id, title, app_name))
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
            // Set icon size for better quality (32x32 is standard)
            let size = cocoa::foundation::NSSize {
                width: 32.0,
                height: 32.0,
            };
            let _: () = msg_send![icon, setSize: size];

            // Convert NSImage to PNG data
            let tiff_rep: id = msg_send![icon, TIFFRepresentation];
            if tiff_rep != nil {
                let bitmap_rep_class = class!(NSBitmapImageRep);
                let bitmap_rep: id = msg_send![bitmap_rep_class, imageRepWithData: tiff_rep];
                if bitmap_rep != nil {
                    let png_file_type: u64 = 4; // NSBitmapImageFileTypePNG
                    let png_data: id =
                        msg_send![bitmap_rep, representationUsingType:png_file_type properties:nil];
                    if png_data != nil {
                        let length: usize = msg_send![png_data, length];
                        let bytes: *const u8 = msg_send![png_data, bytes];
                        
                        if length > 0 && !bytes.is_null() {
                            let data_slice = std::slice::from_raw_parts(bytes, length);
                            let base64_string = general_purpose::STANDARD.encode(data_slice);

                            let _: () = msg_send![pool, drain];
                            return Some(base64_string);
                        }
                    }
                }
            }
        }

        let _: () = msg_send![pool, drain];
        None
    }
}
