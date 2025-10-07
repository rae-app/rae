#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Declare the modules that make up the application logic.
mod functions;
mod platform;
mod utils;
mod audio_client;
mod services;

// Import required traits
use audio_client::AudioState;

use std::sync::Mutex;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri::State;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

struct TrayState(Mutex<bool>);

// Consolidated system tray creation function
fn create_system_tray(
    app: &tauri::AppHandle,
    tray_state: tauri::State<TrayState>,
    show_overlay: bool,
    skip_taskbar_handling: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut created = tray_state.0.lock().map_err(|_| "Failed to lock tray state")?;

    if *created {
        return Ok(());
    }

    let show_item = MenuItemBuilder::with_id("show_rae", "Show Rae").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit_rae", "Quit").build(app)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let tray_builder = TrayIconBuilder::new()
        .icon(load_tray_icon())
        .menu(&menu);

    // Configure tray icon events based on parameters
    let tray_builder = if skip_taskbar_handling {
        // For hide_main_to_tray: handle taskbar visibility
        tray_builder.on_tray_icon_event(|tray, event: TrayIconEvent| {
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
    } else {
        // For create_tray and main setup: simple click handling
        tray_builder.on_tray_icon_event(move |tray, event: TrayIconEvent| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                ..
            }
            | TrayIconEvent::DoubleClick { .. } => {
                let app = tray.app_handle();
                // Show main window
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
                // Show overlay window if requested
                if show_overlay {
                    if let Some(win) = app.get_webview_window("overlay") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
            _ => {}
        })
    };

    // Configure menu events (same for all)
    let tray_builder = tray_builder.on_menu_event(move |app, event| match event.id().as_ref() {
        "show_rae" => {
            // Show main window
            if let Some(win) = app.get_webview_window("main") {
                if skip_taskbar_handling {
                    let _ = win.set_skip_taskbar(false);
                }
                let _ = win.show();
                let _ = win.set_focus();
            }
            // Show overlay window if requested
            if show_overlay {
                if let Some(win) = app.get_webview_window("overlay") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        }
        "quit_rae" => {
            std::process::exit(0);
        }
        _ => {}
    });

    tray_builder.build(app)?;
    *created = true;
    Ok(())
}

fn load_tray_icon() -> Image<'static> {
    let bytes = include_bytes!("../icons/32x32.png");
    Image::from_bytes(bytes).expect("invalid tray icon image")
}
#[tauri::command]
fn hide_main_to_tray(app: tauri::AppHandle, tray_state: State<TrayState>) {
    // Create tray if it doesn't exist
    let _ = create_system_tray(&app, tray_state, false, true);

    // Hide and remove taskbar presence
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_skip_taskbar(true);
        let _ = win.hide();
    }
}

#[tauri::command]
fn create_tray(app: tauri::AppHandle, tray_state: State<TrayState>) {
    let _ = create_system_tray(&app, tray_state, false, false);
}

fn main() {
    // Initialize tracing subscriber for structured logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("setting default subscriber failed");

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
    app.manage(AudioState);
            // Log successful startup
            info!("Rae app started successfully");

            // Create tray immediately on startup
            let tray_state = app.state::<TrayState>();
            let _ = create_system_tray(&app_handle, tray_state, true, false);

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
            functions::overlay::follow_magic_dot,
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
            services::text_injection::inject_text_to_window_by_title,
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
