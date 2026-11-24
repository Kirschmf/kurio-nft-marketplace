import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Slot } from "@radix-ui/react-slot";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
const buttonVariants = cva(
  "button transition-colors disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "button-primary",
        primary: "button-primary",
        outline: "button-outline",
        ghost: "button-ghost",
      },
      size: { default: "", sm: "button-small", icon: "button-icon" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export function Button({
  className,
  variant,
  size,
  type = "button",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
