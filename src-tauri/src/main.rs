#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

// Declare the modules that make up the application logic.
mod audio_client;
mod functions;
mod platform;
mod services;
mod utils;

// Import required traits
use audio_client::AudioState;

use std::sync::Mutex;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri::State;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

struct TrayState(Mutex<bool>);

fn load_tray_icon() -> Image<'static> {
    let bytes = include_bytes!("../icons/32x32.png");
    Image::from_bytes(bytes).expect("invalid tray icon image")
}
#[tauri::command]
fn hide_main_to_tray(app: tauri::AppHandle, tray_state: State<TrayState>) {
    // Ensure tray exists
    if let Ok(mut created) = tray_state.0.lock() {
        if !*created {
            if let (Ok(show_item), Ok(quit_item)) = (
                MenuItemBuilder::with_id("show_rae", "Show Rae").build(&app),
                MenuItemBuilder::with_id("quit_rae", "Quit").build(&app),
            ) {
                if let Ok(menu) = Menu::with_items(&app, &[&show_item, &quit_item]) {
                    let _ = TrayIconBuilder::new()
                        .icon(load_tray_icon())
                        .menu(&menu)
                        .on_tray_icon_event(|tray, event: TrayIconEvent| {
                            if let TrayIconEvent::Click {
                                button: MouseButton::Left,
                                ..
                            } = event
                            {
                                let app = tray.app_handle();
                                if let Some(win) = app.get_webview_window("main") {
                                    let _ = win.set_skip_taskbar(false);
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                }
                            }
                        })
                        .on_menu_event(|app, event| match event.id().as_ref() {
                            "show_rae" => {
                                if let Some(win) = app.get_webview_window("main") {
                                    let _ = win.set_skip_taskbar(false);
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                }
                            }
                            "quit_rae" => {
                                std::process::exit(0);
                            }
                            _ => {}
                        })
                        .build(&app);
                    *created = true;
                }
            }
        }
    }
    // Hide and remove taskbar presence
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_skip_taskbar(true);
        let _ = win.hide();
    }
}

#[tauri::command]
fn create_tray(app: tauri::AppHandle, tray_state: State<TrayState>) {
    if let Ok(mut created) = tray_state.0.lock() {
        if *created {
            return;
        }
        if let (Ok(show_item), Ok(quit_item)) = (
            MenuItemBuilder::with_id("show_rae", "Show Rae").build(&app),
            MenuItemBuilder::with_id("quit_rae", "Quit").build(&app),
        ) {
            if let Ok(menu) = Menu::with_items(&app, &[&show_item, &quit_item]) {
                let _ = TrayIconBuilder::new()
                    .icon(load_tray_icon())
                    .menu(&menu)
                    .on_tray_icon_event(|tray, event: TrayIconEvent| match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            ..
                        }
                        | TrayIconEvent::DoubleClick { .. } => {
                            let app = tray.app_handle();
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        _ => {}
                    })
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "show_rae" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "quit_rae" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    })
                    .build(&app);
                *created = true;
            }
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let app_handle = app.handle().clone();
            app.manage(TrayState(Mutex::new(false)));
            app.manage(AudioState(Mutex::new(false)));
            // Log startup time for debugging
            println!(
                "Rae app started successfully at {:?}",
                std::time::Instant::now()
            );

            // Create tray immediately on startup
            {
                let app_handle = app.handle().clone();
                if let (Ok(show_item), Ok(quit_item)) = (
                    MenuItemBuilder::with_id("show_rae", "Show Rae").build(&app_handle),
                    MenuItemBuilder::with_id("quit_rae", "Quit").build(&app_handle),
                ) {
                    if let Ok(menu) = Menu::with_items(&app_handle, &[&show_item, &quit_item]) {
                        let _ = TrayIconBuilder::new()
                            .icon(load_tray_icon())
                            .menu(&menu)
                            .on_tray_icon_event(|tray, event: TrayIconEvent| {
                                if let TrayIconEvent::Click {
                                    button: MouseButton::Left,
                                    ..
                                } = event
                                {
                                    let app = tray.app_handle();
                                    // Show both main and overlay windows when clicking tray
                                    if let Some(win) = app.get_webview_window("main") {
                                        let _ = win.show();
                                        let _ = win.set_focus();
                                    }
                                    if let Some(win) = app.get_webview_window("overlay") {
                                        let _ = win.show();
                                        let _ = win.set_focus();
                                    }
                                }
                            })
                            .on_menu_event(|app, event| match event.id().as_ref() {
                                "show_rae" => {
                                    // Show both main and overlay windows
                                    if let Some(win) = app.get_webview_window("main") {
                                        let _ = win.show();
                                        let _ = win.set_focus();
                                    }
                                    if let Some(win) = app.get_webview_window("overlay") {
                                        let _ = win.show();
                                        let _ = win.set_focus();
                                    }
                                }
                                "quit_rae" => {
                                    std::process::exit(0);
                                }
                                _ => {}
                            })
                            .build(&app_handle);

                        // Mark tray as created
                        if let Some(state) = app_handle.try_state::<TrayState>() {
                            if let Ok(mut created) = state.0.lock() {
                                *created = true;
                            }
                        }
                    }
                }
            }

            // Intercept main window close and hide to tray instead
            if let Some(main_window) = app.get_webview_window("main") {
                let _app_handle_clone = app_handle.clone();
                let app_handle_for_tray = app.handle().clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // Prevent app exit; hide main window and remove from taskbar
                        api.prevent_close();
                        if let Some(win) = app_handle_for_tray.get_webview_window("main") {
                            let _ = win.set_skip_taskbar(true);
                            let _ = win.hide();
                        }
                    }
                });
            }

            // Handle overlay window close event - hide instead of close
            if let Some(overlay_window) = app.get_webview_window("overlay") {
                let app_handle_for_overlay = app.handle().clone();
                overlay_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // Prevent overlay exit; hide overlay window and remove from taskbar
                        api.prevent_close();
                        if let Some(win) = app_handle_for_overlay.get_webview_window("overlay") {
                            let _ = win.set_skip_taskbar(true);
                            let _ = win.hide();
                        }
                    }
                });
            }

            Ok(())
        })
        // Register all the invokable commands from the `commands` module.
        .invoke_handler(tauri::generate_handler![
            functions::overlay::enable_notch,
            functions::overlay::force_top_center_magic_dot,
            functions::overlay::pin_magic_dot,
            services::window_capture::start_window_watch,
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
            services::text_injection::inject_text_to_window_by_hwnd,
            services::screenshot_service::capture_window_screenshot,
            services::screenshot_service::capture_window_screenshot_by_title,
            services::screenshot_service::capture_window_screenshot_by_hwnd,
            services::auto_start::set_auto_start_enabled,
            services::auto_start::get_auto_start_enabled,
            functions::supermemory::create_connection,
            create_tray,
            hide_main_to_tray,
            functions::app::show_app,
            functions::app::hide_app,
            functions::app::start_following_overlay,
            audio_client::start_audio_client,
            audio_client::stop_audio_client,
            audio_client::is_audio_client_running
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
