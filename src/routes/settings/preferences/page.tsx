import { invoke } from "@tauri-apps/api/core";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useDarkThemeStore } from "../../../store/darkThemeStore";
import { emit, listen } from "@tauri-apps/api/event";

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-5 py-2.5 border-b border-border">
      <span className="text-xs font-medium uppercase tracking-wide text-foreground/50">
        {title}
      </span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden ">
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: (next: boolean) => void | Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-sm text-foreground font-medium">{label}</span>
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className={`relative inline-flex h-5 w-10 outline transition-none outline-border  items-center rounded-sm  overflow-hidden ${
          enabled
            ? "bg-foreground dark:bg-surface"
            : "bg-foreground/20 hover:bg-foreground/30 "
        }`}
        aria-pressed={enabled}
      >
        <motion.div
          initial={{ x: enabled ? "100%" : "0%" }}
          animate={{ x: enabled ? "100%" : "0%" }}
          className="absolute rounded-sm z-50 left-0 h-full aspect-square bg-background flex items-center justify-center leading-0 text-center"
        ></motion.div>
      </button>
    </div>
  );
}

const Preferences = () => {
  const [autoShowOnCopy, setAutoShowOnCopy] = useState<boolean>(false);
  const [autoShowOnSelection, setAutoShowOnSelection] =
    useState<boolean>(false);
  const [notchWindowDisplay, setNotchWindowDisplay] = useState<boolean>(true);
  const [stealthMode, setStealthMode] = useState<boolean>(false);
  const [overlayResetToolAfterSend, setOverlayResetToolAfterSend] =
    useState<boolean>(
      localStorage.getItem("overlay_reset_tool_after_send") === "false"
        ? false
        : true,
    );
  const [autoStartEnabled, setAutoStartEnabled] = useState<boolean>(
    localStorage.getItem("auto_start_enabled") === "true",
  );
  const [bubbleSoundEnabled, setBubbleSoundEnabled] = useState<boolean>(
    localStorage.getItem("bubble_sound_enabled") !== "false", // Default to true
  );

  useEffect(() => {
    invoke<boolean>("get_auto_show_on_copy_enabled")
      .then((v) => setAutoShowOnCopy(!!v))
      .catch(() => {});
    invoke<boolean>("get_auto_show_on_selection_enabled")
      .then((v) => setAutoShowOnSelection(!!v))
      .catch(() => {});
    invoke<boolean>("get_notch_window_display_enabled")
      .then((v) => setNotchWindowDisplay(!!v))
      .catch(() => {});
    invoke<boolean>("get_stealth_mode_enabled")
      .then((v) => setStealthMode(!!v))
      .catch(() => {});
    invoke<boolean>("get_auto_start_enabled")
      .then(async (currentlyEnabled) => {
        // Check what was stored in localStorage
        const storedPreference = localStorage.getItem("auto_start_enabled") === "true";

        if (storedPreference && !currentlyEnabled) {
          // User wants it enabled but it's not currently enabled, so enable it
          try {
            await invoke("set_auto_start_enabled", { enabled: true });
            setAutoStartEnabled(true);
          } catch (error) {
            console.error("Failed to enable auto-start:", error);
            setAutoStartEnabled(false);
          }
        } else if (!storedPreference && currentlyEnabled) {
          // User wants it disabled but it's currently enabled, so disable it
          try {
            await invoke("set_auto_start_enabled", { enabled: false });
            setAutoStartEnabled(false);
          } catch (error) {
            console.error("Failed to disable auto-start:", error);
            setAutoStartEnabled(true);
          }
        } else {
          // State matches preference
          setAutoStartEnabled(currentlyEnabled);
        }
      })
      .catch(() => {
        // Fallback to localStorage if backend call fails
        const stored = localStorage.getItem("auto_start_enabled") === "true";
        setAutoStartEnabled(stored);
      });

    // Listen for stealth mode changes from other components
    const unlisten = listen("stealth_mode_changed", (event: any) => {
      setStealthMode(event.payload.enabled);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const { darkTheme, setDarkTheme, initializeTheme } = useDarkThemeStore();

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);


  return (
    <div className="w-full h-full bg-background text-foreground  overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <header className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">
            Preferences
          </div>
          <p className="text-sm text-zinc-500">Personalize your experience.</p>
        </header>

        <Card>
          <SectionHeader title="Automation" />
          <div className="divide-y divide-border">
            <ToggleRow
              label="Auto-show Magic Dot when text is copied"
              enabled={autoShowOnCopy}
              onToggle={async (next) => {
                setAutoShowOnCopy(next);
                try {
                  await invoke("set_auto_show_on_copy_enabled", {
                    enabled: next,
                  });
                } catch (_) {}
              }}
            />
            <ToggleRow
              label="Auto-show Magic Dot when text is selected"
              enabled={autoShowOnSelection}
              onToggle={async (next) => {
                setAutoShowOnSelection(next);
                try {
                  await invoke("set_auto_show_on_selection_enabled", {
                    enabled: next,
                  });
                } catch (_) {}
              }}
            />
            <ToggleRow
              label="Turn off analyze after send (Overlay)"
              enabled={overlayResetToolAfterSend}
              onToggle={async (next) => {
                setOverlayResetToolAfterSend(next);
                localStorage.setItem(
                  "overlay_reset_tool_after_send",
                  String(next),
                );
                emit("overlay_reset_tool_after_send_changed", { enabled: next });
              }}
            />
            <div>
              <ToggleRow
                label="Start Rae automatically on system startup"
                enabled={autoStartEnabled}
                onToggle={async (next) => {
                  setAutoStartEnabled(next);
                  localStorage.setItem("auto_start_enabled", String(next));
                  try {
                    await invoke("set_auto_start_enabled", {
                      enabled: next,
                    });
                    console.log(`Auto-start ${next ? 'enabled' : 'disabled'} successfully`);
                    if (next) {
                      alert("Auto-start enabled! The app will now run as administrator when Windows starts. You may see a UAC prompt on startup.");
                    }
                  } catch (error) {
                    console.error("Failed to toggle auto-start:", error);
                    // Revert the UI state if the operation failed
                    setAutoStartEnabled(!next);
                    localStorage.setItem("auto_start_enabled", String(!next));
                    alert(`Failed to ${next ? 'enable' : 'disable'} auto-start. Please run the app as administrator and try again.`);
                  }
                }}
              />
              {autoStartEnabled && (
                <div className="px-5 py-2 text-xs text-foreground/60">
                  Note: Rae will run with administrator privileges on startup to ensure all features work properly.
                </div>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <SectionHeader title="Privacy & Security" />
          <div className="divide-y divide-border">
            <ToggleRow
              label="Stealth Mode"
              enabled={stealthMode}
              onToggle={async (next) => {
                setStealthMode(next);
                try {
                  await invoke("set_stealth_mode_enabled", {
                    enabled: next,
                  });
                  emit("stealth_mode_changed", { enabled: next });
                } catch (error) {
                  console.error("Failed to toggle stealth mode:", error);
                }
              }}
            />
          </div>
        </Card>
        <Card>
          <SectionHeader title="Appearance" />
          <div className="divide-y divide-border">
            <ToggleRow
              label="Show window info in notch"
              enabled={notchWindowDisplay}
              onToggle={async (next) => {
                setNotchWindowDisplay(next);
                try {
                  await invoke("set_notch_window_display_enabled", {
                    enabled: next,
                  });
                  emit("notch_window_display_changed", next);
                } catch (_) {}
              }}
            />
          </div>
        </Card>
        <Card>
          <SectionHeader title="Sound" />
          <div className="divide-y divide-border">
            <ToggleRow
              label="Enable/Disable notch sound"
              enabled={bubbleSoundEnabled}
              onToggle={async (next) => {
                setBubbleSoundEnabled(next);
                localStorage.setItem("bubble_sound_enabled", String(next));
                emit("bubble_sound_enabled_changed", { enabled: next });
              }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Preferences;
