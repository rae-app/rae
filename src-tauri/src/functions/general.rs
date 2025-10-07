use crate::platform::{window_handle_to_isize, WindowHandle, WindowOperations};
use base64::{engine::general_purpose, Engine as _};
use image::{DynamicImage, ImageFormat};
use std::collections::HashMap;
use std::io;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
use std::{thread, time::Duration};
use tauri::{AppHandle, Emitter};
#[cfg(target_os = "windows")]
use winapi::ctypes::c_void;
#[cfg(target_os = "windows")]
use winapi::shared::windef::RECT;
#[cfg(target_os = "windows")]
use winapi::um::winbase::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
#[cfg(target_os = "windows")]
use winapi::um::wingdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits,
    SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY,
};
#[cfg(target_os = "windows")]
use winapi::um::winuser::{
    CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData, CF_UNICODETEXT,
};
#[cfg(target_os = "windows")]
use winapi::um::winuser::{FindWindowW, SetForegroundWindow};
#[cfg(target_os = "windows")]
use winapi::um::winuser::{
    GetDC, GetSystemMetrics, GetWindowRect, PrintWindow, ReleaseDC, SM_CXSCREEN, SM_CYSCREEN,
};
#[cfg(target_os = "windows")]
use winapi::um::winuser::{
    GetForegroundWindow, SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_CONTROL,
};

#[cfg(target_os = "macos")]
use cocoa::appkit::NSPasteboard;
#[cfg(target_os = "macos")]
use cocoa::base::{id, nil};
#[cfg(target_os = "macos")]
use core_graphics::event::{CGEvent, CGEventTapLocation, CGEventType, CGKeyCode};
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
#[cfg(target_os = "macos")]
use objc::{class, msg_send, sel, sel_impl};

use std::ffi::OsStr;

// VK_V constant (not defined in winapi crate)
#[cfg(target_os = "windows")]
const VK_V: u16 = 0x56;

#[tauri::command]
pub fn start_window_watch(app: AppHandle) {
    thread::spawn(move || {
        let mut last_hwnd: Option<WindowHandle> = None;
        let mut icon_cache: HashMap<WindowHandle, (String, String)> = HashMap::new();

        loop {
            #[cfg(target_os = "windows")]
            let current_hwnd = unsafe { GetForegroundWindow() };

            #[cfg(target_os = "macos")]
            let current_hwnd = crate::platform::platform_impl::get_active_window_id();

            #[cfg(target_os = "windows")]
            let is_valid = !current_hwnd.is_null();

            #[cfg(target_os = "windows")]
            let hwnd_opt = if is_valid { Some(current_hwnd) } else { None };

            #[cfg(target_os = "macos")]
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
                        let result = (final_app_name.clone(), icon_data.clone());
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
                                "hwnd": window_handle_to_isize(hwnd),
                            }),
                        );
                    }
                }
            }

            thread::sleep(Duration::from_millis(50)); // Faster polling
        }
    });
}
#[tauri::command]
pub fn inject_text_to_window_by_title(text: String, window_title: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let wide_title: Vec<u16> = std::ffi::OsStr::new(&window_title)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let hwnd = FindWindowW(std::ptr::null(), wide_title.as_ptr());
            if hwnd.is_null() {
                return Err(format!("Window with title '{}' not found", window_title));
            }
            inject_text_to_window(text, hwnd)
        }
    }

    #[cfg(target_os = "macos")]
    {
        #[allow(unused_variables)]
        // On macOS, find window by title - not yet fully implemented
        use crate::platform::platform_impl::*;
        use core_foundation::array::{CFArray, CFArrayRef};
        use core_foundation::base::TCFType;
        use core_foundation::dictionary::CFDictionaryRef;

        let window_list_ptr = unsafe {
            core_graphics::window::CGWindowListCopyWindowInfo(
                core_graphics::window::kCGWindowListOptionOnScreenOnly,
                core_graphics::window::kCGNullWindowID,
            )
        };

        if window_list_ptr.is_null() {
            return Err("Failed to get window list".to_string());
        }

        let _window_list = unsafe {
            CFArray::<CFDictionaryRef>::wrap_under_create_rule(window_list_ptr as CFArrayRef)
        };

        // Search for window with matching title (simplified for now)
        Err(format!(
            "Window with title '{}' not found - feature not yet fully implemented on macOS",
            window_title
        ))
    }
}

#[tauri::command]
pub fn inject_text_to_window_by_hwnd(text: String, hwnd: isize) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hwnd_ptr = hwnd as WindowHandle;
        if hwnd_ptr.is_null() {
            return Err("Invalid HWND".to_string());
        }
        inject_text_to_window(text, hwnd_ptr)
    }

    #[cfg(target_os = "macos")]
    {
        let window_id = hwnd as WindowHandle;
        inject_text_to_window(text, window_id)
    }
}

fn inject_text_to_window(text: String, hwnd: WindowHandle) -> Result<(), String> {
    // Always use clipboard method for reliability
    inject_text_via_clipboard(text, hwnd)
}

#[cfg(target_os = "windows")]
fn inject_text_via_clipboard(text: String, hwnd: WindowHandle) -> Result<(), String> {
    println!(
        "🔄 Starting clipboard injection for {} characters",
        text.len()
    );

    unsafe {
        if SetForegroundWindow(hwnd) == 0 {
            return Err("Failed to bring target window to foreground".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(100));

        // Convert text to UTF-16
        let wide_text: Vec<u16> = OsStr::new(&text)
            .encode_wide()
            .chain(std::iter::once(0)) // null terminator
            .collect();

        // Open clipboard
        if OpenClipboard(hwnd) == 0 {
            return Err("Failed to open clipboard".into());
        }

        // Empty clipboard
        if EmptyClipboard() == 0 {
            CloseClipboard();
            return Err("Failed to empty clipboard".into());
        }

        // Allocate global memory
        let h_global = GlobalAlloc(GMEM_MOVEABLE, wide_text.len() * 2);
        if h_global.is_null() {
            CloseClipboard();
            return Err("Failed to allocate memory".into());
        }

        // Lock memory and copy text
        let p_global = GlobalLock(h_global) as *mut u16;
        if p_global.is_null() {
            CloseClipboard();
            return Err("Failed to lock memory".into());
        }

        std::ptr::copy_nonoverlapping(wide_text.as_ptr(), p_global, wide_text.len());
        GlobalUnlock(h_global);

        // Set clipboard data
        if SetClipboardData(CF_UNICODETEXT, h_global).is_null() {
            CloseClipboard();
            return Err("Failed to set clipboard data".into());
        }

        #[cfg(target_os = "macos")]
        // Press Ctrl
        let mut ctrl_down = INPUT {
            type_: INPUT_KEYBOARD,
            u: std::mem::zeroed(),
        };
        *ctrl_down.u.ki_mut() = KEYBDINPUT {
            wVk: VK_CONTROL as u16,
            wScan: 0,
            dwFlags: 0,
            time: 0,
            dwExtraInfo: 0,
        };

        // Press V
        let mut v_down = INPUT {
            type_: INPUT_KEYBOARD,
            u: std::mem::zeroed(),
        };
        *v_down.u.ki_mut() = KEYBDINPUT {
            wVk: VK_V as u16,
            wScan: 0,
            dwFlags: 0,
            time: 0,
            dwExtraInfo: 0,
        };

        // Release V
        let mut v_up = INPUT {
            type_: INPUT_KEYBOARD,
            u: std::mem::zeroed(),
        };
        *v_up.u.ki_mut() = KEYBDINPUT {
            wVk: VK_V as u16,
            wScan: 0,
            dwFlags: KEYEVENTF_KEYUP,
            time: 0,
            dwExtraInfo: 0,
        };

        // Release Ctrl
        let mut ctrl_up = INPUT {
            type_: INPUT_KEYBOARD,
            u: std::mem::zeroed(),
        };
        *ctrl_up.u.ki_mut() = KEYBDINPUT {
            wVk: VK_CONTROL as u16,
            wScan: 0,
            dwFlags: KEYEVENTF_KEYUP,
            time: 0,
            dwExtraInfo: 0,
        };

        // Send the key sequence
        SendInput(1, &mut ctrl_down, std::mem::size_of::<INPUT>() as i32);
        std::thread::sleep(std::time::Duration::from_millis(10));
        SendInput(1, &mut v_down, std::mem::size_of::<INPUT>() as i32);
        std::thread::sleep(std::time::Duration::from_millis(10));
        SendInput(1, &mut v_up, std::mem::size_of::<INPUT>() as i32);
        std::thread::sleep(std::time::Duration::from_millis(10));
        SendInput(1, &mut ctrl_up, std::mem::size_of::<INPUT>() as i32);

        println!("✅ Clipboard injection completed successfully");
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn inject_text_via_clipboard(text: String, window_id: WindowHandle) -> Result<(), String> {
    use cocoa::appkit::NSPasteboard;
    use cocoa::base::{id, nil};
    use cocoa::foundation::{NSArray, NSAutoreleasePool, NSString};
    use core_graphics::event::{CGEvent, CGEventTapLocation};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    use objc::{class, msg_send, sel, sel_impl};

    println!(
        "🔄 [macOS Inject] Starting clipboard injection for {} characters to window {}",
        text.len(),
        window_id
    );

    unsafe {
        let pool = NSAutoreleasePool::new(nil);
        
        // CRITICAL: Activate the target window first (like SetForegroundWindow on Windows)
        println!("🎯 [macOS Inject] Step 1: Activating target window {}", window_id);
        
        // Get the PID of the target window
        if let Some(pid) = crate::platform::platform_impl::get_pid_from_window_id(window_id) {
            println!("   Found PID: {}", pid);
            
            // Get the NSRunningApplication for this PID
            let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
            let running_apps: id = msg_send![workspace, runningApplications];
            let count: usize = msg_send![running_apps, count];
            
            println!("   Searching through {} running apps", count);
            
            for i in 0..count {
                let app: id = msg_send![running_apps, objectAtIndex: i];
                let app_pid: i32 = msg_send![app, processIdentifier];
                
                if app_pid == pid {
                    println!("   ✅ Found matching app, activating...");
                    // Activate the application
                    let success: bool = msg_send![app, activateWithOptions: 0]; // NSApplicationActivateIgnoringOtherApps
                    if !success {
                        eprintln!("   ⚠️ Failed to activate app");
                    } else {
                        println!("   ✅ App activated successfully");
                    }
                    break;
                }
            }
            
            // Wait for activation to complete
            std::thread::sleep(std::time::Duration::from_millis(200));
        } else {
            eprintln!("   ⚠️ Could not get PID for window {}", window_id);
        }

        // Get general pasteboard
        println!("📋 [macOS Inject] Step 2: Writing to clipboard");
        let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];

        // Clear pasteboard
        let _: () = msg_send![pasteboard, clearContents];

        // Create NSString from text
        let ns_string: id = msg_send![class!(NSString), stringWithUTF8String: text.as_ptr()];

        // Write string to pasteboard
        let array: id = msg_send![class!(NSArray), arrayWithObject: ns_string];
        let success: bool = msg_send![pasteboard, writeObjects: array];

        if !success {
            let _: () = msg_send![pool, drain];
            return Err("Failed to write to clipboard".to_string());
        }

        println!("   ✅ Text written to clipboard");
        
        // Wait a bit to ensure clipboard is ready
        std::thread::sleep(std::time::Duration::from_millis(50));
        
        // Simulate Command+V
        println!("⌨️  [macOS Inject] Step 3: Sending Command+V keypress");
        let source = match CGEventSource::new(CGEventSourceStateID::CombinedSessionState) {
            Ok(s) => s,
            Err(_) => {
                let _: () = msg_send![pool, drain];
                return Err("Failed to create event source".to_string());
            }
        };

        // Command key down (0x37)
        let cmd_down = match CGEvent::new_keyboard_event(source.clone(), 0x37, true) {
            Ok(e) => e,
            Err(_) => {
                let _: () = msg_send![pool, drain];
                return Err("Failed to create command down event".to_string());
            }
        };
        cmd_down.post(CGEventTapLocation::HID);
        println!("   ⌘ Command key pressed");

        std::thread::sleep(std::time::Duration::from_millis(50));

        // V key down (0x09)
        let v_down = match CGEvent::new_keyboard_event(source.clone(), 0x09, true) {
            Ok(e) => e,
            Err(_) => {
                let _: () = msg_send![pool, drain];
                return Err("Failed to create V down event".to_string());
            }
        };
        v_down.set_flags(core_graphics::event::CGEventFlags::CGEventFlagCommand);
        v_down.post(CGEventTapLocation::HID);
        println!("   V V key pressed");

        std::thread::sleep(std::time::Duration::from_millis(50));

        // V key up
        let v_up = match CGEvent::new_keyboard_event(source.clone(), 0x09, false) {
            Ok(e) => e,
            Err(_) => {
                let _: () = msg_send![pool, drain];
                return Err("Failed to create V up event".to_string());
            }
        };
        v_up.set_flags(core_graphics::event::CGEventFlags::CGEventFlagCommand);
        v_up.post(CGEventTapLocation::HID);
        println!("   ↑ V key released");

        std::thread::sleep(std::time::Duration::from_millis(50));

        // Command key up
        let cmd_up = match CGEvent::new_keyboard_event(source, 0x37, false) {
            Ok(e) => e,
            Err(_) => {
                let _: () = msg_send![pool, drain];
                return Err("Failed to create command up event".to_string());
            }
        };
        cmd_up.post(CGEventTapLocation::HID);
        println!("   ↑ Command key released");

        let _: () = msg_send![pool, drain];
        println!("✅ [macOS Inject] Text injection completed successfully!");
        Ok(())
    }
}
#[derive(serde::Serialize)]
pub struct WindowInfo {
    pub hwnd: isize,
    pub title: String,
}

#[cfg(target_os = "windows")]
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

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn capture_window_screenshot() -> Result<String, String> {
    crate::platform::capture_full_screenshot()
}
#[cfg(target_os = "windows")]
fn capture_hwnd_to_png_base64(hwnd: WindowHandle) -> Result<String, String> {
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
    #[cfg(target_os = "windows")]
    {
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

    #[cfg(target_os = "macos")]
    {
        // Find window by title and capture it
        Err(format!(
            "Window screenshot by title not yet fully implemented on macOS for '{}'",
            window_title
        ))
    }
}

#[tauri::command]
pub fn capture_window_screenshot_by_hwnd(hwnd: isize) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let hwnd_ptr = hwnd as WindowHandle;
        if hwnd_ptr.is_null() {
            return Err("Invalid HWND".to_string());
        }
        capture_hwnd_to_png_base64(hwnd_ptr)
    }

    #[cfg(target_os = "macos")]
    {
        let window_id = hwnd as WindowHandle;
        crate::platform::platform_impl::capture_window_screenshot_by_id(window_id)
    }
}

#[tauri::command]
pub async fn set_auto_start_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart_manager = app.autolaunch();
    if enabled {
        match autostart_manager.enable() {
            Ok(_) => {
                println!("Auto-start enabled successfully");
                // Try to set up elevated privileges for Windows
                #[cfg(target_os = "windows")]
                {
                    if let Err(e) = setup_windows_elevated_startup(&app) {
                        println!("Warning: Could not set up elevated startup: {}", e);
                        // Don't fail the whole operation, just warn
                    }
                }
                Ok(())
            }
            Err(e) => {
                println!("Failed to enable auto-start: {}", e);
                Err(format!("Failed to enable auto-start: {}", e))
            }
        }
    } else {
        match autostart_manager.disable() {
            Ok(_) => {
                println!("Auto-start disabled successfully");
                // Clean up elevated startup entry
                #[cfg(target_os = "windows")]
                {
                    if let Err(e) = cleanup_windows_elevated_startup() {
                        println!("Warning: Could not clean up elevated startup: {}", e);
                    }
                }
                Ok(())
            }
            Err(e) => {
                println!("Failed to disable auto-start: {}", e);
                Err(format!("Failed to disable auto-start: {}", e))
            }
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
    let command = format!(
        "schtasks /create /tn \"{}\" /tr \"\\\"{}\\\"\" /sc onlogon /rl highest /f",
        task_name, exe_path
    );

    match std::process::Command::new("cmd")
        .args(&["/C", &command])
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                println!("Elevated startup task created successfully");
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!(
                    "Failed to create elevated startup task: {}",
                    stderr
                ))
            }
        }
        Err(e) => Err(format!("Failed to run schtasks command: {}", e)),
    }
}

#[cfg(target_os = "windows")]
fn cleanup_windows_elevated_startup() -> Result<(), String> {
    let task_name = "RaeAutoStart";
    let command = format!("schtasks /delete /tn \"{}\" /f", task_name);

    match std::process::Command::new("cmd")
        .args(&["/C", &command])
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                println!("Elevated startup task removed successfully");
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                println!(
                    "Warning: Failed to remove elevated startup task: {}",
                    stderr
                );
                Ok(()) // Don't fail if cleanup fails
            }
        }
        Err(e) => {
            println!("Warning: Failed to run schtasks delete command: {}", e);
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
