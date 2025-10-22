{
  /*
  This is the chat history tab component.
  It is used to display the chat history.
*/
}

import React, { useRef, useLayoutEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";

interface ChatHistoryTabProps {
  message: string;
  active?: boolean;
  onClick?: () => void;
}

const ChatHistoryTab: React.FC<ChatHistoryTabProps> = React.memo(
  ({ message, active = false, onClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const controls = useAnimation();
    const [shouldAnimate, setShouldAnimate] = useState(false);
    const [textWidth, setTextWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);

    useLayoutEffect(() => {
      if (active && textRef.current && containerRef.current) {
        const tWidth = textRef.current.scrollWidth;
        const cWidth = containerRef.current.offsetWidth;
        setTextWidth(tWidth);
        setContainerWidth(cWidth);
        setShouldAnimate(tWidth > cWidth);
      } else {
        setShouldAnimate(false);
      }
    }, [active, message]);

    useLayoutEffect(() => {
      if (shouldAnimate && active) {
        // Account for padding (px-4 = 1rem left/right = 16px each) and a small buffer
        const padding = 32 + 8; // 32px for px-4, 8px buffer
        const distance = textWidth - containerWidth + padding;
        controls.start({
          x: [0, -distance, -distance, 0, 0],
          transition: {
            x: {
              times: [0, 0.4, 0.6, 0.9, 1],
              duration: Math.max(6, 8 + distance / 30), // Minimum duration to reduce CPU load
              ease: "linear",
              repeat: Infinity,
              repeatType: "loop",
            },
          },
        });
      } else {
        controls.stop();
        controls.set({ x: 0 });
      }
    }, [shouldAnimate, active, textWidth, containerWidth, controls]);

    return (
      <div
        ref={containerRef}
        onClick={onClick}
        className={`px-3 py-2.5 group whitespace-nowrap overflow-hidden font-medium rounded-lg text-sm relative cursor-pointer transition-all duration-200 ${
          active
            ? "bg-stone-900 text-white shadow-sm border border-stone-800"
            : "bg-white text-stone-700 hover:bg-stone-100 border border-transparent hover:border-stone-200"
        }`}
        style={{ maxWidth: "100%" }}
      >
        <motion.div
          ref={textRef}
          animate={controls}
          style={{ display: "inline-block", whiteSpace: "nowrap" }}
        >
          {message}
        </motion.div>
        <div
          className={`pointer-events-none absolute right-0 top-0 h-full w-1/3 bg-gradient-to-r from-transparent transition-colors ${
            active
              ? "via-stone-900 to-stone-900"
              : "via-white to-white group-hover:via-stone-100 group-hover:to-stone-100"
          }`}
        ></div>
      </div>
    );
  },
);

export default ChatHistoryTab;
