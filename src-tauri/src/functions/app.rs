use tauri::{AppHandle, LogicalPosition, Manager, Position, Runtime};

#[tauri::command]
pub fn show_app(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        println!("show app");

        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.set_ignore_cursor_events(false);
    }
}

#[tauri::command]
pub  fn hide_app(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main"){
        println!("hide app");
        let _ = window.set_ignore_cursor_events(true);
    }
}


#[tauri::command]
pub fn start_following_overlay(app: AppHandle) {
    // Get the overlay window
    println!("start following overlay");
    if let Some(overlay) = app.get_webview_window("overlay") {
        if let Ok(position) = overlay.outer_position() {
            // Calculate new position
            let new_x = position.x as f64 + 240.0 - 500.0;
            let new_y = position.y as f64 + 54.0;

            if let Some(main) = app.get_webview_window("main") {
                let _ = main.set_position(tauri::Position::Logical(LogicalPosition {
                    x: new_x,
                    y: new_y,
                }));
            }
        } else {
            println!("Failed to get overlay position");
        }
    } else {
        println!("Overlay window not found");
    }
}