import { useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { smoothResize, resize, refreshStyles } from "@/utils/windowUtils";
import { AnimatePresence, motion } from "framer-motion";
import { OverlayButton } from "./OverlayComponents";
import { ChatView } from "./ChatCard";
import {
  X,
  Mic,
  Maximize,
  Palette,
  MessageSquare,
  Settings,
  FileText,
  Minimize2,
  Maximize2,
} from "lucide-react";
import notchSound from "../../../assets/sounds/bubble-pop-06-351337.mp3";
import { invoke } from "@tauri-apps/api/core";
import { animations } from "@/constants/animations";
import { useUserStore } from "@/store/userStore";
import { useNoteStore } from "@/store/noteStore";
import { GetNotes } from "@/api/notes";
import {
  ArrowElbowDownLeftIcon,
  ChatIcon,
  CornersOutIcon,
  EarIcon,
  EarSlashIcon,
  FileTextIcon,
  GearSixIcon,
  MicrophoneIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useAtom } from "jotai";
import { showAppAtom } from "@/store/appStore";
import RaeWatcher from "./RaeWatcher";
const DEFAULT_CHAT = [480, 470];

const EXPANDED_WIDTH = 248;

const NOTCH_TIMEOUT = 5000;

// Constants for notch styling
const NOTCH_SHADOW = `
  0 8px 32px rgba(0, 0, 0, 0.3),
  inset 0 1px 0 rgba(255, 255, 255, 0.2),
  inset 0 -1px 0 rgba(0, 0, 0, 0.1),
  0 0 0 1px rgba(255, 255, 255, 0.1)
`;

const GRADIENT_OPACITY = "";

// Function to play notch collapse sound with sync with notch animation
const playNotchSound = (soundEnabled: boolean) => {
  // Check if bubble sound is enabled in settings
  if (!soundEnabled) {
    return; // Don't play sound if disabled
  }

  try {
    const audio = new Audio(notchSound);
    audio.volume = 0.3; // Set volume to 30%
    audio.play().catch((err) => console.log("Sound play failed:", err));
  } catch (error) {
    console.log("Audio playback error:", error);
  }
};

// DEV FLAG: Set to false to disable MagicDot for development
const DEV_MAGIC_DOT_ENABLED = true;

// Refs for global state
const DISABLE_NOTCH_ON_SHOW = { current: false };
const DISABLE_PIN_ON_SHOW = { current: false };
const DISABLE_SAFETY_NOTCH = { current: false };

/**
 * Helper functions for notch styling and layout
 * Designed to work like Dynamic Island - compact by default, expands on hover
 */
const getNotchClasses = (isNotch: boolean) => {
  const baseClasses = "flex flex-col  min-h-0 overflow-visible";

  if (!isNotch) return `${baseClasses} text-foreground`;

  // Transparent notch - only show RaeWatcher logo, no background
  // Position at top-0 to align with menu bar like system icons
  const notchClasses = "h-[28px] w-[60px] absolute overflow-visible top-0";
  const backgroundClasses = "bg-transparent";

  return `${baseClasses} ${notchClasses} ${backgroundClasses}`;
};

const getNotchStyle = (isNotch: boolean) =>
  isNotch
    ? {
        width: 60, // Width to show only RaeWatcher logo toggle (compact notch)
        height: 28,
        boxShadow: "none", // Remove shadow for transparent notch
        backgroundColor: "transparent", // Fully transparent
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }
    : {};

const Overlay = () => {
  // State for the overlay shell itself
  const [isPinned] = useState(true); // Always pinned now
  const isInitialShowRef = useRef(true); // Track if this is the first time overlay is shown
  const [inputText, setInputText] = useState(""); // For the main input bar
  const [listening, setlistening] = useState(false);
  const [assist, setAssist] = useState(false);
  const [assistMessage, setAssistMessage] = useState(
    "Hello! Assist mode is now active. How can I help you?",
  );
  const [audioClientActive, setAudioClientActive] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [bubbleSoundEnabled, setBubbleSoundEnabled] = useState<boolean>(
    () => localStorage.getItem("bubble_sound_enabled") !== "false", // Default to true
  );
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(
    () => localStorage.getItem("overlay_active") !== "false", // Default to true if not set
  );
  // Handler to spawn overlay-extended window

  const [windowName, setWindowName] = useState("");
  const [windowIcon, setWindowIcon] = useState("");
  const [windowHwnd, setWindowHwnd] = useState<number | null>(null);
  const [isNotch, setIsNotch] = useState(false);
  const [inputActive, setInputActive] = useState(false);
  const [initialShowComplete, setInitialShowComplete] = useState(false);
  // const [showApp, setShowApp] = useState(false)

  // Respect preference to stop analyzing after send
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    (async () => {
      unlistenFn = await listen("overlay_request_stop_analyze", () => {
        setIsActive(false);
        localStorage.setItem("overlay_active", "false");
      });
      invoke("hide_app");
    })();

    return () => {
      unlistenFn?.();
    };
  }, []);

  // State to control and pass data to the chat view
  const [showChat, setShowChat] = useState(false);
  const [initialChatMessage, setInitialChatMessage] = useState<
    string | undefined
  >();
  const [initialAttachedImage, setInitialAttachedImage] = useState<
    string | undefined
  >();
  // Maximize state
  const [isMaximized, setIsMaximized] = useState(false);
  const [currentPage, setCurrentPage] = useState("chat");

  // Refs for dragging and notch timeout
  const notchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputActiveRef = useRef(inputActive);
  const { email } = useUserStore();
  const { setNotes } = useNoteStore();
  const fetchNotes = async () => {
    try {
      const res = await GetNotes({ email });
      setNotes(res);
    } catch (err: any) {
      console.error("notes fetching me err agaya bhaijan", err);
    }
  };
  useEffect(() => {
    fetchNotes();
  }, []);

  // Save isActive state to localStorage whenever it changes
  useEffect(() => {
    console.log("🔄 Toggle state change detected, isActive:", isActive);
    console.log("   Current state:", {
      isActive,
      windowHwnd,
      windowName,
      hasIcon: !!windowIcon,
      currentScreenshotLength: windowScreenshot.length,
    });
    localStorage.setItem("overlay_active", String(isActive));
    console.log("💾 Overlay active state saved:", isActive);

    // Clear screenshot when toggle is turned off
    if (!isActive) {
      console.log("🗑️ Clearing screenshot - toggle turned off");
      console.log(
        "   Before clearing, windowScreenshot length:",
        windowScreenshot.length,
      );
      setWindowScreenshot("");
      setShowScreenshot(false);
      console.log("✅ Screenshot cleared - toggle turned off");
    } else {
      // Capture screenshot immediately when toggle is turned on
      if (windowHwnd != null) {
        console.log(
          "🔄 Capturing screenshot immediately after toggle enabled...",
        );
        console.log("📍 Current window info:", {
          windowHwnd,
          windowName,
          hasIcon: !!windowIcon,
        });

        invoke("capture_window_screenshot_by_hwnd", {
          hwnd: windowHwnd,
        })
          .then((screenshot: unknown) => {
            const screenshotStr = screenshot as string;
            console.log("✅ Immediate screenshot captured!");
            console.log("   📏 Length:", screenshotStr.length);
            if (screenshotStr.length > 0) {
              console.log("   🔤 Starts with:", screenshotStr.substring(0, 50));
              setWindowScreenshot(screenshotStr);
              console.log(
                "✅ windowScreenshot state updated for chat functionality",
              );
            } else {
              console.log("⚠️ Screenshot captured but empty");
            }
          })
          .catch((error) => {
            console.error("❌ Failed to capture immediate screenshot:", error);
            console.error("   Error details:", JSON.stringify(error, null, 2));
          });
      } else {
        console.log("⚠️ Cannot capture screenshot - windowHwnd is null");
      }
    }
  }, [isActive, windowHwnd]);

  // Keep ref in sync with state
  useEffect(() => {
    inputActiveRef.current = inputActive;
  }, [inputActive]);

  useEffect(() => {
    // Start window watch to monitor active windows
    // But screenshot capture only happens when isActive is true
    invoke("start_window_watch").catch(() => {});
    const unlistenPromise = listen<{
      name?: string;
      icon?: string;
      hwnd?: number;
    }>("active_window_changed", (event) => {
      if (
        event.payload.name &&
        !event.payload.name.toLowerCase().includes("tauri")
      ) {
        setWindowName(event.payload.name);
        setWindowIcon(event.payload.icon ?? "");
        if (typeof event.payload.hwnd === "number") {
          setWindowHwnd(event.payload.hwnd);
        }
      }
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Effect to handle resizing when chat is opened/closed or maximized
  useEffect(() => {
    if (!showChat) {
      resize(500, 60);
    } else if (showChat && !isMaximized) {
      // Exit fullscreen when minimizing
      const exitFullscreen = async () => {
        try {
          // const win = await getCurrentWebviewWindow();
          // await win.setFullscreen(false);
        } catch (error) {
          console.error("Failed to exit fullscreen:", error);
        }
      };
      // exitFullscreen();
      // Normal chat size
      resize(500, 580);
    }
  }, [showChat, isMaximized]);

  const [chatOpen, setChatOpen] = useState(false);
  const [notchWindowDisplayEnabled, setNotchWindowDisplayEnabled] =
    useState(false);

  // Remove jotai showAppAtom usage

  // Load window display preference on mount
  useEffect(() => {
    invoke<boolean>("get_notch_window_display_enabled")
      .then((v) => setNotchWindowDisplayEnabled(!!v))
      .catch(() => {});
  }, []);

  // Emit event to main window to show/hide app

  // Example: Call emitShowAppEvent(true) or emitShowAppEvent(false) where you previously setShowApp
  // For demonstration, emit event when chat is opened/closed

  // Listen for preference changes from settings
  useEffect(() => {
    const unlisten = listen("notch_window_display_changed", (event) => {
      const enabled = event.payload as boolean;
      setNotchWindowDisplayEnabled(enabled);
    });
    return () => {
      unlisten.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen("bubble_sound_enabled_changed", (event) => {
      const enabled = (event.payload as { enabled: boolean }).enabled;
      setBubbleSoundEnabled(enabled);
    });
    return () => {
      unlisten.then((unlisten) => unlisten());
    };
  }, []);

  // Effect for notch timeout
  useEffect(() => {
    // Clear any existing timeout
    if (notchTimeoutRef.current) {
      clearTimeout(notchTimeoutRef.current);
      notchTimeoutRef.current = null;
    }

    // If user starts typing, immediately clear notch
    if (inputActive && isNotch) {
      setIsNotch(false);
      return;
    }

    // Set notch timeout only after initial show (no pinning required), not in chat, not already notch, not typing, and notch not disabled
    if (
      !isInitialShowRef.current && // Don't auto-collapse on initial show
      !showChat &&
      !isNotch &&
      !inputActive &&
      !DISABLE_NOTCH_ON_SHOW.current
    ) {
      console.log("Setting notch timeout:", NOTCH_TIMEOUT, "ms");
      notchTimeoutRef.current = setTimeout(() => {
        // Double check that user isn't typing when timeout fires and notch not disabled
        if (!inputActiveRef.current && !DISABLE_NOTCH_ON_SHOW.current) {
          console.log("Enabling notch - all conditions met");
          invoke("enable_notch")
            .then(() => {
              console.log("Notch enabled successfully");
              setIsNotch(true);
              // Position to corner when entering notch mode
              invoke("force_top_center_magic_dot").catch(() => {});
              // Play sound with perfect timing - synced with smooth resize animation (200ms total, play at 100ms)
              setTimeout(() => playNotchSound(bubbleSoundEnabled), 60);
            })
            .catch((error) => {
              console.error("Failed to enable notch:", error);
            });
        } else {
          console.log("Notch conditions not met at timeout:", {
            inputActive: inputActiveRef.current,
            isPinned,
            disableNotch: DISABLE_NOTCH_ON_SHOW.current,
          });
        }
      }, NOTCH_TIMEOUT);
    } else {
      console.log("Not setting notch timeout - conditions not met:", {
        isPinned,
        showChat,
        isNotch,
        inputActive,
        disableNotch: DISABLE_NOTCH_ON_SHOW.current,
      });
    }

    // Safety mechanism: If we're pinned and conditions are mostly met but notch is disabled,
    // try to enable it after a shorter delay
    if (
      isPinned &&
      !showChat &&
      !inputActive &&
      DISABLE_NOTCH_ON_SHOW.current
    ) {
      console.log(
        "Safety: Setting fallback notch timeout (10s) due to disabled flag",
      );
      setTimeout(() => {
        if (
          isPinned &&
          !showChat &&
          !inputActive &&
          !DISABLE_SAFETY_NOTCH.current
        ) {
          console.log("Safety: Attempting to enable notch");
          DISABLE_NOTCH_ON_SHOW.current = false; // Reset the flag
          invoke("enable_notch")
            .then(() => {
              console.log("Safety: Notch enabled via fallback");
              setIsNotch(true);
              // Position to corner when entering notch mode
              invoke("force_top_center_magic_dot").catch(() => {});
              setTimeout(() => playNotchSound(bubbleSoundEnabled), 60);
            })
            .catch((error) => {
              console.error("Safety: Failed to enable notch:", error);
            });
        } else if (DISABLE_SAFETY_NOTCH.current) {
          console.log(
            "Safety: Skipping notch enable - safety flag is active (recent center operation)",
          );
        }
      }, 10000); // 10 second fallback
    }

    return () => {
      if (notchTimeoutRef.current) {
        clearTimeout(notchTimeoutRef.current);
        notchTimeoutRef.current = null;
      }
    };
  }, [isPinned, showChat, isNotch, inputActive, initialShowComplete]);

  const handleMouseEnter = () => {
    console.log(
      "🖱️ Mouse entered overlay - isNotch:",
      isNotch,
      "isPinned:",
      isPinned,
    );
    // Always clear any pending timeouts
    if (notchTimeoutRef.current) {
      clearTimeout(notchTimeoutRef.current);
      notchTimeoutRef.current = null;
      console.log("⏱️ Cleared notch timeout");
    }
    // Clear notch if it's showing and we're pinned
    if (isNotch && isPinned) {
      console.log("📊 Expanding notch to overlay bar");
      setIsNotch(false);
    }
  };
  useEffect(() => {
    const unlisten = listen("notch-hover", () => {
      // Expand the notch when the event is received
      console.log("👆 notch-hover event received - expanding notch");

      if (notchTimeoutRef.current) {
        clearTimeout(notchTimeoutRef.current);
        notchTimeoutRef.current = null;
      }

      setIsNotch(false);
    });
    return () => {
      unlisten.then((unlisten) => unlisten());
    };
  }, []);

  // Setup event listeners for overlay controls
  useEffect(() => {
    // Start notch watcher for hover detection
    invoke("start_notch_watcher").catch((error) => {
      console.error("Failed to start notch watcher:", error);
    });

    const eventListeners = [
      listen("disable_notch_on_show", () => {
        console.log("Disabling notch on show");
        DISABLE_NOTCH_ON_SHOW.current = true;
        setIsNotch(false);
        if (notchTimeoutRef.current) {
          clearTimeout(notchTimeoutRef.current);
          notchTimeoutRef.current = null;
        }
      }),

      listen("disable_pin_on_show", () => {
        console.log("Disabling auto-pin on show");
        DISABLE_PIN_ON_SHOW.current = true;
        // Mark that initial show has happened
        isInitialShowRef.current = false;
      }),

      listen("unpin_for_center", () => {
        if (notchTimeoutRef.current) {
          clearTimeout(notchTimeoutRef.current);
          notchTimeoutRef.current = null;
        }
      }),

      listen("center_overlay_bar", () => {
        console.log("OverlayCard: Received center_overlay_bar event");
        DISABLE_SAFETY_NOTCH.current = true;
        // Reset after a reasonable time (30 seconds)
        setTimeout(() => {
          DISABLE_SAFETY_NOTCH.current = false;
        }, 30000);
      }),

      // Listen for main window close to clean up overlay
      listen("main-window-closed", () => {
        console.log("OverlayCard: Main window closed, cleaning up overlay...");
        // Clean up any overlay-specific state here if needed
        // The backend will handle closing the overlay window
      }),
    ];

    return () => {
      eventListeners.forEach((promise) =>
        promise.then((unlisten) => unlisten()),
      );
    };
  }, []);

  // Mark initial show as complete after a delay to allow user interaction
  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialShowRef.current = false;
      setInitialShowComplete(true);
      console.log("Initial show complete - auto-collapse now enabled");
    }, 5000); // 5 seconds delay

    return () => clearTimeout(timer);
  }, []);

  // Handle assist mode changes - start/stop audio client
  useEffect(() => {
    const handleAssistModeChange = async () => {
      if (assist && !audioClientActive) {
        try {
          console.log("🎤 Starting audio client for assist mode...");
          setAssistMessage("Connecting to audio service...");

          // Check if audio client is already running
          const isRunning = await invoke("is_audio_client_running");
          console.log("Audio client status:", isRunning);

          if (!isRunning) {
            await invoke("start_audio_client");
            console.log("✅ Audio client command sent");
          }

          setAudioClientActive(true);

          // Give it time to initialize
          setTimeout(() => {
            setAssistMessage("Listening... Speak to interact with Rae.");
            console.log(" Audio client should be active now");
          }, 2000);
        } catch (error) {
          console.error("❌ Failed to start audio client:", error);
          setAssistMessage("Failed to start audio service");
          setAudioClientActive(false);

          // Retry after 3 seconds
          setTimeout(() => {
            if (assist) {
              setAssistMessage("Retrying audio connection...");
              handleAssistModeChange();
            }
          }, 3000);
        }
      } else if (!assist && audioClientActive) {
        console.log("🔇 Assist mode disabled, stopping audio client...");
        try {
          await invoke("stop_audio_client");
          console.log("✅ Audio client stopped successfully");
        } catch (error) {
          console.error("❌ Failed to stop audio client:", error);
        }
        setAudioClientActive(false);
        setAssistMessage(
          "Hello! Assist mode is now active. How can I help you?",
        );
      }
    };

    handleAssistModeChange();
  }, [assist, audioClientActive]);

  // Listen for audio responses from backend
  useEffect(() => {
    let unlistenAudioResponse: (() => void) | undefined;
    let responseTimeoutRef: NodeJS.Timeout | null = null;
    let statusCheckInterval: NodeJS.Timeout | null = null;

    const setupAudioResponseListener = async () => {
      try {
        console.log("🔗 Setting up audio response listener...");

        unlistenAudioResponse = await listen("audio_response", (event: any) => {
          const data = event.payload;
          console.log("📨 Audio response received:", data);

          // Clear any existing timeout
          if (responseTimeoutRef) {
            clearTimeout(responseTimeoutRef);
          }

          if (data.type === "response.text.delta") {
            console.log("📝 Delta text:", data.delta);
            // Update assist message with streaming text
            setAssistMessage((prev) => {
              // If this is the first delta, replace the default/listening message
              if (
                prev === "Listening... Speak to interact with Rae." ||
                prev ===
                  "Hello! Assist mode is now active. How can I help you?" ||
                prev === "Connecting to audio service..." ||
                prev === "Retrying audio connection..."
              ) {
                return typeof data.delta === "string" ? "💬 " + data.delta : "";
              }
              // Otherwise append to existing message
              return prev + (typeof data.delta === "string" ? data.delta : "");
            });
          }

          if (data.type === "response.text.done") {
            console.log("✅ Response completed");
            // After response is done, reset to listening state
            responseTimeoutRef = setTimeout(() => {
              if (assist && audioClientActive) {
                setAssistMessage("Listening... Speak to interact with Rae.");
              }
            }, 3000);
          }
        });

        console.log("✅ Audio response listener set up successfully");

        // Periodically check if audio client is still running
        statusCheckInterval = setInterval(async () => {
          if (assist && audioClientActive) {
            try {
              const isRunning = await invoke("is_audio_client_running");
              console.log("🔍 Audio client status check:", isRunning);

              if (!isRunning) {
                console.warn(
                  "⚠️ Audio client stopped unexpectedly, restarting...",
                );
                setAssistMessage("Reconnecting audio service...");
                await invoke("start_audio_client");
                setTimeout(() => {
                  setAssistMessage("Listening... Speak to interact with Rae.");
                }, 2000);
              }
            } catch (error) {
              console.error("❌ Status check failed:", error);
            }
          }
        }, 5000); // Check every 5 seconds
      } catch (error) {
        console.error("Failed to setup audio response listener:", error);
      }
    };

    if (assist && audioClientActive) {
      setupAudioResponseListener();
    }

    return () => {
      if (unlistenAudioResponse) {
        console.log("Cleaning up audio response listener");
        unlistenAudioResponse();
      }
      if (responseTimeoutRef) {
        clearTimeout(responseTimeoutRef);
      }
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [assist, audioClientActive]);

  // Debug keyboard shortcut (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        const debugInfo = {
          isPinned,
          showChat,
          isNotch,
          inputActive,
          disableNotch: DISABLE_NOTCH_ON_SHOW.current,
          timeoutActive: !!notchTimeoutRef.current,
          NOTCH_TIMEOUT,
        };

        console.log("=== NOTCH DEBUG INFO ===");
        console.table(debugInfo);
        console.log("========================");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPinned, showChat, isNotch, inputActive]);

  const handleMouseLeave = () => {
    // Only set timeout if conditions are met and notch not disabled
    if (
      isPinned &&
      !showChat &&
      !isNotch &&
      !inputActive &&
      !DISABLE_NOTCH_ON_SHOW.current
    ) {
      console.log("Mouse leave: Setting notch timeout");
      // Clear any existing timeout first
      if (notchTimeoutRef.current) {
        clearTimeout(notchTimeoutRef.current);
      }

      notchTimeoutRef.current = setTimeout(() => {
        // Double check conditions when timeout fires and notch not disabled
        if (
          !inputActiveRef.current &&
          isPinned &&
          !showChat &&
          !DISABLE_NOTCH_ON_SHOW.current
        ) {
          console.log("Mouse leave: Enabling notch - all conditions met");
          invoke("enable_notch")
            .then(() => {
              console.log("Mouse leave: Notch enabled successfully");
              setIsNotch(true);
              // Position to corner when entering notch mode
              invoke("force_top_center_magic_dot").catch(() => {});
              // Play sound with perfect timing - synced with smooth resize animation (200ms total, play at 100ms)
              setTimeout(() => playNotchSound(bubbleSoundEnabled), 60);
            })
            .catch((error) => {
              console.error("Mouse leave: Failed to enable notch:", error);
            });
        } else {
          console.log("Mouse leave: Notch conditions not met at timeout:", {
            inputActive: inputActiveRef.current,
            isPinned,
            showChat,
            disableNotch: DISABLE_NOTCH_ON_SHOW.current,
          });
        }
      }, NOTCH_TIMEOUT);
    } else {
      console.log(
        "Mouse leave: Not setting notch timeout - conditions not met:",
        {
          isPinned,
          showChat,
          isNotch,
          inputActive,
          disableNotch: DISABLE_NOTCH_ON_SHOW.current,
        },
      );
    }
  };

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (!isPinned && !isNotch) {
      // Check if clicking on interactive element
      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === "BUTTON" ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("textarea");

      if (isInteractive) {
        console.log("⚠️ Clicked on interactive element");
        return;
      }

      console.log(
        "🖱️ Attempting to drag - isPinned:",
        isPinned,
        "isNotch:",
        isNotch,
      );
      e.preventDefault();

      const window = getCurrentWebviewWindow();
      window
        .startDragging()
        .then(() => console.log("✅ Drag initiated"))
        .catch((error) => console.error("❌ Drag failed:", error));
    } else {
      console.log("⚠️ Drag blocked - isPinned:", isPinned, "isNotch:", isNotch);
    }
  };

  // Handle image paste
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setAttachedImage(base64);
            setImagePreview(base64);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  // Clear attached image
  const clearImage = () => {
    setAttachedImage(null);
    setImagePreview(null);
  };

  // *** MODIFIED: This function now just sets state to trigger the chat view ***
  const handleSendFromMainBar = () => {
    const userMsg = inputText.trim();
    if (!userMsg) return;

    // Store the attached image before clearing it
    const imageToSend = attachedImage;

    console.log("🎯 Overlay: Sending message with image:", {
      message: userMsg,
      hasImage: !!imageToSend,
      imageLength: imageToSend?.length || 0,
    });

    setChatOpen(true);
    setShowChat(true);
    setInputText("");
    setInputActive(false);
    setAttachedImage(null);
    setImagePreview(null);
    fetchNotes();
    setInitialChatMessage(userMsg);
    setInitialAttachedImage(imageToSend);
  };

  const handleOpenChat = () => {
    setInitialChatMessage(undefined); // Ensure no old message is passed
    setInitialAttachedImage(undefined); // Ensure no old attached image is passed
    setShowChat(true);
    setChatOpen(true);
    // setIsNotch(false);
    // Reset the disable notch flag when user manually opens chat
    DISABLE_NOTCH_ON_SHOW.current = false;
    if (notchTimeoutRef.current) clearTimeout(notchTimeoutRef.current);
    // Show main app when chat opens
  };

  const handleCloseChatClick = () => {
    setChatOpen(false);
    setTimeout(() => {
      setShowChat(false);
      // Hide main app when chat closes
    }, animations.overlayChat * 1000);
    // Clear screenshot when chat is closed
    setWindowScreenshot("");
    // Clear initial states
    setInitialChatMessage(undefined);
    setInitialAttachedImage(undefined);
  };

  const handleMaximizeClick = () => {
    setIsMaximized((current) => {
      if (current == true) {
        // handleCloseChatClick();
        emit("show_app", { show: false });
        resize(500, 580);
        // setShowChat(false)
      } else {
        // handleCloseChatClick();
        emit("show_app", { show: true });
        resize(500, 60);
      }
      return !current;
    });
  };

  // const [expandedChat, setExpandedChat] = useState(false);
  const [windowScreenshot, setWindowScreenshot] = useState<string>("");
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [isHoveringScreenshot, setIsHoveringScreenshot] = useState(false);
  const [isHoveringTrigger, setIsHoveringTrigger] = useState(false);
  const screenshotHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debug: Log state changes
  useEffect(() => {
    console.log(
      "Screenshot state changed - showScreenshot:",
      showScreenshot,
      "screenshot length:",
      windowScreenshot.length,
    );
  }, [showScreenshot, windowScreenshot]);

  // Manage screenshot visibility based on hover states
  useEffect(() => {
    const isAnyHovering = isHoveringTrigger || isHoveringScreenshot;
    console.log("👁️ Screenshot visibility effect triggered:", {
      isHoveringTrigger,
      isHoveringScreenshot,
      isAnyHovering,
      showScreenshot,
      hasScreenshot: !!windowScreenshot,
      screenshotLength: windowScreenshot.length,
    });

    if (isAnyHovering) {
      cancelScreenshotHide();
      if (!showScreenshot && windowScreenshot) {
        console.log("✨ Setting showScreenshot to true");
        setShowScreenshot(true);
      } else if (!windowScreenshot) {
        console.log("⚠️ Cannot show screenshot - windowScreenshot is empty");
      }
    } else {
      console.log("⏱️ Scheduling screenshot hide");
      scheduleScreenshotHide();
    }
  }, [
    isHoveringTrigger,
    isHoveringScreenshot,
    showScreenshot,
    windowScreenshot,
  ]);

  // Cleanup screenshot on unmount or when window changes
  useEffect(() => {
    return () => {
      if (screenshotHideTimeoutRef.current) {
        clearTimeout(screenshotHideTimeoutRef.current);
      }
      hideScreenshot();
    };
  }, []);

  // Clear screenshot when window changes
  useEffect(() => {
    hideScreenshot();
  }, [windowName, windowIcon, windowHwnd]);

  const cancelScreenshotHide = () => {
    if (screenshotHideTimeoutRef.current) {
      clearTimeout(screenshotHideTimeoutRef.current);
      screenshotHideTimeoutRef.current = null;
    }
  };

  const hideScreenshot = () => {
    setShowScreenshot(false);
    // Don't clear windowScreenshot here - keep it for chat functionality
    // setWindowScreenshot(""); // Commented out to preserve screenshot for chat
  };

  const scheduleScreenshotHide = () => {
    cancelScreenshotHide(); // Clear any existing timeout first
    screenshotHideTimeoutRef.current = setTimeout(() => {
      hideScreenshot();
      screenshotHideTimeoutRef.current = null;
    }, 200); // Reduced delay for better responsiveness
  };

  const handleScreenshotHover = async () => {
    console.log("🖱️ Hover triggered - capturing screenshot...");
    console.log("📊 Current state:", {
      isActive,
      windowHwnd,
      isHoveringTrigger,
      showScreenshot,
      windowScreenshotLength: windowScreenshot.length,
    });
    setIsHoveringTrigger(true);

    // Only capture screenshot if the green toggle is active
    if (!isActive) {
      console.log("⚠️ Screenshot capture skipped - green toggle is off");
      return;
    }

    if (windowHwnd == null) {
      console.log("⚠️ Screenshot capture skipped - windowHwnd is null");
      return;
    }

    try {
      console.log(
        `📸 Calling capture_window_screenshot_by_hwnd with hwnd=${windowHwnd}`,
      );
      const screenshot = (await invoke("capture_window_screenshot_by_hwnd", {
        hwnd: windowHwnd,
      })) as string;
      console.log("✅ Screenshot received!");
      console.log("   📏 Length:", screenshot.length);
      console.log("   🔤 Starts with:", screenshot.substring(0, 50));
      console.log("   ✨ Setting windowScreenshot state...");
      setWindowScreenshot(screenshot);
      console.log("✅ windowScreenshot state updated successfully");
    } catch (error) {
      console.error("❌ Failed to capture screenshot:", error);
    }
  };

  const handleScreenshotLeave = () => {
    console.log("Left trigger area");
    setIsHoveringTrigger(false);
  };

  const handleTooltipHover = () => {
    console.log("Hovering over tooltip");
    setIsHoveringScreenshot(true);
  };

  const handleTooltipLeave = () => {
    console.log("Left tooltip area");
    setIsHoveringScreenshot(false);
  };

  return (
    <div
      className={`w-full h-screen  flex z-[1000000]${
        isNotch ? "items-start " : "items-center"
      } justify-center ${isNotch ? "" : "p-2"} box-border`}
    >
      <motion.main
        animate={
          isNotch
            ? {
                scale: 1,
                y: 0,
                borderRadius: "0 0 28px 28px",
              }
            : showChat && isMaximized
              ? {
                  scale: 1,
                  y: 0,
                  borderRadius: "0px",
                  width: EXPANDED_WIDTH,
                  height: "100%",
                  x: 0,
                  top: 0,
                  left: 0,
                }
              : {
                  scale: 1,
                  y: 0,
                  borderRadius: "12px",
                  width: DEFAULT_CHAT[0],
                  height: "100%",
                }
        }
        transition={{
          type: "tween",
          duration: animations.overlayExpand,
          ease: "circOut",
        }}
        className={`${getNotchClasses(isNotch)}`}
        style={getNotchStyle(isNotch)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header bar */}
        <motion.div
          animate={{
            opacity: isNotch ? 0 : 1,
            y: isNotch ? -10 : 0,
            width: isMaximized ? EXPANDED_WIDTH : DEFAULT_CHAT[0],
            //borderBottomLeftRadius: chatOpen ? "0" : "12px", // check this if working with ui
            //borderBottomRightRadius: chatOpen ? "0" : "12px", // check this if working with ui
          }}
          transition={{
            opacity: { duration: 0.2, ease: "easeOut" },
            y: { duration: 0.3, ease: "easeOut" },
          }}
          className={`flex items-center z-[100000] ${isNotch ? "bg-transparent" : "dark:bg-[#010101] bg-white"} h-[44px] shrink-0 ${isNotch ? "pointer-events-none" : ""} ${!isPinned && !isNotch ? "cursor-move" : "cursor-default"}`}
          style={{ borderRadius: "12px" }}
          onMouseDown={handleDragMouseDown}
        >
          <div className="p-1 w-fit h-full">
            <OverlayButton
              // className="!border-none hover:!bg-foreground/5 !aspect-auto  !rounded-l-[12px] hover:!rounded-l-[12px]"
              customBgColor="white"
              active={false}
              onClick={() => setIsActive(!isActive)}
              // draggable={!isPinned}
            >
              <RaeWatcher isActive={isActive} />
            </OverlayButton>
          </div>

          <div className="group flex-1 h-full flex items-center w-full">
            {!showChat && !isMaximized ? (
              inputActive ? (
                <div
                  key="overlay-card"
                  className="relative flex w-full h-full items-center px-4 py-2 max-w-xs"
                >
                  <input
                    autoFocus
                    type="text"
                    className="no-drag text-foreground/60 text-sm font-medium border-none placeholder:font-medium outline-none bg-transparent w-full placeholder:dark:text-zinc-500 focus:dark:placeholder:text-zinc-400/0 placeholder:transition-colors pr-12"
                    placeholder={
                      attachedImage
                        ? "Describe what you want to know about this image..."
                        : "Ask Rae anything or paste a screenshot..."
                    }
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onPaste={handlePaste}
                    onBlur={() => setInputActive(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendFromMainBar();
                    }}
                  />

                  {/* Image attachment indicator */}
                  <AnimatePresence>
                    {imagePreview && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                      >
                        <div className="relative group">
                          <img
                            src={imagePreview}
                            alt="Attached screenshot"
                            className="w-6 h-6 object-cover rounded cursor-pointer"
                            title="Screenshot attached - Click to remove"
                            onClick={clearImage}
                          />
                          <button
                            onClick={clearImage}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div
                  key="overlay-card"
                  className={`flex w-full h-full items-center px-4 py-2 ${
                    !isPinned ? "drag" : ""
                  } dark:bg-[#010101] max-w-xs cursor-text`}
                  onClick={() => {
                    setInputActive(true);
                    if (isNotch) setIsNotch(false);
                    // Reset the disable flags when user manually interacts
                    DISABLE_NOTCH_ON_SHOW.current = false;
                    DISABLE_PIN_ON_SHOW.current = false;
                    if (notchTimeoutRef.current)
                      clearTimeout(notchTimeoutRef.current);
                  }}
                >
                  <span
                    className={`text-sm font-medium cursor-text z-50 ${
                      inputText ? "text-foreground" : "text-gray-500"
                    }`}
                  >
                    {listening ? (
                      <></>
                    ) : (
                      <>{inputText || "Ask Rae anything..."}</>
                    )}
                  </span>
                </div>
              )
            ) : isActive && !isMaximized ? (
              <div
                className={`flex ${
                  !isPinned ? "drag" : ""
                } items-center gap-2 px-4 h-full py-2 text-sm text-gray-600 relative`}
                onMouseEnter={handleScreenshotHover}
                onMouseLeave={handleScreenshotLeave}
              >
                <span className="select-none whitespace-nowrap font-medium text-foreground/90">
                  Listening to:
                </span>
                {windowIcon ? (
                  <img
                    src={windowIcon}
                    alt="App icon"
                    className="w-5 h-5 rounded-sm"
                  />
                ) : (
                  <div className="w-5 h-5 bg-gray-300 rounded-sm flex items-center justify-center">
                    ?
                  </div>
                )}

                {/* Screenshot tooltip */}
                {showScreenshot && windowScreenshot && (
                  <div
                    className="absolute top-full left-0 mt-2 z-[1000001] bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-1 animate-in fade-in-0 zoom-in-95 duration-200"
                    onMouseEnter={() => {
                      console.log("🖱️ Mouse entered screenshot tooltip");
                      handleTooltipHover();
                    }}
                    onMouseLeave={() => {
                      console.log("🖱️ Mouse left screenshot tooltip");
                      handleTooltipLeave();
                    }}
                  >
                    <img
                      src={windowScreenshot}
                      alt="Window screenshot"
                      className="min-w-[250px] max-h-[350px] rounded shadow-md"
                      onLoad={() => {
                        console.log(
                          "✅ Screenshot image loaded successfully in tooltip",
                        );
                        console.log(
                          "   Image src starts with:",
                          windowScreenshot.substring(0, 80),
                        );
                      }}
                      onError={(e) => {
                        console.error("❌ Screenshot image failed to load:", e);
                        console.error(
                          "   Image src starts with:",
                          windowScreenshot.substring(0, 80),
                        );
                      }}
                      style={{ imageRendering: "crisp-edges" }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="size-full"></div>
            )}
          </div>

          <div className="flex items-center h-full ml-auto p-1 gap-1">
            {!showChat && inputText.trim().length > 0 && (
              <OverlayButton
                className="no-drag h-full flex items-center gap-1 hover:bg-foreground/10  p-2 text-sm  border-border"
                onClick={handleSendFromMainBar}
              >
                <ArrowElbowDownLeftIcon weight="bold" />
              </OverlayButton>
            )}
            {/* Hide voice and pin buttons in maximized state */}
            {!isMaximized && (
              <>
                <OverlayButton
                  onClick={() => {
                    console.log("🎛️ Toggling assist mode...", {
                      currentAssist: assist,
                      audioClientActive,
                      willBeActive: !assist,
                    });
                    setAssist((v) => !v);
                  }}
                  active={assist}
                  title={`Voice Assistant ${assist ? "Active" : "Inactive"} - ${
                    audioClientActive ? "Connected" : "Disconnected"
                  }`}
                  // draggable={!isPinned}
                  className={
                    assist
                      ? audioClientActive
                        ? "!text-[#ffe941] dark:!text-surface animate-pulse"
                        : "!text-orange-400 dark:!text-orange-300"
                      : ""
                  }
                >
                  {assist ? (
                    <EarIcon weight="bold" size={16} />
                  ) : (
                    <EarSlashIcon weight="bold" size={16} />
                  )}
                  {/* <EarIcon weight={listening ? "fill" : "bold"} /> */}
                </OverlayButton>
              </>
            )}
            {showChat ? (
              <>
                {isMaximized && (
                  <div className="flex h-full items-center gap-1 ">
                    {/* Navigation buttons for maximized state - centered */}
                    <OverlayButton
                      onClick={() => emit("navigate_to", { to: "/app/chat" })}
                      active={currentPage === "chat"}
                      title="Chat"
                      draggable={!isPinned}
                    >
                      <ChatIcon className="" size={16} />
                    </OverlayButton>
                    <OverlayButton
                      onClick={() =>
                        emit("navigate_to", { to: "/app/settings/preferences" })
                      }
                      active={currentPage === "settings"}
                      title="Settings"
                      draggable={!isPinned}
                    >
                      <GearSixIcon size={16} />
                    </OverlayButton>
                    <OverlayButton
                      onClick={() =>
                        emit("navigate_to", { to: "/app/settings/preferences" })
                      }
                      active={currentPage === "notes"}
                      title="Notes"
                      draggable={!isPinned}
                    >
                      <FileTextIcon size={16} />
                    </OverlayButton>
                  </div>
                )}
                <OverlayButton
                  onClick={() => {
                    handleMaximizeClick();
                    // setIsMaximized(!isMaximized);
                  }}
                  active={isMaximized}
                  title={isMaximized ? "Minimize" : "Maximize"}
                  draggable={!isPinned}
                >
                  {isMaximized ? (
                    <Minimize2 className="text-surface" size={16} />
                  ) : (
                    <Maximize2 size={16} />
                  )}
                </OverlayButton>

                {!isMaximized && (
                  <>
                    <OverlayButton
                      onClick={handleCloseChatClick}
                      title="Close chat"
                      draggable={!isPinned}
                    >
                      <XIcon weight="bold" size={16} />
                    </OverlayButton>
                  </>
                )}
              </>
            ) : (
              <>
                <OverlayButton
                  onClick={handleOpenChat}
                  title="Open chat"
                  draggable={!isPinned}
                >
                  <CornersOutIcon weight="bold" size={16} />
                </OverlayButton>
              </>
            )}
          </div>
        </motion.div>
        {/* Notch mode: the bar itself is the notch with animated status dot which will play notch collapse sound with sync with notch animation */}
        <AnimatePresence>
          {isNotch && (
            <motion.div
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                delay: 0.3,
                type: "spring",
                stiffness: 500,
                damping: 25,
              }}
              className="absolute inset-0 flex items-center justify-center px-2"
            >
              <div className="flex items-center justify-center w-full h-full">
                <RaeWatcher isActive={isActive} />
              </div>

              {/* App information in notch - Hidden to show only RaeWatcher logo */}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="sync">
          {chatOpen && !isMaximized && (
            <ChatView
              onClose={handleCloseChatClick}
              initialMessage={initialChatMessage}
              initialAttachedImage={initialAttachedImage}
              smoothResize={smoothResize}
              windowName={windowName}
              windowIcon={windowIcon}
              windowHwnd={windowHwnd}
              windowScreenshot={windowScreenshot}
              isActive={isActive}
              isMaximized={isMaximized}
              setIsMaximized={setIsMaximized}
              isPinned={isPinned}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              assist={assist}
              assistMessage={assistMessage}
              setAssistMessage={setAssistMessage}
            />
          )}
        </AnimatePresence>
      </motion.main>
    </div>
  );
};
export default Overlay;
