import React, { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check as CheckIcon } from "@phosphor-icons/react";

export interface OptionProps {
  label: string;
  value: string;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  variant?: "simple" | "rich";
}

const Option: React.FC<OptionProps> = ({
  label,
  value,
  icon,
  active = false,
  disabled = false,
  onClick,
  className = "",
  variant = "simple",
}) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  if (variant === "rich") {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`flex gap-2 text-sm w-full transition-colors duration-100 px-2 py-1 dark:text-stone-400 font-medium hover:dark:text-white hover:dark:bg-stone-900 ${
          active && "dark:!bg-surface dark:!text-white"
        } ${
          disabled && "opacity-50 cursor-not-allowed"
        } rounded-md items-center ${className}`}
      >
        {icon}
        {label}
        {active && (
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
    );
  }

  // Simple variant
  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`h-9 text-left px-3 text-sm transition-colors whitespace-nowrap dark:text-stone-300 hover:dark:text-white hover:dark:bg-stone-900 ${
        active ? "font-semibold dark:bg-stone-900" : ""
      } ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
    </button>
  );
};

export default Option;
