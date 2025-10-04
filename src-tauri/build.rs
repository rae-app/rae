fn main() {
    // Embed the manifest for administrator privileges
    #[cfg(target_os = "windows")]
    {
        let mut res = winres::WindowsResource::new();
        res.set_manifest_file("manifest.xml");
        res.compile().expect("Failed to compile resources");
    }

    tauri_build::build()
}
