import { HTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "bordered";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = "default",
      padding = "md",
      hover = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = "rounded-xl transition-all duration-300";

    const variantStyles = {
      default: "bg-white dark:bg-background-secondary border border-gray-200 dark:border-gray-800",
      glass: "glass",
      bordered: "border-2 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-background-tertiary",
    };

    const paddingStyles = {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    };

    const hoverStyles = hover ? "card-hover cursor-pointer" : "";

    return (
      <div
        ref={ref}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          paddingStyles[padding],
          hoverStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export default Card;

// Card sub-components for better composition
export const CardHeader = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("mb-4", className)} {...props}>
    {children}
  </div>
);

CardHeader.displayName = "CardHeader";

export const CardTitle = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={clsx("text-xl font-semibold text-gray-900 dark:text-white", className)} {...props}>
    {children}
  </h3>
);

CardTitle.displayName = "CardTitle";

export const CardDescription = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={clsx("text-gray-600 dark:text-gray-400 text-sm", className)} {...props}>
    {children}
  </p>
);

CardDescription.displayName = "CardDescription";

export const CardContent = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("", className)} {...props}>
    {children}
  </div>
);

CardContent.displayName = "CardContent";

export const CardFooter = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("mt-6 pt-4 border-t border-gray-200 dark:border-gray-800", className)} {...props}>
    {children}
  </div>
);

CardFooter.displayName = "CardFooter";
