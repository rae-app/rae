import React from "react";

interface OverlayMaximizedProps {
  currentPage: string;
  isMaximized: boolean;
}

const OverlayMaximized: React.FC<OverlayMaximizedProps> = ({
  currentPage,
  isMaximized,
}) => {
  const sharedClass = `text-foreground overflow-y-auto ${
    isMaximized ? "w-full px-6 py-4 mt-2" : "flex-1 p-4"
  }`;
  const sharedStyle = isMaximized ? { height: "calc(100vh - 80px)" } : {};

  switch (currentPage) {
    case "chat":
      return null;
    case "settings":
      return (
        <div className={sharedClass} style={sharedStyle}>
          <h2 className="text-xl font-semibold mb-6">Settings</h2>
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <h3 className="font-medium mb-2">Preferences</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Configure your app preferences here
              </p>
            </div>
            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <h3 className="font-medium mb-2">Shortcuts</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Manage keyboard shortcuts
              </p>
            </div>
          </div>
        </div>
      );
    case "notes":
      return (
        <div className={sharedClass} style={sharedStyle}>
          <h2 className="text-xl font-semibold mb-6">Notes</h2>
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <h3 className="font-medium mb-2">Your Notes</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Access and manage your notes
              </p>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
};

export default OverlayMaximized;
