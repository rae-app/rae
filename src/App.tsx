{
  /*
  This is the main app component.
  It is the root component for the app.
  It is used to wrap the app and provide the app shell.
  It is also used to provide the app context.
*/
}

import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useDarkThemeStore } from "./store/darkThemeStore";
import { invoke } from "@tauri-apps/api/core";
import {
  register,
  isRegistered,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";
import {
  MAGIC_DOT_TOGGLE_COMBO,
  MAGIC_DOT_TOGGLE_COOLDOWN_MS,
  SHOW_OVERLAY_CENTER_COMBO,
  SHOW_OVERLAY_CENTER_COOLDOWN_MS,
} from "./constants/shortcuts";
import Landing from "./routes/app/landing/page";
import Overlay from "./routes/overlay/components/OverlayCard";
import Onboarding from "./routes/app/onboarding/page";
import ChatWindow from "./routes/app/chat/page";
import ShortcutsPage from "./routes/settings/shortcuts/page";
import MainApp from "./routes/MainApp";
import { Settings } from "./routes/settings/page";
import Preferences from "./routes/settings/preferences/page";
import SettingsPage from "./routes/settings/Settings";
import Brain from "./routes/app/notes/page";
import Agents from "./routes/app/agents/page";
import { emit, listen } from "@tauri-apps/api/event";
import Agent from "./routes/app/agents/agent/page";
import Memory from "./routes/settings/memory/page";
import { LaunchOverlayWindow } from "./routes/overlay/components/OverlayLauncher";
import { useUserStore } from "./store/userStore";

function App() {
  const { darkTheme, initializeTheme } = useDarkThemeStore();
  // Register a global keyboard shortcut (Ctrl+H) to toggle the magic dot.
  // We use a small debounce to avoid rapid double-toggles when keys repeat.
  // Initialize darkTheme from localStorage on mount
  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  useEffect(() => {
    const combo = MAGIC_DOT_TOGGLE_COMBO;
    const cooldownMs = MAGIC_DOT_TOGGLE_COOLDOWN_MS;
    let lastFired = 0;
    const setup = async () => {
      try {
        try {
          if (await isRegistered(combo)) {
            await unregister(combo);
          }
        } catch (e) {
          console.warn("isRegistered/unregister failed; continuing", e);
        }
        await register(combo, async () => {
          console.log("Global shortcut pressed:", combo);
          const now = Date.now();
          if (now - lastFired < cooldownMs) {
            return;
          }
          lastFired = now;
          try {
            await invoke("toggle_magic_dot");
            console.log("Invoked toggle_magic_dot");
          } catch (e) {
            console.error("Failed to toggle magic dot", e);
          }
        });
        const ok = await isRegistered(combo);
      } catch (e) {
        console.error("Failed to register global shortcut", e);
      }
    };
    setup();
    return () => {
      unregister(combo).catch(() => {});
    };
  }, []);

  // Register Ctrl+M shortcut to show overlay in center
  useEffect(() => {
    const combo = SHOW_OVERLAY_CENTER_COMBO;
    const cooldownMs = SHOW_OVERLAY_CENTER_COOLDOWN_MS;
    let lastFired = 0;
    const setup = async () => {
      try {
        try {
          if (await isRegistered(combo)) {
            await unregister(combo);
          }
        } catch (e) {
          console.warn("isRegistered/unregister failed; continuing", e);
        }
        await register(combo, async () => {
          console.log("Global shortcut pressed:", combo);
          const now = Date.now();
          if (now - lastFired < cooldownMs) {
            return;
          }
          lastFired = now;
          try {
            await invoke("center_overlay_bar");
          } catch (e) {
            console.error("Failed to show overlay center", e);
          }
        });
        const ok = await isRegistered(combo);
      } catch (e) {
        console.error("Failed to register global shortcut", e);
      }
    };
    setup();
    return () => {
      unregister(combo).catch(() => {});
    };
  }, []);

  // Register Ctrl+M shortcut to center overlay bar
  useEffect(() => {
    const combo = "Ctrl+M";
    const cooldownMs = 300;
    let lastFired = 0;
    const setup = async () => {
      try {
        try {
          if (await isRegistered(combo)) {
            await unregister(combo);
          }
        } catch (e) {
          console.warn("isRegistered/unregister failed; continuing", e);
        }
        await register(combo, async () => {
          console.log("Global shortcut pressed:", combo);
          const now = Date.now();
          if (now - lastFired < cooldownMs) {
            return;
          }
          lastFired = now;
          try {
            await invoke("center_overlay_bar");
            console.log("Invoked center_overlay_bar");
          } catch (e) {
            console.error("Failed to center overlay bar", e);
          }
        });
        const ok = await isRegistered(combo);
        console.log("Registered global shortcut:", combo, ok);
      } catch (e) {
        console.error("Failed to register global shortcut", e);
      }
    };
    setup();
    return () => {
      unregister(combo).catch(() => {});
    };
  }, []);

  // Register Ctrl+P shortcut to toggle pin state
  useEffect(() => {
    const combo = "Ctrl+P";
    const cooldownMs = 300;
    let lastFired = 0;
    const setup = async () => {
      try {
        try {
          if (await isRegistered(combo)) {
            await unregister(combo);
          }
        } catch (e) {
          console.warn("isRegistered/unregister failed; continuing", e);
        }
        await register(combo, async () => {
          console.log("Global shortcut pressed:", combo);
          const now = Date.now();
          if (now - lastFired < cooldownMs) {
            return;
          }
          lastFired = now;
          try {
            await invoke("toggle_pin_overlay");
            console.log("Invoked toggle_pin_overlay");
          } catch (e) {
            console.error("Failed to toggle pin overlay", e);
          }
        });
        const ok = await isRegistered(combo);
        console.log("Registered global shortcut:", combo, ok);
      } catch (e) {
        console.error("Failed to register global shortcut", e);
      }
    };
    setup();
    return () => {
      unregister(combo).catch(() => {});
    };
  }, []);

  // Listen for events and conditionally start watchers based on saved settings
  useEffect(() => {
    let unlisten: undefined | (() => void);
    let unlistenSel: undefined | (() => void);
    let unlistenRae: undefined | (() => void);
    async function setup() {
      try {
        // If previously enabled, ensure watcher thread is running after reload
        const enabled = await invoke<boolean>("get_auto_show_on_copy_enabled");
        if (enabled) {
          await invoke("set_auto_show_on_copy_enabled", { enabled: true });
        }
      } catch (_) {}
      try {
        // Respect saved selection-watcher setting; do not force-enable
        const selEnabled = await invoke<boolean>(
          "get_auto_show_on_selection_enabled",
        );
        if (selEnabled) {
          await invoke("set_auto_show_on_selection_enabled", { enabled: true });
        }
      } catch (_) {}
      try {
        // Enable rae watcher and check if it was previously enabled
        const raeEnabled = await invoke<boolean>("get_rae_watcher_enabled");
        if (raeEnabled) {
          await invoke("set_rae_watcher_enabled", { enabled: true });
        } else {
          // Enable by default - you can change this behavior if needed
          await invoke("set_rae_watcher_enabled", { enabled: true });
        }
      } catch (_) {}
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<{ text: string }>(
          "clipboard_text_copied",
          async () => {
            try {
              await invoke("show_magic_dot");
            } catch (_) {}
          },
        );
        unlistenSel = await listen<{ text: string }>(
          "text_selected",
          async () => {
            try {
              await invoke("show_magic_dot");
            } catch (_) {}
          },
        );
        unlistenRae = await listen("rae_mentioned", async () => {
          try {
            console.log("@rae detected! Showing magic dot...");
            await invoke("show_magic_dot");
          } catch (e) {
            console.error("Failed to show magic dot on @rae", e);
          }
        });
      } catch (_) {}
    }
    setup();
    return () => {
      if (unlisten) unlisten();
      if (unlistenSel) unlistenSel();
      if (unlistenRae) unlistenRae();
    };
  }, []);

  // Actively update the root html class when darkTheme changes
  useEffect(() => {
    const root = document.documentElement;
    if (darkTheme) {
      root.classList.add("dark");
      root.classList.remove("light");
      emit("theme", { darkTheme: true });
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      emit("theme", { darkTheme: false });
    }
  }, [darkTheme]);

  useEffect(() => {
    const unlisten = listen(
      "theme",
      ({ payload }: { payload: { darkTheme: boolean } }) => {
        console.log("Got theme update", payload);
        const root = document.documentElement;
        if (payload.darkTheme) {
          root.classList.add("dark");
          root.classList.remove("light");
        } else {
          root.classList.remove("dark");
          root.classList.add("light");
        }
      },
    );

    return () => {
      unlisten.then((unlisten) => unlisten());
    };
  });
  const {loggedIn} = useUserStore();
useEffect(() => {
    // Only launch the magic dot when logged in
    if (loggedIn) {
      LaunchOverlayWindow();
    }
  }, [loggedIn]);
  return (
    // <div className="size-full bg-background rounded-lg overflow-hidden">
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/overlay" element={<Overlay />} />
      <Route path="/app" element={<MainApp />}>
        <Route path="landing" element={<Landing />} />
        <Route path="chat" element={<ChatWindow />} />
        <Route path="shortcuts" element={<ShortcutsPage />} />
        <Route path="agents" element={<Agents />} />
        <Route path="agents/:agent" element={<Agent />} />
        <Route path="brain" element={<Brain />} />
        <Route path="settings" element={<Settings />}>
          <Route path="" element={<SettingsPage />}></Route>
          <Route path="shortcuts" element={<ShortcutsPage />} />
          <Route path="preferences" element={<Preferences />} />
          <Route path="memory" element={<Memory />} />
        </Route>
      </Route>
    </Routes>
    // </div>
  );
}

export default App;
