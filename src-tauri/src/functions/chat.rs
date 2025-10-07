use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

static AUTO_SHOW_ON_COPY: AtomicBool = AtomicBool::new(false);
static CLIPBOARD_WATCHER_RUNNING: AtomicBool = AtomicBool::new(false);
static AUTO_SHOW_ON_SELECTION: AtomicBool = AtomicBool::new(false);
static SELECTION_WATCHER_RUNNING: AtomicBool = AtomicBool::new(false);
static RAE_WATCHER_ENABLED: AtomicBool = AtomicBool::new(false);
static RAE_WATCHER_RUNNING: AtomicBool = AtomicBool::new(false);
static NOTCH_WINDOW_DISPLAY_ENABLED: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "windows")]
use winapi::um::winuser::{
    GetAsyncKeyState, GetClipboardSequenceNumber, IsClipboardFormatAvailable, CF_UNICODETEXT,
    VK_LBUTTON,
};

#[cfg(target_os = "windows")]
unsafe fn read_clipboard_unicode_text() -> Option<String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use winapi::shared::minwindef::HGLOBAL;
    use winapi::um::winbase::{GlobalLock, GlobalUnlock};
    use winapi::um::winuser::{CloseClipboard, GetClipboardData, OpenClipboard};
    if IsClipboardFormatAvailable(CF_UNICODETEXT) == 0 {
        return None;
    }
    if OpenClipboard(std::ptr::null_mut()) == 0 {
        return None;
    }
    let handle: HGLOBAL = GetClipboardData(CF_UNICODETEXT);
    if handle.is_null() {
        CloseClipboard();
        return None;
    }
    let locked = GlobalLock(handle) as *const u16;
    if locked.is_null() {
        CloseClipboard();
        return None;
    }
    let mut len: usize = 0;
    while *locked.add(len) != 0 {
        len += 1;
    }
    let slice = std::slice::from_raw_parts(locked, len);
    let os_string = OsString::from_wide(slice);
    let text = os_string.to_string_lossy().into_owned();
    let _ = GlobalUnlock(handle);
    CloseClipboard();
    Some(text)
}

#[cfg(target_os = "macos")]
unsafe fn read_clipboard_unicode_text() -> Option<String> {
    use cocoa::appkit::NSPasteboard;
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSAutoreleasePool;
    use objc::{class, msg_send, sel, sel_impl};
    use objc_foundation::{INSString, NSString};

    let pool = NSAutoreleasePool::new(nil);
    let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];
    let contents: id = msg_send![pasteboard, stringForType: cocoa::appkit::NSPasteboardTypeString];

    if contents == nil {
        let _: () = msg_send![pool, drain];
        return None;
    }
    let _: () = msg_send![pool, drain];
    let contents_str: *const i8 = msg_send![contents, UTF8String];
    if contents_str.is_null() {
        let _: () = msg_send![pool, drain];
        return None;
    }
    let c_str = std::ffi::CStr::from_ptr(contents_str);
    let result = Some(c_str.to_string_lossy().into_owned());
    result
}

#[cfg(target_os = "windows")]
#[cfg(target_os = "windows")]
fn ensure_clipboard_watcher_started(app: AppHandle) {
    if CLIPBOARD_WATCHER_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut last_text: Option<String> = None;
        let mut last_seq: u32 = unsafe { GetClipboardSequenceNumber() };
        loop {
            if !AUTO_SHOW_ON_COPY.load(Ordering::Relaxed) {
                CLIPBOARD_WATCHER_RUNNING.store(false, Ordering::SeqCst);
                break;
            }
            let seq_now = unsafe { GetClipboardSequenceNumber() };
            if seq_now == last_seq {
                std::thread::sleep(std::time::Duration::from_millis(250));
                continue;
            }
            last_seq = seq_now;
            let current = unsafe { read_clipboard_unicode_text() }
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
            if let Some(ref txt) = current {
                let is_new = match last_text {
                    Some(ref prev) => prev != txt,
                    None => true,
                };
                if is_new && txt.len() >= 3 {
                    crate::functions::overlay::show_magic_dot(app_handle.clone());
                    let _ = app_handle
                        .emit("clipboard_text_copied", serde_json::json!({ "text": txt }));
                    last_text = current.clone();
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
    });
}

#[cfg(target_os = "macos")]
fn ensure_clipboard_watcher_started(app: AppHandle) {
    if CLIPBOARD_WATCHER_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app_handle = app.clone();
    std::thread::spawn(move || {
        use cocoa::appkit::NSPasteboard;
        use cocoa::base::{id, nil};
        use cocoa::foundation::NSAutoreleasePool;
        use objc::{class, msg_send, sel, sel_impl};

        let mut last_change_count: i64 = -1;
        let mut last_text: Option<String> = None;

        loop {
            if !AUTO_SHOW_ON_COPY.load(Ordering::Relaxed) {
                CLIPBOARD_WATCHER_RUNNING.store(false, Ordering::SeqCst);
                break;
            }

            unsafe {
                let pool = NSAutoreleasePool::new(nil);
                let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];
                let change_count: i64 = msg_send![pasteboard, changeCount];

                if change_count != last_change_count {
                    last_change_count = change_count;

                    if let Some(current_text) = read_clipboard_unicode_text() {
                        let current_text = current_text.trim().to_string();
                        if !current_text.is_empty() {
                            if last_text.as_ref() != Some(&current_text) {
                                last_text = Some(current_text.clone());
                                let _ = app_handle.emit(
                                    "clipboard_text_copied",
                                    serde_json::json!({ "text": current_text }),
                                );
                            }
                        }
                    }
                }
                let _: () = msg_send![pool, drain];
            }

            std::thread::sleep(std::time::Duration::from_millis(250));
        }
    });
}

#[cfg(target_os = "windows")]
fn ensure_selection_watcher_started(app: &AppHandle) {
    if SELECTION_WATCHER_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app_handle = app.clone();
    std::thread::spawn(move || {
        #[cfg(target_os = "windows")]
        unsafe {
            use windows::Win32::System::Com::{
                CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
                COINIT_APARTMENTTHREADED,
            };
            use windows::Win32::UI::Accessibility::{
                CUIAutomation, IUIAutomation, IUIAutomationTextPattern, UIA_TextPatternId,
            };
            let _hr = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let mut automation: Option<IUIAutomation> = None;
            let mut last_text: Option<String> = None;
            let mut last_uia_emit_at: Option<std::time::Instant> = None;
            let mut last_fallback_emit_at: Option<std::time::Instant> = None;
            let mut mouse_was_down: bool = false;
            let mut drag_origin: Option<(i32, i32)> = None;
            let mut did_drag: bool = false;
            let mut press_started_at: Option<std::time::Instant> = None;
            let mut pending_selected_text: Option<String> = None;
            let enigo_mouse = Enigo::new();
            loop {
                if !AUTO_SHOW_ON_SELECTION.load(Ordering::Relaxed) {
                    SELECTION_WATCHER_RUNNING.store(false, Ordering::SeqCst);
                    break;
                }
                let mouse_state: u16 = GetAsyncKeyState(VK_LBUTTON as i32) as u16;
                let mouse_is_down = (mouse_state & 0x8000u16) != 0;
                if mouse_is_down && !mouse_was_down {
                    let (mx, my) = enigo_mouse.mouse_location();
                    drag_origin = Some((mx, my));
                    did_drag = false;
                    press_started_at = Some(std::time::Instant::now());
                } else if mouse_is_down && mouse_was_down {
                    if let Some((ox, oy)) = drag_origin {
                        let (mx, my) = enigo_mouse.mouse_location();
                        let dx = mx - ox;
                        let dy = my - oy;
                        if (dx * dx + dy * dy) as f64 > 144.0 {
                            did_drag = true;
                        }
                    }
                } else if !mouse_is_down && mouse_was_down {
                    let press_duration_ms = press_started_at
                        .map(|t| t.elapsed().as_millis() as u64)
                        .unwrap_or(0);
                    if did_drag && press_duration_ms >= 120 {
                        if let Some(final_text) = pending_selected_text
                            .take()
                            .filter(|s| !s.trim().is_empty())
                        {
                            let is_new = match &last_text {
                                Some(prev) => prev != &final_text,
                                None => true,
                            };
                            if is_new {
                                crate::functions::overlay::show_magic_dot(app_handle.clone());
                                let _ = app_handle.emit(
                                    "text_selected",
                                    serde_json::json!({ "text": final_text }),
                                );
                                last_text = Some(final_text);
                                last_uia_emit_at = Some(std::time::Instant::now());
                            }
                        } else {
                            let allow_fallback = match last_uia_emit_at {
                                Some(t) => t.elapsed().as_millis() as u64 > 250,
                                None => true,
                            } && match last_fallback_emit_at {
                                Some(t) => t.elapsed().as_millis() as u64 > 500,
                                None => true,
                            };
                            if allow_fallback {
                                crate::functions::overlay::show_magic_dot(app_handle.clone());
                                let _ = app_handle
                                    .emit("text_selected", serde_json::json!({ "text": "" }));
                                last_fallback_emit_at = Some(std::time::Instant::now());
                            }
                        }

                        #[cfg(target_os = "macos")]
                        #[cfg(target_os = "windows")]
                        fn ensure_rae_watcher_started(app: AppHandle) {
                            if SELECTION_WATCHER_RUNNING.swap(true, Ordering::Relaxed) {
                                return;
                            }
                            // macOS text selection monitoring would require Accessibility API
                            // This is a placeholder for future implementation
                        }
                    }
                    drag_origin = None;
                    did_drag = false;
                    press_started_at = None;
                }
                mouse_was_down = mouse_is_down;
                if automation.is_none() {
                    automation = CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).ok();
                    if automation.is_none() {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        continue;
                    }
                }
                let Some(auto) = &automation else { continue };
                let focused_element = auto.GetFocusedElement();
                if let Ok(element) = focused_element {
                    let pattern =
                        element.GetCurrentPatternAs::<IUIAutomationTextPattern>(UIA_TextPatternId);
                    if let Ok(text_pattern) = pattern {
                        let selection = text_pattern.GetSelection();
                        if let Ok(selection_array) = selection {
                            let len = selection_array.Length();
                            if let Ok(len) = len {
                                if len > 0 {
                                    let first_range = selection_array.GetElement(0);
                                    if let Ok(range) = first_range {
                                        let get_text = range.GetText(4096);
                                        if let Ok(bstr) = get_text {
                                            let text = bstr.to_string();
                                            let trimmed = text.trim().to_string();
                                            if !trimmed.is_empty() && trimmed.len() >= 1 {
                                                let should_update_pending =
                                                    match &pending_selected_text {
                                                        Some(prev) => prev != &trimmed,
                                                        None => true,
                                                    };
                                                if should_update_pending {
                                                    pending_selected_text = Some(trimmed.clone());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                #[cfg(target_os = "macos")]
                fn ensure_rae_watcher_started(_app: AppHandle) {
                    if RAE_WATCHER_RUNNING.swap(true, Ordering::Relaxed) {
                        return;
                    }
                    // macOS keyboard hook would require CGEventTap
                    // This is a placeholder for future implementation
                }
                std::thread::sleep(std::time::Duration::from_millis(30));
            }
            CoUninitialize();
        }
    });
}

#[cfg(target_os = "windows")]
fn ensure_rae_watcher_started(app: &AppHandle) {
    if RAE_WATCHER_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app_handle = app.clone();
    std::thread::spawn(move || {
        #[cfg(target_os = "windows")]
        unsafe {
            use std::collections::VecDeque;
            use winapi::shared::minwindef::{HINSTANCE, LPARAM, LRESULT, WPARAM};
            use winapi::shared::windef::HHOOK;
            use winapi::um::winuser::{
                CallNextHookEx, DispatchMessageW, PeekMessageW, SetWindowsHookExW,
                TranslateMessage, UnhookWindowsHookEx, HC_ACTION, KBDLLHOOKSTRUCT, MSG, PM_REMOVE,
                WH_KEYBOARD_LL, WM_KEYDOWN, WM_QUIT, WM_SYSKEYDOWN,
            };

            let mut typed_chars = VecDeque::new();
            let mut last_key_time = std::time::Instant::now();
            // We need to pass the app_handle to the hook procedure somehow
            // Since we can't capture it in the extern "system" function, we'll use a different approach

            // Store a reference to check if watcher is still enabled
            let _watcher_enabled = &RAE_WATCHER_ENABLED;
            let app_for_emit = app_handle.clone();

            unsafe extern "system" fn keyboard_hook_proc(
                code: i32,
                wparam: WPARAM,
                lparam: LPARAM,
            ) -> LRESULT {
                // We can't access the VecDeque from here easily, so let's redesign this
                CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
            }

            // Improved polling approach with better key detection
            loop {
                if !RAE_WATCHER_ENABLED.load(Ordering::Relaxed) {
                    break;
                }

                use winapi::um::winuser::GetAsyncKeyState;

                // Check for @ key (Shift+2 on US keyboards) - use different detection method
                let shift_pressed = (GetAsyncKeyState(0x10) as u16 & 0x8000u16) != 0;
                let two_pressed = (GetAsyncKeyState(0x32) as u16 & 0x8000u16) != 0;

                // Check each character of "@rae" - use key down state instead of key press
                let at_detected = shift_pressed && two_pressed;
                let r_detected = (GetAsyncKeyState(0x52) as u16 & 0x8000u16) != 0;
                let a_detected = (GetAsyncKeyState(0x41) as u16 & 0x8000u16) != 0;
                let e_detected = (GetAsyncKeyState(0x45) as u16 & 0x8000u16) != 0;

                let now = std::time::Instant::now();

                // Reset sequence if too much time has passed (3 seconds)
                if !typed_chars.is_empty()
                    && now.duration_since(last_key_time) > std::time::Duration::from_secs(3)
                {
                    typed_chars.clear();
                }

                // Detect @ symbol (only when first typed)
                if at_detected && (typed_chars.is_empty() || typed_chars.len() > 3) {
                    typed_chars.clear();
                    typed_chars.push_back('@');
                    last_key_time = now;
                }
                // Detect r after @
                else if !typed_chars.is_empty()
                    && r_detected
                    && typed_chars.len() == 1
                    && typed_chars[0] == '@'
                {
                    typed_chars.push_back('r');
                    last_key_time = now;
                }
                // Detect a after @r
                else if !typed_chars.is_empty()
                    && a_detected
                    && typed_chars.len() == 2
                    && typed_chars[1] == 'r'
                {
                    typed_chars.push_back('a');
                    last_key_time = now;
                }
                // Detect e after @ra - this completes @rae
                else if !typed_chars.is_empty()
                    && e_detected
                    && typed_chars.len() == 3
                    && typed_chars[2] == 'a'
                {
                    typed_chars.push_back('e');
                    let sequence: String = typed_chars.iter().collect();
                    if sequence == "@rae" {
                        let _ = app_for_emit.emit("rae_mentioned", serde_json::json!({}));
                        typed_chars.clear();
                    }
                }

                // Reset on backspace, enter, or space
                let backspace = (GetAsyncKeyState(0x08) as u16 & 0x8000u16) != 0;
                let enter = (GetAsyncKeyState(0x0D) as u16 & 0x8000u16) != 0;
                let space = (GetAsyncKeyState(0x20) as u16 & 0x8000u16) != 0;

                if (backspace || enter || space) && !typed_chars.is_empty() {
                    typed_chars.clear();
                }

                std::thread::sleep(std::time::Duration::from_millis(50));
            }
        }
        RAE_WATCHER_RUNNING.store(false, Ordering::SeqCst);
    });
}

#[cfg(target_os = "macos")]
fn ensure_selection_watcher_started(_app: &AppHandle) {
    if SELECTION_WATCHER_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    // macOS text selection monitoring requires Accessibility API
    // Placeholder for future implementation
}

#[cfg(target_os = "macos")]
fn ensure_rae_watcher_started(_app: &AppHandle) {
    if RAE_WATCHER_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    // macOS keyboard hook requires CGEventTap
    // Placeholder for future implementation
}
#[tauri::command]
pub fn set_auto_show_on_copy_enabled(app: AppHandle, enabled: bool) {
    AUTO_SHOW_ON_COPY.store(enabled, Ordering::Relaxed);
    if enabled {
        ensure_clipboard_watcher_started(app.clone());
    }
}

#[tauri::command]
pub fn get_auto_show_on_copy_enabled() -> bool {
    AUTO_SHOW_ON_COPY.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn set_auto_show_on_selection_enabled(app: AppHandle, enabled: bool) {
    AUTO_SHOW_ON_SELECTION.store(enabled, Ordering::Relaxed);
    if enabled {
        ensure_selection_watcher_started(&app);
    }
}

#[tauri::command]
pub fn get_auto_show_on_selection_enabled() -> bool {
    AUTO_SHOW_ON_SELECTION.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn set_rae_watcher_enabled(app: AppHandle, enabled: bool) {
    RAE_WATCHER_ENABLED.store(enabled, Ordering::Relaxed);
    if enabled {
        ensure_rae_watcher_started(&app);
    }
}

#[tauri::command]
pub fn get_rae_watcher_enabled() -> bool {
    RAE_WATCHER_ENABLED.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn set_notch_window_display_enabled(enabled: bool) {
    NOTCH_WINDOW_DISPLAY_ENABLED.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn get_notch_window_display_enabled() -> bool {
    NOTCH_WINDOW_DISPLAY_ENABLED.load(Ordering::Relaxed)
}
