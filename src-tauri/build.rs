fn main() {
    // Inject macOS Info.plist permissions
    #[cfg(target_os = "macos")]
    {
        // Tell cargo to rerun if Info.plist changes
        println!("cargo:rerun-if-changed=Info.plist");
        
        // Set environment variable for Tauri to use custom Info.plist
        if std::path::Path::new("Info.plist").exists() {
            println!("cargo:rustc-env=MACOSX_DEPLOYMENT_TARGET=10.13");
        }
    }
    
    tauri_build::build()
}
