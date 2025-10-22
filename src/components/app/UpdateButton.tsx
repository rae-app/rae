import { ArrowCircleUpIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useUpdateCheck, handleUpdateClick } from "@/utils/updateUtils";
import { emit, listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

interface UpdateButtonProps {
  expanded: boolean;
  onClick?: () => void;
  active?: boolean;
}

export const UpdateButton = ({
  expanded,
  onClick,
  active = false,
}: UpdateButtonProps) => {
  const updateAvailable = useUpdateCheck();
  const [isUpdating, setIsUpdating] = useState(false);

  // Emit update-needed event when update is available
  useEffect(() => {
    if (updateAvailable) {
      console.log(
        "[Main Window] Update available - emitting 'update-needed' to overlay",
      );
      emit("update-needed", { available: true });
    } else {
      console.log(
        "[Main Window] No update available - emitting 'update-needed' to overlay",
      );
      emit("update-needed", { available: false });
    }
  }, [updateAvailable]);

  // Listen for update-now event from overlay
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen("update-now", async () => {
        console.log(
          "[Main Window] Received 'update-now' event from overlay - starting update process",
        );
        setIsUpdating(true);
        try {
          await handleUpdateClick();
        } catch (error) {
          console.error("[Main Window] Update failed:", error);
        } finally {
          setIsUpdating(false);
        }
      });

      return unlisten;
    };

    let unlisten: (() => void) | undefined;
    setupListener().then((unlistenFn) => {
      unlisten = unlistenFn;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleClick = () => {
    onClick?.();
    if (updateAvailable) {
      console.log(
        "[Main Window] Update button clicked - starting update process",
      );
      handleUpdateClick();
    }
  };

  return (
    <motion.button
      whileHover="hover"
      initial={{
        paddingInline: expanded ? "0px" : "0px",
        fontSize: expanded ? "14px" : "14px",
      }}
      animate={{
        paddingInline: expanded ? "0px" : "0px",
        fontSize: expanded ? "14px" : "14px",
      }}
      onClick={handleClick}
      disabled={isUpdating}
      className={`w-full shrink-0 group h-[44px] flex items-center overflow-hidden rounded-lg cursor-pointer flex-nowrap whitespace-nowrap font-medium duration-100 relative ${
        updateAvailable && expanded
          ? "dark:bg-red-500/90 dark:text-white dark:hover:bg-red-600 animate-pulse"
          : `dark:bg-stone-800/20 dark:hover:text-white dark:hover:bg-stone-800 transition-colors dark:text-stone-400 ${
              active && "dark:!bg-stone-800 dark:!text-white"
            }`
      } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <motion.div
        animate={{
          fontSize: expanded ? "14px" : "20px",
        }}
        className="h-full aspect-square flex items-center justify-center shrink-0 relative"
      >
        <motion.div
          variants={{
            hover: {
              y: -2,
            },
          }}
          transition={{ duration: 0.2, ease: "easeInOut", type: "tween" }}
        >
          <ArrowCircleUpIcon className={isUpdating ? "animate-spin" : ""} />
        </motion.div>
        {updateAvailable && !expanded && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"
          >
            <div className="w-full h-full bg-red-500 rounded-full animate-ping" />
          </motion.div>
        )}
      </motion.div>
      <motion.div
        className="min-w-fit w-full pr-4 text-left"
        animate={{ opacity: !expanded ? 0 : 1 }}
      >
        {expanded
          ? isUpdating
            ? "Updating..."
            : updateAvailable
              ? "Update available"
              : "No updates available"
          : "Updates"}
      </motion.div>
    </motion.button>
  );
};
