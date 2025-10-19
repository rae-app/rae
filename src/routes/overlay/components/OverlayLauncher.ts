// magicDotLauncher.ts
// import { Window } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { Effect } from "@tauri-apps/api/window";

// Guard flag to prevent concurrent window creation (fixes StrictMode double-render issue)
let isCreatingOverlay = false;

// Creates (or reuses) the magic dot window and ensures it is visible and focused.
// Emits `collapse_to_dot` so the UI starts in the small dot state.
export const LaunchOverlayWindow = async () => {
  try {
    const WIDTH = 500; // broadened bar
    const HEIGHT = 60; // buffer to avoid clipping

    // If window already exists, just resize, position, and focus it
    const existing = await WebviewWindow.getByLabel("overlay");
    if (existing) {
      console.log("Overlay window already exists, reusing it");
      try {
        await existing.setSize(new LogicalSize(WIDTH, HEIGHT));
      } catch (_) {}
      await existing.show();
      await existing.setFocus();
      await existing.setAlwaysOnTop(true);

      // Position at top center
      try {
        await existing.emit("force_top_center_magic_dot");
      } catch (_) {}

      // Keep expanded - don't collapse to notch initially
      // The user wants it always pinned at top center
      // try {
      //   await existing.emit("collapse_to_dot");
      // } catch (_) {}
      return existing;
    }

    // Prevent concurrent creation (race condition from React StrictMode)
    if (isCreatingOverlay) {
      console.log("Overlay window creation already in progress, waiting...");
      // Wait a bit and try to get the existing window
      await new Promise(resolve => setTimeout(resolve, 100));
      const nowExisting = await WebviewWindow.getByLabel("overlay");
      if (nowExisting) {
        return nowExisting;
      }
    }

    isCreatingOverlay = true;

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

    // Position at top center
    try {
      await overlayWindow.emit("force_top_center_magic_dot");
    } catch (_) {}

    // Keep expanded initially - don't collapse to notch
    // The user wants it always pinned at top center
    // try {
    //   await overlayWindow.emit("collapse_to_dot");
    // } catch (_) {}

    console.log("Magic dot window shown and positioned at top center");
    isCreatingOverlay = false; // Reset flag after successful creation
    return overlayWindow;
  } catch (error) {
    console.error("Failed to create magic dot window:", error);
    isCreatingOverlay = false; // Reset flag on error
    throw error;
  }
};
