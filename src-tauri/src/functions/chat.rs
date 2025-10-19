use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;

static AUTO_SHOW_ON_COPY: AtomicBool = AtomicBool::new(false);
static CLIPBOARD_WATCHER_RUNNING: AtomicBool = AtomicBool::new(false);
static AUTO_SHOW_ON_SELECTION: AtomicBool = AtomicBool::new(false);
static SELECTION_WATCHER_RUNNING: AtomicBool = AtomicBool::new(false);
static RAE_WATCHER_ENABLED: AtomicBool = AtomicBool::new(false);
static RAE_WATCHER_RUNNING: AtomicBool = AtomicBool::new(false);
static NOTCH_WINDOW_DISPLAY_ENABLED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn set_auto_show_on_copy_enabled(_app: AppHandle, enabled: bool) {
    AUTO_SHOW_ON_COPY.store(enabled, Ordering::SeqCst);
    println!("Auto show on copy: {}", enabled);
}

#[tauri::command]
pub fn get_auto_show_on_copy_enabled() -> bool {
    AUTO_SHOW_ON_COPY.load(Ordering::SeqCst)
}

#[tauri::command]
pub fn set_auto_show_on_selection_enabled(_app: AppHandle, enabled: bool) {
    AUTO_SHOW_ON_SELECTION.store(enabled, Ordering::SeqCst);
    println!("Auto show on selection: {}", enabled);
}

#[tauri::command]
pub fn get_auto_show_on_selection_enabled() -> bool {
    AUTO_SHOW_ON_SELECTION.load(Ordering::SeqCst)
}

#[tauri::command]
pub fn set_rae_watcher_enabled(_app: AppHandle, enabled: bool) {
    RAE_WATCHER_ENABLED.store(enabled, Ordering::SeqCst);
    println!("RAE watcher: {}", enabled);
}

#[tauri::command]
pub fn get_rae_watcher_enabled() -> bool {
    RAE_WATCHER_ENABLED.load(Ordering::SeqCst)
}

#[tauri::command]
pub fn set_notch_window_display_enabled(enabled: bool) {
    NOTCH_WINDOW_DISPLAY_ENABLED.store(enabled, Ordering::SeqCst);
    println!("Notch window display: {}", enabled);
}

#[tauri::command]
pub fn get_notch_window_display_enabled() -> bool {
    NOTCH_WINDOW_DISPLAY_ENABLED.load(Ordering::SeqCst)
}