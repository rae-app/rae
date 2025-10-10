import { useChatStore } from "@/store/chatStore";
import { invoke } from "@tauri-apps/api/core";

import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useRef, useState } from "react";
import Overlay from "./components/OverlayCard";

import { motion } from "motion/react";

// DEV FLAG: Set to false to disable MagicDot for development
const DEV_MAGIC_DOT_ENABLED = true;

const MagicDot = () => {
  const [expanded, setExpanded] = useState(true); // Expanded bar state
  const [isPinned, setIsPinned] = useState(false);

  const [showChat, setShowChat] = useState(false);
  const messages = useChatStore((s) => s.messages);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const hoverExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const NOTCH = { w: 180, h: 28 } as const;

  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

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
          ></div>
        </div>
      )}
    </motion.div>
  );
};

export default DEV_MAGIC_DOT_ENABLED ? MagicDot : () => null;
