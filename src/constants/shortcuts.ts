{/* Shortcuts for Magic Dot */}
export const MAGIC_DOT_TOGGLE_COMBO = "Ctrl+H";
export const MAGIC_DOT_TOGGLE_KEYS: string[] = ["Ctrl", "H"];
export const MAGIC_DOT_TOGGLE_COOLDOWN_MS = 300;

{/* Shortcuts for Magic Chat */}

interface Shortcut {
    combo: string[];
    title: string;
    description: string;
}

export const shortcuts : Shortcut[] = [
    {
        combo: ["Ctrl", "H"],
        title: "Toggle overlay visibility",
        description: "Show or hide the overlay window"
    },
    {
        combo: ["Ctrl", "D"],
        title: "Toggle dock mode",
        description: "Dock or undock the overlay window"
    },
    {
        combo: ["Ctrl", "M"],
        title: "Center overlay bar",
        description: "Move overlay bar to center of screen"
    },
    {
        combo: ["Ctrl", "P"],
        title: "Toggle pin mode",
        description: "Pin or unpin the overlay bar"
    },
    {
        combo: ["Ctrl", "Shift", "Enter"],
        title: "Open chat",
        description: "Open the chat in the overlay window"
    }
]
