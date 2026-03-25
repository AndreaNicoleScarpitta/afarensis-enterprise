import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary-600 text-white hover:bg-primary-700",
        secondary:
          "border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200",
        destructive:
          "border-transparent bg-error-100 text-error-700 hover:bg-error-200",
        outline: "text-gray-700 border-gray-300",
        success:
          "border-transparent bg-success-100 text-success-700",
        warning:
          "border-transparent bg-warning-100 text-warning-700",
        info:
          "border-transparent bg-info-100 text-info-700",
        purple:
          "border-transparent bg-purple-100 text-purple-700",
        // Regulatory status variants
        approved: "border-transparent bg-success-100 text-success-700",
        pending: "border-transparent bg-warning-100 text-warning-700",
        rejected: "border-transparent bg-error-100 text-error-700",
        review: "border-transparent bg-info-100 text-info-700",
        draft: "border-transparent bg-gray-100 text-gray-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
