//! This module contains general-purpose utility functions, like window animations.

use std::{thread, time::Duration};
use tauri::WebviewWindow;

/// Animates a window's size from a starting to an ending size over a series of steps.
pub fn smooth_resize(
    window: &WebviewWindow,
    from: tauri::PhysicalSize<u32>,
    to: tauri::PhysicalSize<u32>,
    steps: u32,
    delay: u64,
) {
    if steps == 0 {
        let _ = window.set_size(tauri::Size::Physical(to));
        return;
    }

    let from_w = from.width as f64;
    let from_h = from.height as f64;
    let to_w = to.width as f64;
    let to_h = to.height as f64;

    for i in 1..=steps {
        // Progress from 0.0 to 1.0
        let t = i as f64 / steps as f64;

        // Easing function (ease-out cubic)
        let ease = 1.0 - (1.0 - t).powi(3);

        let new_w = from_w + (to_w - from_w) * ease;
        let new_h = from_h + (to_h - from_h) * ease;

        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: new_w.round().max(1.0) as u32,
            height: new_h.round().max(1.0) as u32,
        }));

        thread::sleep(Duration::from_millis(delay));
    }

    // Ensure final size is exact
    let _ = window.set_size(tauri::Size::Physical(to));
}

/// Animates a window's position from a starting to an ending position over a series of steps.
pub fn smooth_move(
    window: &WebviewWindow,
    from: tauri::PhysicalPosition<i32>,
    to: tauri::PhysicalPosition<i32>,
    steps: u32,
    delay: u64,
) {
    if steps == 0 {
        let _ = window.set_position(tauri::Position::Physical(to));
        return;
    }

    let from_x = from.x as f64;
    let from_y = from.y as f64;
    let to_x = to.x as f64;
    let to_y = to.y as f64;

    for i in 1..=steps {
        // Progress from 0.0 to 1.0
        let t = i as f64 / steps as f64;

        // Easing function (ease-out cubic for smooth deceleration)
        let ease = 1.0 - (1.0 - t).powi(3);

        let new_x = from_x + (to_x - from_x) * ease;
        let new_y = from_y + (to_y - from_y) * ease;

        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: new_x.round() as i32,
            y: new_y.round() as i32,
        }));

        thread::sleep(Duration::from_millis(delay));
    }

    // Ensure final position is exact
    let _ = window.set_position(tauri::Position::Physical(to));
}
