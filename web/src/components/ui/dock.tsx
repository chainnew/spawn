import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { motion } from "framer-motion"

interface DockProps {
  className?: string
  items: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    onClick?: () => void
    active?: boolean
  }[]
}

export default function Dock({ items, className }: DockProps) {
  const [hovered, setHovered] = React.useState<number | null>(null)

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 rounded-full",
        "border border-[#333] bg-[#1a1a1a]/90 backdrop-blur-xl shadow-2xl",
        className
      )}
    >
      <TooltipProvider delayDuration={0}>
        {items.map((item, i) => {
          const isHovered = hovered === i

          return (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <motion.div
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  animate={{
                    scale: isHovered ? 1.15 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7 rounded-full",
                      "transition-all duration-150",
                      "hover:bg-white/10",
                      item.active && "bg-spawn-accent/20 text-spawn-accent"
                    )}
                    onClick={item.onClick}
                  >
                    <item.icon
                      className={cn(
                        "h-3.5 w-3.5",
                        item.active ? "text-spawn-accent" : "text-gray-400",
                        isHovered && "text-white"
                      )}
                    />
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] px-2 py-1">
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </TooltipProvider>
    </motion.div>
  )
}
