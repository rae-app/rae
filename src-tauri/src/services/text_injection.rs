use crate::platform::WindowHandle;

#[cfg(target_os = "windows")]
use std::ffi::OsStr;

#[cfg(target_os = "windows")]
use winapi::shared::windef::HWND as WinHWND;
#[cfg(target_os = "windows")]
use winapi::um::winbase::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
#[cfg(target_os = "windows")]
use winapi::um::winuser::{
    CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData, CF_UNICODETEXT,
    FindWindowW, SetForegroundWindow, SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
};

#[cfg(target_os = "macos")]
use cocoa::base::{id, nil};
use cocoa::foundation::NSAutoreleasePool;
#[cfg(target_os = "macos")]
use core_graphics::event::{CGEvent, CGEventTapLocation, CGEventType, CGKeyCode};
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
#[cfg(target_os = "macos")]
use objc::{class, msg_send, sel, sel_impl};

// VK_V constant (not defined in winapi crate)
#[cfg(target_os = "windows")]
const VK_V: u16 = 0x56;

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
    use winapi::ctypes::c_void;
    use winapi::um::winbase::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
    use winapi::um::winuser::{
        CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData, CF_UNICODETEXT,
    };

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
    use cocoa::foundation::{NSArray, NSAutoreleasePool, NSString};

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
