import React from "react";

export interface OverlayButtonProps {
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
  className?: string;
  customBgColor?: string; // Optional custom background color
  draggable?: boolean; // Whether the button should be draggable
}

export const OverlayButton = ({
  onClick,
  active = false,
  title,
  children,
  className = "",
  customBgColor = "",
  draggable = true,
}: OverlayButtonProps) => (
  <div
    onClick={(e) => {
      onClick(e);
    }}
    className="h-full group aspect-square shrink-0 "
  >
    <button
      className={`${
        draggable ? "" : ""
      } h-full bg-transparent   outline-none  active:outline-2 active:outline-surface group-hover:dark:text-white dark:text-stone-400  flex items-center justify-center aspect-square shrink-0 rounded-lg transition-all duration-100   ${
        active
          ? `dark:bg-surface/10  text-surface group-hover:bg-surface/20`
          : "group-hover:dark:bg-stone-900 "
      } ${className}`}
      title={title}
    >
      {children}
    </button>
  </div>
);

// Example usage (replace with your logic):
// <OverlayButton onClick={() => setMicOn(v => !v)} active={micOn} title="Voice">
//   <Mic size={16} />
// </OverlayButton>
