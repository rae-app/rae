import React, { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

type Variant = "filled" | "outline" | "text";

const variants: Record<Variant, string> = {
  filled:
    "rounded-lg dark:bg-stone-800/20 border-2 outline-none focus:border-white  hover:dark:bg-stone-800 dark:border-surface dark:text-white font-bold",
  outline:
    "border-2 font-medium hover:bg-foreground/10 border-border focus:border-surface !outline-none",
  text: "",
};

// Extend button props for proper typing, including className
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const Button = ({
  variant = "filled",
  children,
  className,
  onClick,
  ...props
}: ButtonProps) => {
  return (
    <button
      // whileTap={{ scale: 0.9 }}
      onClick={onClick}
      {...props}
      className={twMerge(
        `${variants[variant]} px-4 py-2  !cursor-pointer   rounded-lg duration-100 transition-colors`,
        className,
      )}
    >
      {children}
    </button>
  );
};

export default Button;
