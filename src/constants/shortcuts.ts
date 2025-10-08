{
  /* Shortcuts for Magic Dot */
}
export const MAGIC_DOT_TOGGLE_COMBO = "CommandOrControl+H";
export const MAGIC_DOT_TOGGLE_COOLDOWN_MS = 300;

{
  /* Shortcuts for showing overlay in center */
}
export const SHOW_OVERLAY_CENTER_COMBO = "CommandOrControl+M";
export const SHOW_OVERLAY_CENTER_COOLDOWN_MS = 300;

{
  /* Shortcuts for Magic Chat */
}

interface Shortcut {
  combo: string[];
  title: string;
  description: string;
}

export const shortcuts: Shortcut[] = [
  {
    combo: ["Cmd", "H"],
    title: "Toggle overlay visibility",
    description: "Show or hide the overlay window",
  },
  {
    combo: ["Cmd", "M"],
    title: "Center overlay bar",
    description: "Move overlay bar to center of screen",
  },
  {
    combo: ["Cmd", "P"],
    title: "Toggle pin mode",
    description: "Pin or unpin the overlay bar",
  },
];
