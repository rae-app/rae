//! Native macOS screenshot capture using Core Graphics APIs
//! This is the macOS equivalent of Windows' PrintWindow API

use base64::{engine::general_purpose, Engine as _};
use cocoa::base::{id, nil};
use cocoa::foundation::NSAutoreleasePool;
use core_foundation::base::TCFType;
use core_graphics::display::{
    CGWindowListCreateImage, CGWindowImageOption, CGWindowListOption,
    kCGNullWindowID, kCGWindowImageDefault, kCGWindowListOptionIncludingWindow,
    kCGWindowImageBoundsIgnoreFraming, kCGWindowImageNominalResolution,
};
use core_graphics::geometry::{CGRect, CGPoint, CGSize};
use objc::{class, msg_send, sel, sel_impl};

pub type WindowId = u32;

/// Captures a screenshot of a specific window by its ID using native Core Graphics API
/// This is the macOS equivalent of Windows' `PrintWindow` function
pub fn capture_window_by_id_native(window_id: WindowId) -> Result<String, String> {
    println!("[macOS Screenshot] 📸 Attempting to capture window ID: {}", window_id);
    
    unsafe {
        // Use CGWindowListCreateImage - the native macOS API for capturing windows
        // This is similar to Windows' PrintWindow API
        // CGRectNull means use the window's natural bounds
        let null_rect = CGRect::new(
            &CGPoint::new(0.0, 0.0),
            &CGSize::new(0.0, 0.0),
        );
        
        println!("[macOS Screenshot] 🔧 Calling CGWindowListCreateImage with window_id={}", window_id);
        // Try with BoundsIgnoreFraming and NominalResolution for better capture
        let image_options = kCGWindowImageBoundsIgnoreFraming | kCGWindowImageNominalResolution;
        let mut image_ref = CGWindowListCreateImage(
            null_rect,
            kCGWindowListOptionIncludingWindow,
            window_id,
            image_options,
        );
        
        if image_ref.is_null() {
            eprintln!("[macOS Screenshot] ❌ CGWindowListCreateImage returned null for window {}", window_id);
            eprintln!("[macOS Screenshot] 🔄 Trying fallback with default options...");
            
            // Fallback to default options
            image_ref = CGWindowListCreateImage(
                null_rect,
                kCGWindowListOptionIncludingWindow,
                window_id,
                kCGWindowImageDefault,
            );
            
            if image_ref.is_null() {
                eprintln!("[macOS Screenshot] ❌ Fallback also failed - window may require Screen Recording permission");
                return Err(format!("Failed to capture window {} - please grant Screen Recording permission in System Settings > Privacy & Security > Screen Recording", window_id));
            }
            
            println!("[macOS Screenshot] ✅ Fallback succeeded with default options");
        }
        
        println!("[macOS Screenshot] ✅ CGWindowListCreateImage succeeded, image_ref is valid");
        
        // Convert CGImage to PNG using Cocoa's NSBitmapImageRep
        let pool = NSAutoreleasePool::new(nil);
        
        println!("[macOS Screenshot] 🔄 Converting CGImage to NSImage...");
        // Create NSImage from CGImage
        // Let NSImage auto-size from the CGImage
        let ns_image: id = msg_send![class!(NSImage), alloc];
        let ns_image: id = msg_send![ns_image, initWithCGImage:image_ref size:cocoa::foundation::NSSize { width: 0.0, height: 0.0 }];
        
        if ns_image == nil {
            let _: () = msg_send![pool, drain];
            core_foundation::base::CFRelease(image_ref as *const _);
            eprintln!("[macOS Screenshot] ❌ Failed to create NSImage from CGImage");
            return Err("Failed to create NSImage".to_string());
        }
        
        println!("[macOS Screenshot] ✅ NSImage created successfully");
        
        // Get TIFF representation
        let tiff_rep: id = msg_send![ns_image, TIFFRepresentation];
        if tiff_rep == nil {
            let _: () = msg_send![pool, drain];
            core_foundation::base::CFRelease(image_ref as *const _);
            return Err("Failed to get TIFF representation".to_string());
        }
        
        // Convert to NSBitmapImageRep
        let bitmap_rep_class = class!(NSBitmapImageRep);
        let bitmap_rep: id = msg_send![bitmap_rep_class, imageRepWithData: tiff_rep];
        if bitmap_rep == nil {
            let _: () = msg_send![pool, drain];
            core_foundation::base::CFRelease(image_ref as *const _);
            return Err("Failed to create bitmap representation".to_string());
        }
        
        // Convert to PNG
        let png_file_type: u64 = 4; // NSBitmapImageFileTypePNG
        let png_data: id = msg_send![bitmap_rep, representationUsingType:png_file_type properties:nil];
        if png_data == nil {
            let _: () = msg_send![pool, drain];
            core_foundation::base::CFRelease(image_ref as *const _);
            return Err("Failed to convert to PNG".to_string());
        }
        
        let length: usize = msg_send![png_data, length];
        let bytes: *const u8 = msg_send![png_data, bytes];
        
        if length == 0 || bytes.is_null() {
            let _: () = msg_send![pool, drain];
            core_foundation::base::CFRelease(image_ref as *const _);
            return Err("PNG data is empty".to_string());
        }
        
        let data_slice = std::slice::from_raw_parts(bytes, length);
        let base64_string = general_purpose::STANDARD.encode(data_slice);
        
        println!("[macOS Screenshot] ✅ Screenshot captured successfully!");
        println!("   📏 PNG size: {} bytes", length);
        println!("   📦 Base64 length: {} chars", base64_string.len());
        
        // Cleanup
        let _: () = msg_send![pool, drain];
        core_foundation::base::CFRelease(image_ref as *const _);
        
        Ok(format!("data:image/png;base64,{}", base64_string))
    }
}

