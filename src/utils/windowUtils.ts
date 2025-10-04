import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { currentMonitor } from "@tauri-apps/api/window";

export const resize = async (
  targetWidth: number,
  targetHeight: number,
  center: boolean = false,
) => {
  const win = getCurrentWebviewWindow();
  try {
    // console.log(monitorSize)
    await win.setSize(new LogicalSize(targetWidth, targetHeight));
    if (center) {
      const monitor = await currentMonitor();
      const monitorSize = monitor.size;
      const monitorPosition = monitor.position;
      const scaleFactor = monitor.scaleFactor;

      // Calculate center position accounting for scale factor
      const centerX =
        monitorPosition.x + (monitorSize.width - targetWidth * scaleFactor) / 2;

      // Position at top center (y = 0 for top)
      await win.setPosition(new LogicalPosition(centerX / scaleFactor, 0));

      console.log("Centered overlay at top:", {
        centerX: centerX / scaleFactor,
        y: 0,
        scaleFactor,
        targetWidth,
        monitorWidth: monitorSize.width,
      });
    }
  } catch (err) {
    console.error("Error during smooth resize:", err);
  }
};

export const smoothResize = async (
  targetWidth: number,
  targetHeight: number,
  duration = 20,
) => {
  const win = getCurrentWebviewWindow();
  try {
    const currentSize = await win.innerSize();
    let currentWidth = currentSize.width;
    let currentHeight = currentSize.height;
    const steps = 10;
    const stepDelay = duration / steps;
    const deltaWidth = (targetWidth - currentWidth) / steps;
    const deltaHeight = (targetHeight - currentHeight) / steps;
    for (let i = 1; i <= steps; i++) {
      currentWidth += deltaWidth;
      currentHeight += deltaHeight;
      await win.setSize(
        new LogicalSize(Math.round(currentWidth), Math.round(currentHeight)),
      );
      await new Promise((res) => setTimeout(res, stepDelay));
    }
    await win.setSize(new LogicalSize(targetWidth, targetHeight));
  } catch (err) {
    console.error("Error during smooth resize:", err);
  }
};

export function refreshStyles() {
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
    .forEach((link) => {
      const href = link.getAttribute("href")?.split("?")[0];
      if (href) {
        link.setAttribute("href", `${href}?v=${Date.now()}`);
      }
    });
}

export const pinMagicDot = async () => {
  try {
    await invoke("pin_magic_dot");
  } catch (err) {
    console.error("Failed to pin magic dot:", err);
  }
};
