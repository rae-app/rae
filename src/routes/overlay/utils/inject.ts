import { invoke } from "@tauri-apps/api/core";

export const injectTextToWindow = async (text: string, hwnd: number) => {
  if (!hwnd) return;
  try {
    await invoke("inject_text_to_window_by_hwnd", { text, hwnd });
  } catch (err) {
    console.error("injectTextToWindow failed:", err);
  }
};
