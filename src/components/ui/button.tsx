import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "destructive" | "ghost" | "link" | "destructive_outline"; // Add variants used
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

// inline-flex keeps leading icons on the same line as the label
// (Tailwind preflight makes svg display:block)
const BASE_STYLE =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-hairline-strong focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANT_STYLES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-cta text-on-cta hover:bg-cta-hover",
  outline: "border border-hairline-strong text-copy hover:bg-surface-hover",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  destructive_outline: "border border-red-300 text-red-600 hover:bg-red-50",
  ghost: "hover:bg-surface-hover text-copy",
  link: "text-blue-600 hover:underline",
};

const SIZE_STYLES: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "px-4 py-2 text-sm",
  sm: "h-8 px-3 text-xs",
  lg: "px-6 py-3 text-lg",
  icon: "h-9 w-9 p-0",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const style = `${BASE_STYLE} ${VARIANT_STYLES[variant ?? "default"]} ${SIZE_STYLES[size ?? "default"]}`;
    const Comp = asChild ? "span" : "button"; // Simplification, Radix Slot would be better
    return <Comp className={`${style} ${className || ""}`} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button };
