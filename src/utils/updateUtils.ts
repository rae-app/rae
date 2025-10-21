import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";

export const checkForUpdate = async (): Promise<boolean> => {
  try {
    const update = await check();
    return !!update; // true if an update is available
  } catch (error) {
    console.error("Failed to check for updates:", error);
    return false;
  }
};

export const useUpdateCheck = (): boolean => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const checkUpdate = async () => {
      const hasUpdate = await checkForUpdate();
      setUpdateAvailable(hasUpdate);
    };

    checkUpdate();

    // Optional: check periodically, e.g., every hour
    const interval = setInterval(checkUpdate, 120000);

    return () => clearInterval(interval);
  }, []);

  return updateAvailable;
};

export const handleUpdateClick = async (): Promise<void> => {
  try {
    const update = await check();
    if (!update) {
      console.log("No update available");
      return;
    }

    console.log(`Found update ${update.version}: ${update.body}`);

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          console.log(`Downloading ${event.data.contentLength} bytes...`);
          break;
        case "Progress":
          console.log(`Downloaded ${event.data.chunkLength} bytes`);
          break;
        case "Finished":
          console.log(
            "Download complete. On Windows, app will relaunch automatically.",
          );
          break;
      }
    });
  } catch (error) {
    console.error("Failed to handle update:", error);
  }
};
