import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cursorPosition } from "@tauri-apps/api/window";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const RaeWatcher = ({ isActive }: { isActive: boolean }) => {
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [height, setHeight] = useState("20px");

  useEffect(() => {
    let frameId: number;
    let windowPos = { x: 0, y: 0 };
    const win = getCurrentWebviewWindow();

    // Update window position every 200ms
    const winInterval = setInterval(async () => {
      if (win) {
        windowPos = await win.outerPosition();
      }
    }, 200);

    const updateMousePos = async () => {
      const mouse = await cursorPosition();
      setMouseOffset({ x: mouse.x - windowPos.x, y: mouse.y - windowPos.y });

      frameId = requestAnimationFrame(updateMousePos);
    };

    frameId = requestAnimationFrame(updateMousePos);

    return () => {
      cancelAnimationFrame(frameId);
      clearInterval(winInterval);
    };
  }, []);

  // Blink logic
  useEffect(() => {
    if (!isActive) {
      setHeight("4px"); // go small when not active
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const blink = () => {
      setHeight("4px");
      setTimeout(() => setHeight("20px"), 200);

      timeoutId = setTimeout(blink, Math.random() * 700 + 2500);
    };

    blink();

    return () => clearTimeout(timeoutId);
  }, [isActive]);

  return (
    <div className="relative flex  items-center justify-center size-full">
      <motion.div
        animate={{
          height: isActive ? height : "8px",
          x: isActive ? mouseOffset.x / 100 : 0,
          y: isActive ? mouseOffset.y / 100 : 0,
        }}
        transition={{
          height: { duration: 0.2, ease: "easeInOut" },
          x: { type: "spring", stiffness: 120, damping: 20 },
          y: { type: "spring", stiffness: 120, damping: 20 },
        }}
        className={`size-[20px] border-2 ring-2 ${isActive ? "border-surface ring-surface/20" : "border-stone-600 ring-stone-800"} rounded-full`}
      />
    </div>
  );
};

export default RaeWatcher;
