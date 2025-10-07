# Cross-Platform Implementation Guide for Rae on macOS

This document outlines the complete implementation strategy to make Rae work on both Windows and macOS.

## Overview

Rae currently uses Windows-specific APIs (winapi, Win32) for core functionality. To support macOS, we need to:

1. Use conditional compilation (`#[cfg(target_os = "...")]`)
2. Implement macOS equivalents using Cocoa, Core Graphics, and Accessibility APIs
3. Maintain the same external API surface for the frontend

## Changes Made

### 1. Cargo.toml Updates

**Status**: ✅ COMPLETED

The `Cargo.toml` has been updated to separate Windows and macOS dependencies:

```toml
[target.'cfg(target_os = "windows")'.dependencies]
winapi = { ... }
windows = { ... }
uiautomation = "0.22.2"

[target.'cfg(target_os = "macos")'.dependencies]
cocoa = "0.25"
core-foundation = "0.9"
core-graphics = "0.23"
objc = "0.2"
objc-foundation = "0.1"
accessibility = "0.2"
accessibility-sys = "0.2"
xcap = "0.0.10"
```

### 2. Platform Module Structure

**Status**: ✅ COMPLETED

Created three files:
- `src/platform.rs` - Unified interface
- `src/platform_windows.rs` - Windows implementation (renamed from platform.rs)
- `src/platform_macos.rs` - macOS implementation (NEW)

The platform module exports:
- `WindowHandle` - Platform-specific window identifier
- `WindowOperations` trait - Common window operations
- Functions for icon extraction, screenshots, etc.

### 3. Platform-Specific Implementations

#### 3.1 Window Management

**Windows (platform_windows.rs)**:
```rust
pub fn get_window_title(hwnd: HWND) -> String
pub fn exe_path_from_hwnd(hwnd: HWND) -> Option<PathBuf>
```

**macOS (platform_macos.rs)**:
```rust
pub fn get_active_window_id() -> Option<WindowId>
pub fn get_window_title(window_id: WindowId) -> String
pub fn get_pid_from_window_id(window_id: WindowId) -> Option<i32>
pub fn exe_path_from_window_id(window_id: WindowId) -> Option<PathBuf>
```

**macOS APIs Used**:
- `CGWindowListCopyWindowInfo` - Get list of all windows
- `NSWorkspace.frontmostApplication` - Get active app
- Window dictionaries contain: `kCGWindowNumber`, `kCGWindowName`, `kCGWindowOwnerPID`, `kCGWindowOwnerName`

#### 3.2 Icon Extraction

**Windows**:
- Uses `SHGetFileInfoW` to extract .exe icons
- Uses `GetIconInfo` and HICON manipulation
- Converts to PNG via `GetDIBits`

**macOS**:
```rust
pub fn get_icon_base64_from_path(app_path: &PathBuf) -> Option<String>
pub fn get_window_icon_base64_from_window_id(window_id: WindowId) -> Option<String>
```

**macOS APIs Used**:
- `NSWorkspace.iconForFile(path)` - Get app icon
- `NSRunningApplication.icon` - Get running app icon
- `NSBitmapImageRep` - Convert to PNG
- Convert to base64

#### 3.3 Screenshot Capture

**Windows**:
- Full screen: `BitBlt` with screen DC
- Window: `PrintWindow` API
- Bitmap extraction: `GetDIBits`

**macOS**:
```rust
pub fn capture_full_screenshot() -> Result<String, String>
pub fn capture_window_screenshot_by_id(window_id: WindowId) -> Result<String, String>
```

**macOS APIs Used**:
- `xcap` crate (uses `CGWindowListCreateImage` internally)
- `Monitor::all()` - Get all displays
- `Window::all()` - Get all windows
- Direct image capture without DC manipulation

#### 3.4 Text Injection (Clipboard + Paste)

**Windows**:
```rust
fn inject_text_via_clipboard(text: String, hwnd: HWND) -> Result<(), String>
```
- Uses `OpenClipboard`, `SetClipboardData` with UTF-16
- Uses `SendInput` for Ctrl+V simulation

**macOS** (NEEDS IMPLEMENTATION):
```rust
fn inject_text_via_clipboard(text: String, window_id: WindowId) -> Result<(), String>
```

**macOS APIs Needed**:
- `NSPasteboard.generalPasteboard` - Access clipboard
- `pasteboard.clearContents` - Clear clipboard
- `pasteboard.writeObjects` - Write text
- `CGEventPost` - Post keyboard events for Cmd+V
- Key codes: 0x37 (Command), 0x09 (V key)

**Implementation**:
```rust
unsafe {
    let pool = NSAutoreleasePool::new(nil);
    let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];
    let _: () = msg_send![pasteboard, clearContents];

    let ns_string = NSString::from_str(&text);
    let array: id = msg_send![class!(NSArray), arrayWithObject: ns_string];
    let success: bool = msg_send![pasteboard, writeObjects: array];

    // Create CGEvent for Cmd+V
    let source = CGEventSource::new(CGEventSourceStateID::CombinedSessionState)?;
    let cmd_down = CGEvent::new_keyboard_event(source.clone(), 0x37, true)?;
    cmd_down.post(CGEventTapLocation::HID);
    // ... V key events ...
}
```

### 4. Functions Requiring macOS Implementation

#### 4.1 functions/general.rs

**Status**: 🔄 PARTIALLY COMPLETED

**✅ Completed**:
- `start_window_watch()` - Updated to use platform abstraction
- `capture_window_screenshot()` - Windows version working
- `capture_window_screenshot_by_hwnd()` - Routing implemented

**⚠️ Needs Work**:
- `inject_text_to_window_by_title()` - macOS window finding by title
- `inject_text_via_clipboard()` - macOS clipboard + keyboard events (stub created)

#### 4.2 functions/chat.rs

**Status**: ❌ NOT STARTED

**Windows Implementation Uses**:
1. **Clipboard Monitoring**: `GetClipboardSequenceNumber()` in a loop
2. **Keyboard Hook**: `SetWindowsHookExW(WH_KEYBOARD_LL, ...)` for global key events
3. **Text Selection**: `UIAutomation` COM API (`IUIAutomationTextPattern`)

**macOS Equivalents Needed**:

1. **Clipboard Monitoring**:
```rust
// Use NSPasteboard.changeCount
let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];
let change_count: i64 = msg_send![pasteboard, changeCount];
// Compare with previous count
```

2. **Keyboard Monitoring**:
```rust
// Use CGEventTap
use core_graphics::event::{CGEventTap, CGEventType, CGEventTapCallback};

let event_mask = (1 << CGEventType::KeyDown) | (1 << CGEventType::KeyUp);
let tap = CGEventTap::new(
    CGEventTapLocation::Session,
    CGEventTapPlacement::HeadInsertEventTap,
    CGEventTapOptions::Default,
    event_mask,
    callback_fn,
)?;
```

3. **Text Selection Detection**:
```rust
// Use
