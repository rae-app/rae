use cocoa::base::{id, nil};
use cocoa::foundation::NSAutoreleasePool;
use objc::{class, msg_send, sel, sel_impl};
use std::process::Command;

#[tauri::command]
pub fn inject_text_to_window_by_hwnd(text: String, _hwnd: isize) -> Result<(), String> {
    println!("Starting text injection for text: {}", text.len());

    unsafe {
        let pool = NSAutoreleasePool::new(nil);

        // Put text in clipboard
        println!("Setting clipboard text...");
        set_clipboard_text(&text)?;

        // Small delay to ensure clipboard is set
        std::thread::sleep(std::time::Duration::from_millis(100));

        // Simulate paste operation using accessibility API
        println!("Triggering paste operation...");
        simulate_paste_operation(&text)?;

        pool.drain();
        println!("Text injection completed");
        Ok(())
    }
}


unsafe fn set_clipboard_text(text: &str) -> Result<(), String> {
    let pool = NSAutoreleasePool::new(nil);

    // Get the general pasteboard
    let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];

    // Clear the pasteboard
    let _: () = msg_send![pasteboard, clearContents];

    // Create NSString from the text
    let ns_string: id = msg_send![class!(NSString), stringWithUTF8String: text.as_ptr() as *const i8];

    // Create array with the string
    let array: id = msg_send![class!(NSArray), arrayWithObject: ns_string];

    // Write to pasteboard
    let success: bool = msg_send![pasteboard, writeObjects: array];

    pool.drain();

    if success {
        Ok(())
    } else {
        Err("Failed to write to clipboard".to_string())
    }
}

fn simulate_paste_operation(_text: &str) -> Result<(), String> {
    println!("Using AppleScript to simulate paste operation");

    // Use AppleScript to simulate Cmd+V in the frontmost application
    let applescript = r#"
        tell application "System Events"
            keystroke "v" using command down
        end tell
    "#;

    match Command::new("osascript")
        .arg("-e")
        .arg(applescript)
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                println!("AppleScript paste operation succeeded");
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                println!("AppleScript failed: {}", stderr);
                Err(format!("AppleScript failed: {}", stderr))
            }
        }
        Err(e) => {
            println!("Failed to run osascript: {:?}", e);
            Err(format!("Failed to run osascript: {:?}", e))
        }
    }
}