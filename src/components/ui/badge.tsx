import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        pirlsLocate: "border-blue-300 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700",
        pirlsInfer: "border-green-300 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 dark:border-green-700",
        pirlsInterpret: "border-yellow-300 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700",
        pirlsEvaluate: "border-purple-300 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, // Changed from HTMLDivElement to HTMLSpanElement
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
