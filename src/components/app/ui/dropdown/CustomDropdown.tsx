import React, { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface DropdownOption {
  label: string;
  value: string;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

interface CustomDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  options?: DropdownOption[];
  children?: ReactNode;
  className?: string;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  minWidth?: string;
  variant?: "simple" | "rich";
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  isOpen,
  onClose,
  options,
  children,
  className = "",
  position = "bottom-left",
  minWidth = "160px",
  variant = "simple",
}) => {
  const getPositionClasses = () => {
    switch (position) {
      case "bottom-left":
        return "left-1 bottom-full mb-1";
      case "bottom-right":
        return "right-1 bottom-full mb-1";
      case "top-left":
        return "left-1 top-full mt-1";
      case "top-right":
        return "right-1 top-full mt-1";
      default:
        return "left-1 bottom-full mb-1";
    }
  };

  const getTransformOrigin = () => {
    switch (position) {
      case "bottom-left":
        return "bottom left";
      case "bottom-right":
        return "bottom right";
      case "top-left":
        return "top left";
      case "top-right":
        return "top right";
      default:
        return "bottom left";
    }
  };

  if (variant === "rich") {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0.9, scaleY: 0.95 }}
            animate={{
              opacity: 1,
              scaleX: 1,
              scaleY: 1,
            }}
            exit={{
              opacity: 0,
              scaleX: 0.9,
              scaleY: 0.95,
            }}
            style={{
              transformOrigin: getTransformOrigin(),
              minWidth,
            }}
            transition={{
              duration: 0.2,
              ease: "circInOut",
            }}
            className={`dark:bg-stone-950 z-40 overflow-hidden rounded-lg shadow-xl shadow-black/40 absolute flex flex-col border border-border ${getPositionClasses()} ${className}`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="h-fit p-1 flex flex-col gap-1"
            >
              {children
                ? React.Children.map(children, (child) => {
                    if (React.isValidElement(child)) {
                      return React.cloneElement(child as any, {
                        onClick: (...args: any[]) => {
                          (child.props as any).onClick?.(...args);
                          onClose();
                        },
                      });
                    }
                    return child;
                  })
                : options?.map((option, index) => (
                    <button
                      key={option.value || index}
                      onClick={() => {
                        option.onClick?.();
                        onClose();
                      }}
                      className={`flex gap-2 text-sm w-full transition-colors duration-100 px-2 py-1 dark:text-stone-400 font-medium hover:dark:text-white hover:dark:bg-stone-900 ${
                        option.active && "dark:!bg-surface dark:!text-white"
                      } rounded-md items-center`}
                    >
                      {option.icon}
                      {option.label}
                      {option.active && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="ml-auto"
                          transition={{
                            duration: 0.2,
                            ease: "easeInOut",
                            type: "tween",
                          }}
                        >
                          <CheckIcon className="" weight="bold" />
                        </motion.div>
                      )}
                    </button>
                  ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Simple variant (for models dropdown)
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.12, ease: "easeInOut" }}
          className={`absolute z-40 overflow-hidden rounded-lg shadow-xl shadow-black/40 dark:bg-stone-950 border border-border ${getPositionClasses()} ${className}`}
          style={{ minWidth }}
        >
          <div className="flex flex-col py-1">
            {children
              ? React.Children.map(children, (child) => {
                  if (React.isValidElement(child)) {
                    return React.cloneElement(child as any, {
                      onClick: (...args: any[]) => {
                        (child.props as any).onClick?.(...args);
                        onClose();
                      },
                    });
                  }
                  return child;
                })
              : options?.map((option, index) => (
                  <button
                    key={option.value || index}
                    className={`h-9 text-left px-3 text-sm transition-colors whitespace-nowrap dark:text-stone-300 hover:dark:text-white hover:dark:bg-stone-900 ${
                      option.active ? "font-semibold dark:bg-stone-900" : ""
                    }`}
                    onClick={() => {
                      option.onClick?.();
                      onClose();
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                  </button>
                ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Import CheckIcon for the rich variant
import { Check as CheckIcon } from "@phosphor-icons/react";

export default CustomDropdown;
