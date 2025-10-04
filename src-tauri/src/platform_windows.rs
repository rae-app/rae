//! This module contains Windows-specific functionality using the winapi crate.
//! It handles getting information about the active window, its process, and its icon.

use base64::{engine::general_purpose, Engine as _};
use image::{codecs::png::PngEncoder, ColorType, ImageBuffer, ImageEncoder, Rgba}; // <--- FIX IS HERE
use std::{
    ffi::OsString,
    os::windows::ffi::{OsStrExt, OsStringExt},
    path::PathBuf,
    ptr,
};
use winapi::{
    shared::windef::{HICON, HWND},
    um::{
        handleapi::CloseHandle,
        processthreadsapi::OpenProcess,
        psapi::GetModuleFileNameExW,
        shellapi::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON},
        wingdi::{
            GetDIBits, GetObjectW, BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
        },
        winnt::{PROCESS_QUERY_INFORMATION, PROCESS_VM_READ},
        winuser::{
            DestroyIcon, GetIconInfo, GetWindowThreadProcessId, GetWindowTextLengthW,
            GetWindowTextW, SendMessageW, ICONINFO, ICON_BIG, ICON_SMALL, ICON_SMALL2, WM_GETICON,
        },
    },
};

// Windows crate (WinRT/COM) for packaged app icons
#[cfg(target_os = "windows")]
mod packaged_icon {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStrExt;
    use base64::Engine;
    use image::ImageEncoder;
    use windows::core::{ComInterface, PCWSTR, PWSTR};
    use windows::Win32::Foundation::{HWND as WHWND, SIZE};
    use windows::Win32::Graphics::Gdi::{DeleteObject, GetDIBits, GetObjectW, HBITMAP as WHBITMAP, BITMAP as WBITMAP, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, GetDC, BI_RGB};
    use windows::Win32::UI::Shell::PropertiesSystem::{IPropertyStore, SHGetPropertyStoreForWindow, PROPERTYKEY};
    use windows::Win32::UI::Shell::{IShellItem, IShellItemImageFactory, SHCreateItemFromIDList, SHParseDisplayName, SIIGBF_ICONONLY};
    use windows::Win32::UI::Shell::Common::ITEMIDLIST;

    fn hbitmap_to_base64(hbmp: WHBITMAP) -> Option<String> {
        unsafe {
            let mut bmp = WBITMAP::default();
            if GetObjectW(hbmp, std::mem::size_of::<WBITMAP>() as i32, Some(&mut bmp as *mut _ as *mut _ )) == 0 { return None; }
            let width = bmp.bmWidth as u32;
            let height = bmp.bmHeight as u32;

            let mut bi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width as i32,
                    biHeight: -(height as i32),
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0 as u32,
                    ..Default::default()
                },
                ..Default::default()
            };

            let mut pixels = vec![0u8; (width * height * 4) as usize];
            if GetDIBits(GetDC(None), hbmp, 0, height, Some(pixels.as_mut_ptr() as *mut _), &mut bi, DIB_RGB_COLORS) == 0 { return None; }

            for chunk in pixels.chunks_mut(4) { chunk.swap(0, 2); }
            let img = image::ImageBuffer::<image::Rgba<u8>, _>::from_raw(width, height, pixels)?;
            let mut png_bytes = Vec::new();
            image::codecs::png::PngEncoder::new(&mut png_bytes).write_image(&img, width, height, image::ColorType::Rgba8).ok()?;
            Some(base64::engine::general_purpose::STANDARD.encode(&png_bytes))
        }
    }

    pub fn try_get_packaged_icon(hwnd: super::HWND) -> Option<String> {
        unsafe {
            let hwnd_w = WHWND(hwnd as isize);
            let store: IPropertyStore = SHGetPropertyStoreForWindow(hwnd_w).ok()?;
            // PKEY_AppUserModel_ID {9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}, pid 5
            let pkey = PROPERTYKEY{ fmtid: windows::core::GUID::from_values(0x9f4c2855,0x9f79,0x4b39,[0xa8,0xd0,0xe1,0xd4,0x2d,0xe1,0xd5,0xf3]), pid: 5};
            let var = store.GetValue(&pkey).ok()?;
            let pw = PWSTR(var.Anonymous.Anonymous.Anonymous.pwszVal.0);
            if pw.is_null() { return None; }
            let aumid = pw.to_string().ok()?;
            let target = format!("shell:AppsFolder\\{}", aumid);
            let target_w: Vec<u16> = OsString::from(target).encode_wide().chain(Some(0)).collect();

            let mut pidl: *mut ITEMIDLIST = std::ptr::null_mut();
            if SHParseDisplayName(PCWSTR(target_w.as_ptr()), None, &mut pidl, 0, None).is_err() || pidl.is_null() {
                return None;
            }
            let item: IShellItem = SHCreateItemFromIDList(pidl).ok()?;
            let imgf: IShellItemImageFactory = item.cast().ok()?;
            let hbmp: WHBITMAP = imgf.GetImage(SIZE{cx:32, cy:32}, SIIGBF_ICONONLY).ok()?;
            if hbmp.0 == 0 { return None; }
            let base64 = hbitmap_to_base64(hbmp);
            let _ = DeleteObject(hbmp);
            base64
        }
    }
}

/// Gets the full executable path from a window handle (HWND).
pub fn exe_path_from_hwnd(hwnd: HWND) -> Option<PathBuf> {
    unsafe {
        let mut pid = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }

        let process_handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
        if process_handle.is_null() {
            return None;
        }

        let mut buf = vec![0u16; 260]; // MAX_PATH
        let len = GetModuleFileNameExW(
            process_handle,
            ptr::null_mut(),
            buf.as_mut_ptr(),
            buf.len() as u32,
        );
        CloseHandle(process_handle);

        if len == 0 {
            return None;
        }

        buf.truncate(len as usize);
        Some(PathBuf::from(OsString::from_wide(&buf)))
    }
}

/// Extracts the icon from an executable file and returns it as a Base64 encoded PNG.
pub fn get_icon_base64_from_exe(exe_path: &PathBuf) -> Option<String> {
    unsafe {
        let mut shinfo: SHFILEINFOW = std::mem::zeroed();
        let exe_wide: Vec<u16> = exe_path.as_os_str().encode_wide().chain(Some(0)).collect();

        if SHGetFileInfoW(
            exe_wide.as_ptr(),
            0,
            &mut shinfo,
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        ) == 0
        {
            return None;
        }

        if shinfo.hIcon.is_null() {
            return None;
        }

        hicon_to_base64_png(shinfo.hIcon)
    }
}

/// Converts a Windows icon handle (HICON) to a Base64 encoded PNG string.
fn hicon_to_base64_png(hicon: HICON) -> Option<String> {
    unsafe {
        let mut icon_info: ICONINFO = std::mem::zeroed();
        if GetIconInfo(hicon, &mut icon_info) == 0 {
            return None;
        }

        let mut bmp: BITMAP = std::mem::zeroed();
        if GetObjectW(
            icon_info.hbmColor as _,
            std::mem::size_of::<BITMAP>() as i32,
            &mut bmp as *mut _ as *mut _,
        ) == 0
        {
            return None;
        }

        let width = bmp.bmWidth as u32;
        let height = bmp.bmHeight as u32;

        let mut bi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32), // top-down DIB
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB,
                ..std::mem::zeroed()
            },
            ..std::mem::zeroed()
        };

        let mut pixels = vec![0u8; (width * height * 4) as usize];
        if GetDIBits(
            winapi::um::winuser::GetDC(ptr::null_mut()),
            icon_info.hbmColor,
            0,
            height,
            pixels.as_mut_ptr() as *mut _,
            &mut bi,
            DIB_RGB_COLORS,
        ) == 0
        {
            return None;
        }

        // BGRA from GetDIBits to RGBA for the PNG encoder
        for chunk in pixels.chunks_mut(4) {
            chunk.swap(0, 2);
        }

        let img = ImageBuffer::<Rgba<u8>, _>::from_raw(width, height, pixels)?;
        let mut png_bytes = Vec::new();
        PngEncoder::new(&mut png_bytes)
            .write_image(&img, width, height, ColorType::Rgba8) // This line will now compile
            .ok()?;

        DestroyIcon(hicon);

        Some(general_purpose::STANDARD.encode(&png_bytes))
    }
}

/// Tries to fetch the actual window icon via WM_GETICON, then falls back to the
/// class icon. Returns Base64-encoded PNG when successful.
pub fn get_window_icon_base64_from_hwnd(hwnd: HWND) -> Option<String> {
    unsafe {
        // 1) Ask the window for its icon
        let mut hicon = SendMessageW(hwnd, WM_GETICON, ICON_BIG as usize, 0) as HICON;
        if hicon.is_null() {
            hicon = SendMessageW(hwnd, WM_GETICON, ICON_SMALL as usize, 0) as HICON;
        }
        if hicon.is_null() {
            hicon = SendMessageW(hwnd, WM_GETICON, ICON_SMALL2 as usize, 0) as HICON;
        }

        // 2) If still null, try the class icon
        if hicon.is_null() {
            #[cfg(target_pointer_width = "64")]
            {
                use winapi::um::winuser::{GetClassLongPtrW, GCLP_HICON, GCLP_HICONSM};
                hicon = GetClassLongPtrW(hwnd, GCLP_HICON) as HICON;
                if hicon.is_null() {
                    hicon = GetClassLongPtrW(hwnd, GCLP_HICONSM) as HICON;
                }
            }

            #[cfg(target_pointer_width = "32")]
            {
                use winapi::um::winuser::{GetClassLongW, GCL_HICON, GCL_HICONSM};
                hicon = GetClassLongW(hwnd, GCL_HICON) as HICON;
                if hicon.is_null() {
                    hicon = GetClassLongW(hwnd, GCL_HICONSM) as HICON;
                }
            }
        }

        if hicon.is_null() {
            return None;
        }

        hicon_to_base64_png(hicon)
    }
}

/// Gets the window title text for a given HWND.
pub fn get_window_title(hwnd: HWND) -> String {
    unsafe {
        let len = GetWindowTextLengthW(hwnd);
        if len == 0 {
            return String::new();
        }
        let mut buf: Vec<u16> = vec![0; (len + 1) as usize];
        let copied = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if copied <= 0 {
            return String::new();
        }
        OsString::from_wide(&buf[..copied as usize])
            .to_string_lossy()
            .into_owned()
    }
}

/// Placeholder: packaged app icon retrieval not available with current winapi features.
pub fn get_packaged_app_icon_from_hwnd(_hwnd: HWND) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        return packaged_icon::try_get_packaged_icon(_hwnd);
    }
    #[allow(unreachable_code)]
    { None }
}
