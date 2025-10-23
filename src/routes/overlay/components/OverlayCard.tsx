import { useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { smoothResize, pinMagicDot, resize } from "@/utils/windowUtils";
import { AnimatePresence, motion } from "framer-motion";
import { OverlayButton } from "./OverlayComponents";
import { ChatView } from "./ChatCard";
import { Minimize2, Maximize2 } from "lucide-react";
import notchSound from "../../../assets/sounds/bubble-pop-06-351337.mp3";
import { invoke } from "@tauri-apps/api/core";
import { animations } from "@/constants/animations";
import { useUserStore } from "@/store/userStore";
import { useNoteStore } from "@/store/noteStore";
import { GetNotes } from "@/api/notes";
import { handleUpdateClick } from "@/utils/updateUtils";
import {
  ArrowCircleUpIcon,
  ArrowElbowDownLeftIcon,
  ChatIcon,
  CornersOutIcon,
  EarIcon,
  EarSlashIcon,
  FileTextIcon,
  GearSixIcon,
  PushPinIcon,
  XIcon,
} from "@phosphor-icons/react";

import RaeWatcher from "./RaeWatcher";
const DEFAULT_CHAT = [480, 470];

const EXPANDED_WIDTH = 248;

const NOTCH_TIMEOUT = 2000;

// Constants for notch styling
const NOTCH_SHADOW = `
  0 8px 32px rgba(0, 0, 0, 0.3),
  inset 0 1px 0 rgba(255, 255, 255, 0.2),
  inset 0 -1px 0 rgba(0, 0, 0, 0.1),
  0 0 0 1px rgba(255, 255, 255, 0.1)
`;

// Audio Manager - handles all audio-related functionality
const createAudioManager = () => {
  const playNotchSound = (soundEnabled: boolean) => {
    // Check if bubble sound is enabled in settings
    if (!soundEnabled) {
      return; // Don't play sound if disabled
    }

    try {
      const audio = new Audio(notchSound);
      audio.volume = 0.3; // Set volume to 30%
      audio.play().catch((err) => console.error("Sound play failed:", err));
    } catch (error) {
      console.error("Audio playback error:", error);
    }
  };

  return {
    playNotchSound,
  };
};

// Refs for global state
const DISABLE_NOTCH_ON_SHOW = { current: false };
const DISABLE_PIN_ON_SHOW = { current: false };
const DISABLE_SAFETY_NOTCH = { current: false };

// Notch Controller - manages all notch-related state and logic
const createNotchController = () => {
  let notchTimeoutRef: NodeJS.Timeout | null = null;

  const clearNotchTimeout = () => {
    if (notchTimeoutRef) {
      clearTimeout(notchTimeoutRef);
      notchTimeoutRef = null;
    }
  };

  const setNotchTimeout = (callback: () => void, delay: number) => {
    clearNotchTimeout();
    notchTimeoutRef = setTimeout(callback, delay);
  };

  const shouldEnableNotch = (
    isPinned: boolean,
    showChat: boolean,
    isNotch: boolean,
    inputActive: boolean,
  ) => {
    return (
      isPinned &&
      !showChat &&
      !isNotch &&
      !inputActive &&
      !DISABLE_NOTCH_ON_SHOW.current
    );
  };

  const getNotchDebugInfo = (
    isPinned: boolean,
    showChat: boolean,
    isNotch: boolean,
    inputActive: boolean,
  ) => {
    return {
      isPinned,
      showChat,
      isNotch,
      inputActive,
      disableNotch: DISABLE_NOTCH_ON_SHOW.current,
      timestamp: new Date().toISOString(),
    };
  };

  return {
    clearNotchTimeout,
    setNotchTimeout,
    shouldEnableNotch,
    getNotchDebugInfo,
  };
};

/**
 * Helper functions for notch styling and layout
 */
const getNotchClasses = (isNotch: boolean) => {
  const baseClasses = "flex flex-col  min-h-0 overflow-hidden";

  if (!isNotch) return `${baseClasses} text-foreground`;

  const notchClasses =
    "w-[360px] h-24 -mt-2 border-border backdrop-blur-sm absolute  overflow-hidden";
  const backgroundClasses = "bg-white dark:bg-black";

  return `${baseClasses} ${notchClasses} ${backgroundClasses}`;
};

const getNotchStyle = (isNotch: boolean) =>
  isNotch ? { boxShadow: NOTCH_SHADOW } : {};

// Screenshot Manager - handles all screenshot capture and visibility logic
const createScreenshotManager = () => {
  const hideTimeoutRef = { current: null as NodeJS.Timeout | null };

  const cancelHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const hideScreenshot = (setShowScreenshot: (show: boolean) => void) => {
    setShowScreenshot(false);
    // Don't clear windowScreenshot here - keep it for chat functionality
  };

  const scheduleHideTimeout = (setShowScreenshot: (show: boolean) => void) => {
    cancelHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      hideScreenshot(setShowScreenshot);
      hideTimeoutRef.current = null;
    }, 200);
  };

  const captureScreenshot = async (
    windowHwnd: number | null,
    isActive: boolean,
    setWindowScreenshot: (screenshot: string) => void,
  ) => {
    // Only capture screenshot if the green toggle is active
    if (!isActive) {
      return;
    }

    try {
      if (windowHwnd == null) return;
      const screenshot = (await invoke("capture_window_screenshot_by_hwnd", {
        hwnd: windowHwnd,
      })) as string;
      setWindowScreenshot(screenshot);
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
    }
  };

  return {
    cancelHideTimeout,
    hideScreenshot,
    scheduleHideTimeout,
    captureScreenshot,
  };
};

// Timer Manager - handles all timeout-related functionality
const createTimerManager = () => {
  const timeouts = new Map<string, NodeJS.Timeout>();

  const setTimeout = (key: string, callback: () => void, delay: number) => {
    clearTimeout(key);
    timeouts.set(key, global.setTimeout(callback, delay));
  };

  const clearTimeout = (key: string) => {
    const timeout = timeouts.get(key);
    if (timeout) {
      global.clearTimeout(timeout);
      timeouts.delete(key);
    }
  };

  const clearAllTimeouts = () => {
    timeouts.forEach((timeout) => global.clearTimeout(timeout));
    timeouts.clear();
  };

  return {
    setTimeout,
    clearTimeout,
    clearAllTimeouts,
  };
};

// Event Handler Factory - creates reusable event handlers
const createEventHandlerFactory = (
  notchController: any,
  audioManager: any,
  inputActiveRef: any,
) => {
  const createMouseEnterHandler = (
    isPinned: boolean,
    showChat: boolean,
    isNotch: boolean,
    inputActive: boolean,
    bubbleSoundEnabled: boolean,
    setIsNotch: (isNotch: boolean) => void,
  ) => {
    return () => {
      // Clear any pending notch timeout
      notchController.clearNotchTimeout();

      // If we're in notch mode, expand it
      if (isNotch) {
        setIsNotch(false);
        audioManager.playNotchSound(bubbleSoundEnabled);
      } else {
        // If we should enable notch, set a timeout
        if (
          notchController.shouldEnableNotch(
            isPinned,
            showChat,
            isNotch,
            inputActive,
          )
        ) {
          notchController.setNotchTimeout(() => {
            if (
              notchController.shouldEnableNotch(
                isPinned,
                showChat,
                isNotch,
                inputActive,
              )
            ) {
              setIsNotch(true);
              audioManager.playNotchSound(bubbleSoundEnabled);
            }
          }, 2000);
        }
      }
    };
  };

  const createMouseLeaveHandler = (
    isPinned: boolean,
    showChat: boolean,
    isNotch: boolean,
    inputActive: boolean,
    bubbleSoundEnabled: boolean,
    setIsNotch: (isNotch: boolean) => void,
  ) => {
    return () => {
      // Set notch timeout if conditions are met
      if (
        notchController.shouldEnableNotch(
          isPinned,
          showChat,
          isNotch,
          inputActive,
        )
      ) {
        notchController.setNotchTimeout(() => {
          // Double check conditions when timeout fires and notch not disabled
          if (
            !inputActiveRef.current &&
            isPinned &&
            !showChat &&
            !DISABLE_NOTCH_ON_SHOW.current
          ) {
            invoke("enable_notch")
              .then(() => {
                setIsNotch(true);
                // Play sound with perfect timing - synced with smooth resize animation (200ms total, play at 100ms)
                setTimeout(
                  () => audioManager.playNotchSound(bubbleSoundEnabled),
                  60,
                );
              })
              .catch((error) => {
                console.error("Failed to enable notch:", error);
              });
          }
        }, NOTCH_TIMEOUT);
      }
    };
  };

  return {
    createMouseEnterHandler,
    createMouseLeaveHandler,
  };
};

const Overlay = () => {
  // State for the overlay shell itself
  const [isPinned, setIsPinned] = useState(false);
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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  // Event-driven update communication
  useEffect(() => {
    const setupUpdateListener = async () => {
      const unlisten = await listen("update-needed", (event: any) => {
        const { available } = event.payload;
        console.log(
          "[Overlay Window] Received 'update-needed' event:",
          available,
        );
        setUpdateAvailable(available);
      });
      return unlisten;
    };

    let unlisten: (() => void) | undefined;
    setupUpdateListener().then((unlistenFn) => {
      unlisten = unlistenFn;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Handler to spawn overlay-extended window

  const [windowName, setWindowName] = useState("");
  const [windowIcon, setWindowIcon] = useState("");
  const [windowHwnd, setWindowHwnd] = useState<number | null>(null);
  const [isNotch, setIsNotch] = useState(false);
  const [inputActive, setInputActive] = useState(false);
  // const [showApp, setShowApp] = useState(false)

  // Initialize managers
  const audioManager = createAudioManager();
  const notchController = createNotchController();
  const screenshotManager = createScreenshotManager();
  const timerManager = createTimerManager();
  const inputActiveRef = useRef(inputActive);

  // Keep inputActiveRef in sync with state
  useEffect(() => {
    inputActiveRef.current = inputActive;
  }, [inputActive]);

  const eventHandlerFactory = createEventHandlerFactory(
    notchController,
    audioManager,
    inputActiveRef,
  );

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
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
    localStorage.setItem("overlay_active", String(isActive));

    // Clear screenshot when toggle is turned off
    if (!isActive) {
      setWindowScreenshot("");
      setShowScreenshot(false);
    } else {
      // Capture screenshot immediately when toggle is turned on
      if (windowHwnd != null) {
        invoke("capture_window_screenshot_by_hwnd", {
          hwnd: windowHwnd,
        })
          .then((screenshot: string) => {
            if (screenshot.length > 0) {
              setWindowScreenshot(screenshot);
            }
          })
          .catch((error) => {
            console.error("❌ Failed to capture immediate screenshot:", error);
          });
      }
    }
  }, [isActive, windowHwnd]);

  // Keep ref in sync with state
  useEffect(() => {
    inputActiveRef.current = inputActive;
  }, [inputActive]);

  useEffect(() => {
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

    // Clear notch if not pinned
    if (!isPinned && isNotch) {
      setIsNotch(false);
      return;
    }

    // Only set notch timeout if pinned, not in chat, not already notch, not typing, and notch not disabled
    if (
      isPinned &&
      !showChat &&
      !isNotch &&
      !inputActive &&
      !DISABLE_NOTCH_ON_SHOW.current
    ) {
      notchTimeoutRef.current = setTimeout(() => {
        // Double check that user isn't typing when timeout fires and notch not disabled
        if (
          !inputActiveRef.current &&
          isPinned &&
          !DISABLE_NOTCH_ON_SHOW.current
        ) {
          invoke("enable_notch")
            .then(() => {
              setIsNotch(true);
              // Play sound with perfect timing - synced with smooth resize animation (200ms total, play at 100ms)
              setTimeout(
                () => audioManager.playNotchSound(bubbleSoundEnabled),
                60,
              );
            })
            .catch((error) => {
              console.error("Failed to enable notch:", error);
            });
        }
      }, NOTCH_TIMEOUT);
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
              setTimeout(
                () => audioManager.playNotchSound(bubbleSoundEnabled),
                60,
              );
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
  }, [isPinned, showChat, isNotch, inputActive]);

  const handleMouseEnter = eventHandlerFactory.createMouseEnterHandler(
    isPinned,
    showChat,
    isNotch,
    inputActive,
    bubbleSoundEnabled,
    setIsNotch,
  );
  useEffect(() => {
    const unlisten = listen("notch-hover", () => {
      // Expand the notch when the event is received

      // console.log("notch-hover", isNotch, isPinned);

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
    const eventListeners = [
      listen("disable_notch_on_show", () => {
        DISABLE_NOTCH_ON_SHOW.current = true;
        setIsNotch(false);
        if (notchTimeoutRef.current) {
          clearTimeout(notchTimeoutRef.current);
          notchTimeoutRef.current = null;
        }
      }),

      listen("disable_pin_on_show", () => {
        DISABLE_PIN_ON_SHOW.current = true;
        setIsPinned(false);
      }),

      listen("unpin_for_center", () => {
        setIsPinned(false);
        if (notchTimeoutRef.current) {
          clearTimeout(notchTimeoutRef.current);
          notchTimeoutRef.current = null;
        }
      }),

      listen("toggle_pin_state", () => {
        // Reset notch disable flag when using Ctrl+P to ensure proper 2s timeout
        DISABLE_NOTCH_ON_SHOW.current = false;
        handlePinClick();
      }),

      listen("center_overlay_bar", () => {
        DISABLE_SAFETY_NOTCH.current = true;
        // Reset after a reasonable time (30 seconds)
        setTimeout(() => {
          DISABLE_SAFETY_NOTCH.current = false;
        }, 30000);
      }),

      // Listen for main window close to clean up overlay
      listen("main-window-closed", () => {
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

  const handleMouseLeave = eventHandlerFactory.createMouseLeaveHandler(
    isPinned,
    showChat,
    isNotch,
    inputActive,
    bubbleSoundEnabled,
    setIsNotch,
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isPinned) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isPinned || !dragStartRef.current) return;
    const deltaX = Math.abs(e.clientX - dragStartRef.current.x);
    const deltaY = Math.abs(e.clientY - dragStartRef.current.y);

    if (deltaX > 5 || deltaY > 5) {
      // When dragging while not pinned, we can implement actual window dragging here
      // For now, just reset the drag state
      setIsDragging(false);
      dragStartRef.current = null;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => document.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  const handlePinClick = () => {
    setIsPinned((prev) => {
      if (prev == false) {
        pinMagicDot();
        // Reset both disable flags when user manually pins
        DISABLE_PIN_ON_SHOW.current = false;
        DISABLE_NOTCH_ON_SHOW.current = false;
      }
      const newPinned = !prev;
      if (!newPinned) {
        setIsNotch(false);
      }
      if (notchTimeoutRef.current) {
        clearTimeout(notchTimeoutRef.current);
      }
      return newPinned;
    });
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
        // Minimizing - hide the main app
        emit("show_app", { show: false });
        handlePinClick();
        resize(500, 60);
      } else {
        // Maximizing - show the main app
        emit("show_app", { show: true });
        handlePinClick();
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

    if (isAnyHovering) {
      screenshotManager.cancelHideTimeout();
      if (!showScreenshot && windowScreenshot) {
        setShowScreenshot(true);
      }
    } else {
      screenshotManager.scheduleHideTimeout(setShowScreenshot);
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
      screenshotManager.cancelHideTimeout();
      screenshotManager.hideScreenshot(setShowScreenshot);
    };
  }, []);

  // Clear screenshot when window changes
  useEffect(() => {
    screenshotManager.hideScreenshot(setShowScreenshot);
  }, [windowName, windowIcon, windowHwnd]);

  const handleScreenshotHover = async () => {
    setIsHoveringTrigger(true);
    await screenshotManager.captureScreenshot(
      windowHwnd,
      isActive,
      setWindowScreenshot,
    );
  };

  const handleScreenshotLeave = () => {
    setIsHoveringTrigger(false);
  };

  const handleTooltipHover = () => {
    setIsHoveringScreenshot(true);
  };

  const handleTooltipLeave = () => {
    setIsHoveringScreenshot(false);
  };

  return (
    <div
      className={`w-full h-screen  flex z-[1000000]${
        isNotch ? "items-start " : "items-center"
      } justify-center ${isNotch ? "pt-2" : "p-2"} `}
    >
      <motion.main
        animate={
          isNotch
            ? {
                scale: 0.6,
                y: -10,
                borderRadius: "0 0 28px 28px",
              }
            : showChat && isMaximized
              ? {
                  scale: 1,
                  y: 0,
                  borderRadius: "8px",
                  width: EXPANDED_WIDTH,
                  height: "100%",
                  x: 0,
                  top: 0,
                  left: 0,
                }
              : {
                  scale: 1,
                  y: 0,
                  borderRadius: "8px",
                  width: DEFAULT_CHAT[0],
                  height: "100%",
                }
        }
        transition={{
          type: "tween",
          duration: animations.overlayExpand,
          ease: "circOut",
        }}
        className={`${getNotchClasses(isNotch)} `}
        style={getNotchStyle(isNotch)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
          className={`flex items-center z-[100000] dark:bg-[#010101] bg-white   h-[44px] shrink-0 ${
            !isPinned ? "drag" : ""
          } ${isNotch ? "pointer-events-none" : ""}`}
          style={{ borderRadius: "8px" }}
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

          <div
            className={`group ${
              !isPinned ? "drag" : ""
            } flex-1 h-full flex items-center w-full`}
          >
            {!showChat && !isMaximized ? (
              inputActive ? (
                <div
                  key="overlay-card"
                  className={`relative flex w-full h-full items-center border-l border-border px-4 py-2 ${
                    !isPinned ? "drag" : ""
                  }   max-w-xs`}
                >
                  <input
                    autoFocus
                    type="text"
                    className="no-drag text-stone-400 text-sm font-medium border-none placeholder:font-medium outline-none bg-transparent w-full placeholder:dark:text-stone-500 focus:dark:placeholder:text-stone-400/0 placeholder:transition-colors pr-12"
                    placeholder={
                      attachedImage
                        ? "Describe what you want to know about this image..."
                        : "Ask Rae anything yep or paste a screenshot..."
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
                  className={`flex w-full h-full items-center border-l border-border px-4 py-2 ${
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
                      inputText ? "text-foreground" : "text-stone-400"
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
                } items-center gap-2 px-4 h-full py-2 text-sm border-l border-border text-stone-600 relative`}
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
                    className="w-5 h-5 rounded-sm "
                  />
                ) : (
                  <div className="w-5 h-5 bg-stone-300 rounded-sm flex items-center justify-center">
                    ?
                  </div>
                )}

                {/* Screenshot tooltip */}
                <AnimatePresence>
                  {showScreenshot && windowScreenshot && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute top-full pointer-events-none left-0 mt-2 z-[1000001] bg-stone-100 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg shadow-xl p-1 animate-in fade-in-0 zoom-in-95 duration-200"
                      onMouseEnter={handleTooltipHover}
                      onMouseLeave={handleTooltipLeave}
                    >
                      <img
                        src={windowScreenshot}
                        alt="Window screenshot"
                        className="min-w-[250px] pointer-events-none max-h-[350px] rounded shadow-md"
                        onLoad={() => {}}
                        onError={(e) =>
                          console.error("Image failed to load:", e)
                        }
                        style={{ imageRendering: "crisp-edges" }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="size-full drag"></div>
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
                {/*{assist ? (
                    <EarIcon weight="bold" size={16} />
                  ) : (
                    <EarSlashIcon weight="bold" size={16} />
                  )}*/}
                {/* <EarIcon weight={listening ? "fill" : "bold"} /> */}
                {/*</OverlayButton>*/}
                {updateAvailable && (
                  <OverlayButton
                    onClick={() => {
                      console.log(
                        "[Overlay Window] Update button clicked - emitting 'update-now' to main window",
                      );
                      emit("update-now", {});
                    }}
                    title="Update available"
                    draggable={!isPinned}
                    className="!text-red-500 dark:!text-red-500 relative"
                  >
                    <ArrowCircleUpIcon weight="bold" size={16} />
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full"
                    >
                      <div className="w-full h-full bg-red-500 rounded-full animate-ping" />
                    </motion.div>
                  </OverlayButton>
                )}
                <OverlayButton
                  onClick={handlePinClick}
                  active={isPinned}
                  title="Pin"
                  draggable={!isPinned}
                  className={
                    isPinned ? "!text-[#ffe941] dark:!text-surface" : ""
                  }
                >
                  <PushPinIcon weight={isPinned ? "fill" : "bold"} />
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
                      // active={currentPage === "chat"}
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
                    {/*<OverlayButton
                      onClick={() =>
                        emit("navigate_to", { to: "/app/settings/preferences" })
                      }
                      active={currentPage === "notes"}
                      title="Notes"
                      draggable={!isPinned}
                    >
                      <FileTextIcon size={16} />
                    </OverlayButton>*/}
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
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="flex items-center absolute left-4">
                <RaeWatcher isActive={isActive} />
              </div>

              {/* App information in notch */}
              {windowName && notchWindowDisplayEnabled && isActive && (
                <div className="flex items-center gap-4 ml-4 text-white/95">
                  {windowIcon ? (
                    <img
                      src={windowIcon}
                      alt="App icon"
                      className="w-8 h-8 rounded-sm"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-white/20 rounded-sm flex items-center justify-center">
                      <span className="text-xl text-white/60">?</span>
                    </div>
                  )}
                  <span className="text-xl font-bold max-w-[200px] truncate">
                    {windowName}
                  </span>
                </div>
              )}
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
