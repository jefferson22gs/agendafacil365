import { useState, useRef, useCallback, ReactNode } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: ReactNode;
    className?: string;
    threshold?: number;
}

export function PullToRefresh({
    onRefresh,
    children,
    className,
    threshold = 80
}: PullToRefreshProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const y = useMotionValue(0);
    const rotate = useTransform(y, [0, threshold], [0, 360]);
    const opacity = useTransform(y, [0, threshold / 2, threshold], [0, 0.5, 1]);
    const scale = useTransform(y, [0, threshold], [0.5, 1]);

    const handleDrag = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        // Only allow pull if at top of scroll
        if (containerRef.current && containerRef.current.scrollTop === 0 && info.offset.y > 0) {
            setIsPulling(true);
            y.set(Math.min(info.offset.y * 0.5, threshold * 1.2));
        }
    }, [y, threshold]);

    const handleDragEnd = useCallback(async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (y.get() >= threshold && !isRefreshing) {
            setIsRefreshing(true);
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
            }
        }
        setIsPulling(false);
        y.set(0);
    }, [y, threshold, isRefreshing, onRefresh]);

    return (
        <div className={cn("relative overflow-hidden", className)}>
            {/* Pull indicator */}
            <motion.div
                style={{ opacity, scale }}
                className="absolute top-0 left-0 right-0 flex items-center justify-center py-4 pointer-events-none z-10"
            >
                <motion.div
                    style={{ rotate }}
                    className={cn(
                        "w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center",
                        isRefreshing && "animate-spin"
                    )}
                >
                    <RefreshCw size={20} className="text-primary" />
                </motion.div>
            </motion.div>

            {/* Content wrapper */}
            <motion.div
                ref={containerRef}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                style={{ y: isPulling || isRefreshing ? y : 0 }}
                className="h-full overflow-auto"
            >
                {children}
            </motion.div>

            {/* Refreshing overlay */}
            {isRefreshing && (
                <div role="status" className="absolute top-0 left-0 right-0 py-4 flex items-center justify-center bg-background/90">
                    <div className="flex items-center gap-2 text-primary">
                        <RefreshCw size={16} className="animate-spin" />
                        <span className="text-sm font-medium">Atualizando...</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// Simple hook for pull to refresh logic
export function usePullToRefresh(onRefresh: () => Promise<void>) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const refresh = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing, onRefresh]);

    return { isRefreshing, refresh };
}
