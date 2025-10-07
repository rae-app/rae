use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use tracing::info;
use winapi::shared::windef::HWND as WinHWND;
use winapi::um::winbase::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
use winapi::um::winuser::{
    FindWindowW, OpenClipboard, EmptyClipboard, SetClipboardData, CloseClipboard,
    SetForegroundWindow, SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
    CF_UNICODETEXT, VK_CONTROL,
};

// VK_V constant (not defined in winapi crate)
const VK_V: u16 = 0x56;

#[tauri::command]
pub fn inject_text_to_window_by_title(text: String, window_title: String) -> Result<(), String> {
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

#[tauri::command]
pub fn inject_text_to_window_by_hwnd(text: String, hwnd: isize) -> Result<(), String> {
    let hwnd_ptr = hwnd as WinHWND;
    if hwnd_ptr.is_null() {
        return Err("Invalid HWND".to_string());
    }
    inject_text_to_window(text, hwnd_ptr)
}

fn inject_text_to_window(text: String, hwnd: WinHWND) -> Result<(), String> {
    // Always use clipboard method for reliability
    inject_text_via_clipboard(text, hwnd)
}

fn inject_text_via_clipboard(text: String, hwnd: WinHWND) -> Result<(), String> {
    info!("Starting clipboard injection for {} characters", text.len());

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

        // Close clipboard
        CloseClipboard();

        // Send Ctrl+V to paste
        std::thread::sleep(std::time::Duration::from_millis(50));

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

        info!("Clipboard injection completed successfully");
        Ok(())
    }
}
