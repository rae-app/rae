import { useChatStore } from "@/store/chatStore";
import { invoke } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useRef, useState } from "react";
import Overlay from "./components/OverlayCard";
import { resize } from "@/utils/windowUtils";
import { motion } from "motion/react";

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

// DEV FLAG: Set to false to disable MagicDot for development
const DEV_MAGIC_DOT_ENABLED = true;

const MagicDot = () => {
  const [expanded, setExpanded] = useState(true); // Expanded bar state
  const [isPinned, setIsPinned] = useState(false);
  const hasStartedFollowing = useRef(false);
  const [inputText, setInputText] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [showInput, setShowInput] = useState(true); // NEW STATE
  const [windowName, setWindowName] = useState("");
  const [windowIcon, setWindowIcon] = useState("");
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const messages = useChatStore((s) => s.messages);
  const setMessages = useChatStore((s) => s.setMessages);
  const [chatInputText, setChatInputText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [pendingAIMessage, setPendingAIMessage] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isAdjustingBg, setIsAdjustingBg] = useState(false);
  const [bgPercent, setBgPercent] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const hoverExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastAppliedHeightRef = useRef<number>(60);
  const openMessageIndexRef = useRef<number>(0);

  useEffect(() => {
    invoke("start_window_watch").catch(() => {});

    interface ActiveWindowChangedPayload {
      name?: string;
      icon?: string; // data UR (e.g., data:image/png;base64,...)
    }

    const unlistenPromise = listen<ActiveWindowChangedPayload>(
      "active_window_changed",
      (event) => {
        if (event?.payload) {
          const { name, icon } = event.payload;
          setWindowName(name ?? "");
          setWindowIcon(icon ?? "");
        }
      },
    );

    // Force top-center positioning after component mounts
    const positionTimer = setTimeout(() => {
      invoke("force_top_center_magic_dot").catch(() => {});
    }, 200);

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
      clearTimeout(positionTimer);
    };
  }, []);
  // Dimensions for expanded bar and collapsed notch
  const EXPANDED = { w: 500, h: 60 } as const;
  const NOTCH = { w: 180, h: 28 } as const;

  const applyCollapsedSize = () => {
    const win = getCurrentWebviewWindow();
    win.setSize(new LogicalSize(NOTCH.w, NOTCH.h)).catch(() => {});
  };

  useEffect(() => {
    if (!expanded) {
      // Collapsed notch - resize and position atomically
      resize(NOTCH.w, NOTCH.h);
      hasStartedFollowing.current = true;
      // No need for follow_magic_dot since resize handles positioning
    } else if (expanded && showChat) {
      // Expanded chat mode: ensure full chat size
      resize(500, 570);
      lastAppliedHeightRef.current = 570;
      // No need for follow_magic_dot since resize handles positioning
    } else if (expanded && !showChat) {
      // Expanded bar mode (no chat)
      resize(EXPANDED.w, EXPANDED.h);
      lastAppliedHeightRef.current = EXPANDED.h;
      // No need for follow_magic_dot since resize handles positioning
    }
  }, [expanded, showChat]);

  useEffect(() => {
    let unlistenExit: UnlistenFn | null = null;
    let unlistenCollapse: UnlistenFn | null = null;

    listen("exit_follow_mode", () => {
      setExpanded(true);

      // keep size controlled explicitly when opening chat
      // invoke("center_magic_dot").catch(() => {});
    }).then((fn) => {
      unlistenExit = fn;
    });

    listen("collapse_to_dot", () => {
      setExpanded(false);
      setIsPinned(false);
      // invoke("follow_magic_dot").catch(console.error);
    }).then((fn) => {
      unlistenCollapse = fn;
    });


    return () => {
      if (unlistenExit) unlistenExit();
      if (unlistenCollapse) unlistenCollapse();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    return () => {
      if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    };
  }, [backgroundUrl]);

  const handleBackgroundSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBackgroundUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setBgPercent({ x: 50, y: 50 });
    setIsAdjustingBg(true);
    e.currentTarget.value = "";
  };

  return (
    <motion.div className="w-[400px] ">
      {expanded ? (
        <div
          onMouseEnter={() => {
            if (collapseTimerRef.current) {
              clearTimeout(collapseTimerRef.current);
              collapseTimerRef.current = null;
            }
          }}
          onMouseLeave={() => {
            if (collapseTimerRef.current) {
              clearTimeout(collapseTimerRef.current);
            }
            // Only reposition if window might have moved during interaction
            // The smoothResize calls handle positioning automatically

            // Auto-collapse to notch after short inactivity when not pinned and chat closed
            if (!isPinned && !showChat) {
              collapseTimerRef.current = setTimeout(() => {
                setExpanded(false);
              }, 3000);
            }
          }}
          className="size-full flex justify-start align-start"
        >
          <Overlay />
        </div>
      ) : (
        // Collapsed notch UI: mac-style notch (flat top, rounded bottom corners)
        <div className="w-full h-full flex items-start justify-center">
          <div
            className={`cursor-pointer select-none border border-gray-300 border-t-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)] overflow-hidden bg-white`}
            style={{
              width: NOTCH.w,
              height: NOTCH.h,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
            }}
            onMouseDown={() => {
              const win = getCurrentWebviewWindow();
              if (hoverExpandTimer.current) {
                clearTimeout(hoverExpandTimer.current);
                hoverExpandTimer.current = null;
              }
              win.startDragging().catch(() => {});
            }}
            onMouseEnter={() => {
              if (hoverExpandTimer.current) {
                clearTimeout(hoverExpandTimer.current);
              }
              hoverExpandTimer.current = setTimeout(() => {
                setExpanded(true);
                // Ensure proper positioning after expansion with force command
                setTimeout(() => {
                  invoke("force_top_center_magic_dot").catch(() => {});
                }, 100);
              }, 200);
            }}
            onMouseLeave={() => {
              if (hoverExpandTimer.current) {
                clearTimeout(hoverExpandTimer.current);
                hoverExpandTimer.current = null;
              }
            }}
            title="Expand"
          >
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default DEV_MAGIC_DOT_ENABLED ? MagicDot : () => null;
