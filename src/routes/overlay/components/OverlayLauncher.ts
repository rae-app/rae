// magicDotLauncher.ts
// import { Window } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { Effect } from "@tauri-apps/api/window";
// Creates (or reuses) the magic dot window and ensures it is visible and focused.
// Emits `collapse_to_dot` so the UI starts in the small dot state.
export const LaunchOverlayWindow = async () => {
  try {
    const WIDTH = 500; // broadened bar
    const HEIGHT = 60; // buffer to avoid clipping

    // If window already exists, just resize and focus it
    const existing = await WebviewWindow.getByLabel("overlay");
    if (existing) {
      try {
        await existing.setSize(new LogicalSize(WIDTH, HEIGHT));
      } catch (_) {}
      await existing.show();
      await existing.setFocus();
      await existing.setAlwaysOnTop(true);
      // Ensuring
      // it starts collapsed dot state
      try {
        await existing.emit("collapse_to_dot");
      } catch (_) {}
      return existing;
    }

    // Create a new pre-configured window
    const overlayWindow = new WebviewWindow("overlay", {
      url: "/overlay",
      width: WIDTH,
      height: HEIGHT,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      shadow: false,
      fullscreen: false,
      maximizable: false,
    
      skipTaskbar: true, //that's all
    });

    // Set up event listeners
    overlayWindow.once("tauri://created", function () {
      console.log("Magic dot window successfully created");
    });

    overlayWindow.once("tauri://error", function (e) {
      console.error("Error creating magic dot window:", e);
    });

    await overlayWindow.show();
    await overlayWindow.setFocus();
    await overlayWindow.setAlwaysOnTop(true);
    try {
      await overlayWindow.emit("collapse_to_dot");
    } catch (_) {}

    console.log("Magic dot window shown");
    return overlayWindow;
  } catch (error) {
    console.error("Failed to create magic dot window:", error);
    throw error;
  }
};
