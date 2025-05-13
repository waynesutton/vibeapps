import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "destructive" | "ghost" | "link" | "destructive_outline"; // Add variants used
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Basic styling, expand this or use a proper UI library like ShadCN
    let baseStyle =
      "px-4 py-2 rounded-md text-sm font-medium focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

    if (variant === "outline") {
      baseStyle += " border border-gray-300 text-gray-700 hover:bg-gray-50";
    } else if (variant === "destructive") {
      baseStyle += " bg-red-600 text-white hover:bg-red-700";
    } else if (variant === "destructive_outline") {
      baseStyle += " border border-red-300 text-red-600 hover:bg-red-50";
    } else if (variant === "ghost") {
      baseStyle += " hover:bg-gray-100 text-gray-700";
    } else if (variant === "link") {
      baseStyle += " text-blue-600 hover:underline";
    } else {
      // default
      baseStyle += " bg-black text-white hover:bg-gray-800";
    }

    if (size === "sm") {
      baseStyle = `px-3 py-1 rounded-md text-xs font-medium focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${baseStyle.replace(/px-4 py-2 text-sm/g, "")}`;
    } else if (size === "lg") {
      baseStyle = `px-6 py-3 rounded-md text-lg font-medium focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${baseStyle.replace(/px-4 py-2 text-sm/g, "")}`;
    }
    // Add more size handling if needed

    const Comp = asChild ? "span" : "button"; // Simplification, Radix Slot would be better
    return <Comp className={`${baseStyle} ${className || ""}`} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button };
