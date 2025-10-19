use cocoa::base::{id, nil};
use cocoa::foundation::NSAutoreleasePool;
use core_foundation::base::TCFType;
use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation, CGEventType, CGKeyCode};
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
use objc::{class, msg_send, sel, sel_impl};

#[tauri::command]
pub fn inject_text_to_window_by_hwnd(text: String, hwnd: isize) -> Result<(), String> {
    println!("Starting text injection for text length: {}", text.len());
    println!("Target window HWND: {}", hwnd);

    unsafe {
        let pool = NSAutoreleasePool::new(nil);

        // Convert hwnd (isize) back to WindowId (u32)
        let window_id = hwnd as u32;
        println!("Converted to window_id: {}", window_id);

        // Get the PID of the target window
        let pid = crate::platform::platform_impl::get_pid_from_window_id(window_id);

        if let Some(pid) = pid {
            println!("Found PID {} for window {}", pid, window_id);

            // Activate the target application first
            println!("Activating target application...");
            if let Err(e) = activate_application_by_pid(pid) {
                println!("Warning: Failed to activate application: {}", e);
                // Continue anyway as the paste might still work
            }

            // Wait for window activation to complete
            println!("Waiting for window activation...");
            std::thread::sleep(std::time::Duration::from_millis(400));
        } else {
            println!(
                "Warning: Could not find PID for window {}, proceeding anyway",
                window_id
            );
        }

        // Put text in clipboard
        println!("Setting clipboard text...");
        set_clipboard_text(&text)?;

        // Delay to ensure clipboard is set
        std::thread::sleep(std::time::Duration::from_millis(200));

        // Try paste operation multiple times with delays
        println!("Attempting paste operation (with retries)...");
        let mut success = false;
        for attempt in 1..=3 {
            println!("Paste attempt {} of 3", attempt);

            if let Ok(_) = simulate_paste_with_cgevents() {
                success = true;
                break;
            }

            if attempt < 3 {
                std::thread::sleep(std::time::Duration::from_millis(300));
            }
        }

        pool.drain();

        if success {
            println!("Text injection completed successfully");
            Ok(())
        } else {
            Err("Failed to inject text after retries".to_string())
        }
    }
}

fn activate_application_by_pid(pid: i32) -> Result<(), String> {
    println!("Attempting to activate application with PID: {}", pid);

    unsafe {
        let pool = NSAutoreleasePool::new(nil);

        // Get the running application by PID
        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let running_apps: id = msg_send![workspace, runningApplications];
        let count: usize = msg_send![running_apps, count];

        for i in 0..count {
            let app: id = msg_send![running_apps, objectAtIndex: i];
            let app_pid: i32 = msg_send![app, processIdentifier];

            if app_pid == pid {
                // NSApplicationActivateIgnoringOtherApps = 1 << 1 = 2
                let success: bool = msg_send![app, activateWithOptions: 2];
                pool.drain();

                if success {
                    println!("Successfully activated application with PID {}", pid);
                    return Ok(());
                } else {
                    let error_msg = format!("Failed to activate application with PID {}", pid);
                    println!("{}", error_msg);
                    return Err(error_msg);
                }
            }
        }

        pool.drain();
        Err(format!("Could not find application with PID {}", pid))
    }
}

unsafe fn set_clipboard_text(text: &str) -> Result<(), String> {
    let pool = NSAutoreleasePool::new(nil);

    // Get the general pasteboard
    let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];

    // Clear the pasteboard
    let _: () = msg_send![pasteboard, clearContents];

    // Create NSString from the text
    let ns_string: id =
        msg_send![class!(NSString), stringWithUTF8String: text.as_ptr() as *const i8];

    // Create array with the string
    let array: id = msg_send![class!(NSArray), arrayWithObject: ns_string];

    // Write to pasteboard
    let success: bool = msg_send![pasteboard, writeObjects: array];

    pool.drain();

    if success {
        println!("Successfully wrote to clipboard");
        Ok(())
    } else {
        Err("Failed to write to clipboard".to_string())
    }
}

fn simulate_paste_with_cgevents() -> Result<(), String> {
    println!("Simulating Cmd+V using CGEvent API");

    // Create an event source
    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| "Failed to create CGEventSource")?;

    // Key code for 'V' key
    const KEY_V: CGKeyCode = 0x09;

    // Create key down event for Command key
    const KEY_CMD: CGKeyCode = 0x37; // Left Command key
    let cmd_down = CGEvent::new_keyboard_event(source.clone(), KEY_CMD, true)
        .map_err(|_| "Failed to create cmd down event")?;
    cmd_down.post(CGEventTapLocation::HID);
    std::thread::sleep(std::time::Duration::from_millis(50));

    // Create key down event for V
    let key_down = CGEvent::new_keyboard_event(source.clone(), KEY_V, true)
        .map_err(|_| "Failed to create key down event")?;
    key_down.set_flags(CGEventFlags::CGEventFlagCommand);
    key_down.post(CGEventTapLocation::HID);
    std::thread::sleep(std::time::Duration::from_millis(50));

    // Create key up event for V
    let key_up = CGEvent::new_keyboard_event(source.clone(), KEY_V, false)
        .map_err(|_| "Failed to create key up event")?;
    key_up.set_flags(CGEventFlags::CGEventFlagCommand);
    key_up.post(CGEventTapLocation::HID);
    std::thread::sleep(std::time::Duration::from_millis(50));

    // Create key up event for Command key
    let cmd_up = CGEvent::new_keyboard_event(source.clone(), KEY_CMD, false)
        .map_err(|_| "Failed to create cmd up event")?;
    cmd_up.post(CGEventTapLocation::HID);

    println!("Successfully posted Cmd+V events");
    Ok(())
}
