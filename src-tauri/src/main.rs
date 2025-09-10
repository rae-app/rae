#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Declare the modules that make up the application logic.
mod functions;
mod platform;
mod utils;

// Import required traits
use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Handle main window close event to also close overlay
            if let Some(main_window) = app.get_webview_window("main") {
                let app_handle_clone = app_handle.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        println!("Main window close requested, closing overlay window...");
                        // Close overlay window when main window is closed
                        if let Some(overlay_window) = app_handle_clone.get_webview_window("overlay") {
                            let _ = overlay_window.close();
                        }
                    }
                });
            }

            // Handle overlay window close event for cleanup
            if let Some(overlay_window) = app.get_webview_window("overlay") {
                overlay_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        println!("Overlay window close requested, cleaning up shortcuts...");
                        // Clean up global shortcuts when overlay is closed
                        let shortcuts = vec![
                            tauri_plugin_global_shortcut::Shortcut::new(Some(tauri_plugin_global_shortcut::Modifiers::CONTROL), tauri_plugin_global_shortcut::Code::KeyH),
                            tauri_plugin_global_shortcut::Shortcut::new(Some(tauri_plugin_global_shortcut::Modifiers::CONTROL), tauri_plugin_global_shortcut::Code::KeyM),
                            tauri_plugin_global_shortcut::Shortcut::new(Some(tauri_plugin_global_shortcut::Modifiers::CONTROL), tauri_plugin_global_shortcut::Code::KeyP),
                            tauri_plugin_global_shortcut::Shortcut::new(Some(tauri_plugin_global_shortcut::Modifiers::CONTROL | tauri_plugin_global_shortcut::Modifiers::SHIFT), tauri_plugin_global_shortcut::Code::Enter),
                            tauri_plugin_global_shortcut::Shortcut::new(Some(tauri_plugin_global_shortcut::Modifiers::CONTROL), tauri_plugin_global_shortcut::Code::KeyD),
                        ];

                        for shortcut in shortcuts {
                            let _ = app_handle.global_shortcut().unregister(shortcut);
                        }
                        println!("Global shortcuts unregistered on overlay close");
                    }
                });
            }

            Ok(())
        })
        // Register all the invokable commands from the `commands` module.
        .invoke_handler(tauri::generate_handler![
            functions::overlay::enable_notch,
            functions::overlay::follow_magic_dot,
            functions::overlay::pin_magic_dot,
            functions::general::start_window_watch,
            functions::overlay::start_notch_watcher,
            functions::overlay::close_magic_dot,
            functions::overlay::close_magic_chat,
            functions::overlay::stick_chat_to_dot,
            functions::overlay::animate_chat_expand,
            functions::overlay::center_magic_dot,
            functions::overlay::center_overlay_bar,
            functions::overlay::toggle_pin_overlay,
            functions::overlay::enable_mouse_events,
            functions::overlay::toggle_magic_dot,
            functions::overlay::set_magic_dot_creation_enabled,
            functions::overlay::show_magic_dot,
            functions::overlay::close_overlay_window,
            // functions::overlay::show_overlay_center,
            functions::chat::set_auto_show_on_copy_enabled,
            functions::chat::get_auto_show_on_copy_enabled,
            functions::chat::set_auto_show_on_selection_enabled,
            functions::chat::get_auto_show_on_selection_enabled,
            functions::chat::set_rae_watcher_enabled,
            functions::chat::get_rae_watcher_enabled,
            functions::chat::set_notch_window_display_enabled,
            functions::chat::get_notch_window_display_enabled,
            functions::stealth::set_stealth_mode_enabled,
            functions::stealth::get_stealth_mode_enabled,
            functions::stealth::apply_stealth_mode_to_window,
            functions::general::inject_text_to_window_by_title,
            functions::general::capture_window_screenshot,
            functions::general::capture_window_screenshot_by_title,
            functions::general::capture_window_screenshot_by_hwnd,
            functions::supermemory::create_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
