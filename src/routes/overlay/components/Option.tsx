import React from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Check as CheckIcon } from "@phosphor-icons/react";

interface OptionProps {
  icon: ReactNode;
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}

const Option = ({ icon, children, active, onClick }: OptionProps) => {
  return (
    <button
      onClick={onClick}
      className={`flex gap-2 text-sm w-full transition-colors duration-100 px-2 py-1 dark:text-zinc-400 font-medium hover:dark:text-white hover:dark:bg-zinc-900 ${
        active && "dark:!bg-surface dark:!text-white"
      } rounded-md items-center`}
    >
      {icon}
      {children}
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="ml-auto"
          transition={{ duration: 0.2, ease: "easeInOut", type: "tween" }}
        >
          <CheckIcon className="" weight="bold" />
        </motion.div>
      )}
    </button>
  );
};

export default Option;
