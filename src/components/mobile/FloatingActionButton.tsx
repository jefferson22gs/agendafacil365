import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Calendar, Users, Gift, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FABAction {
    icon: React.ElementType;
    label: string;
    path?: string;
    onClick?: () => void;
    color?: string;
}

interface FloatingActionButtonProps {
    actions?: FABAction[];
    className?: string;
}

const defaultActions: FABAction[] = [
    { icon: Calendar, label: "Novo Agendamento", path: "/admin/appointments", color: "bg-primary" },
    { icon: Users, label: "Novo Cliente", path: "/admin/clients", color: "bg-primary" },
    { icon: Gift, label: "Novo Cupom", path: "/admin/coupons", color: "bg-primary" },
    { icon: Settings, label: "Configurações", path: "/admin/settings", color: "bg-brand-navy" },
];

export function FloatingActionButton({ actions = defaultActions, className }: FloatingActionButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const handleAction = (action: FABAction) => {
        if (action.onClick) {
            action.onClick();
        } else if (action.path) {
            navigate(action.path);
        }
        setIsOpen(false);
    };

    return (
        <div className={cn("fixed bottom-24 right-4 z-50 lg:hidden", className)}>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-background/60 backdrop-blur-sm -z-10"
                        />

                        {/* Action buttons */}
                        <div className="absolute bottom-16 right-0 flex flex-col-reverse gap-3">
                            {actions.map((action, index) => (
                                <motion.button
                                    key={action.label}
                                    initial={{ opacity: 0, scale: 0, y: 20 }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        y: 0,
                                        transition: { delay: index * 0.05 }
                                    }}
                                    exit={{
                                        opacity: 0,
                                        scale: 0,
                                        y: 20,
                                        transition: { delay: (actions.length - index) * 0.03 }
                                    }}
                                    onClick={() => handleAction(action)}
                                    className="flex items-center gap-3"
                                >
                                    <span className="bg-card border border-border px-3 py-2 rounded-lg text-sm font-medium shadow-lg whitespace-nowrap">
                                        {action.label}
                                    </span>
                                    <div className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center text-primary-foreground shadow-lg",
                                        action.color || "bg-primary"
                                    )} aria-hidden>
                                        <action.icon size={20} />
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* Main FAB button */}
            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? "Fechar ações rápidas" : "Abrir ações rápidas"}
                aria-expanded={isOpen}
                className={cn(
                    "w-14 h-14 rounded-full bg-primary hover:bg-brand-hover shadow-brand",
                    "flex items-center justify-center text-primary-foreground shadow-lg",
                    "transition-all duration-300",
                    isOpen && "rotate-45"
                )}
            >
                {isOpen ? <X size={24} aria-hidden /> : <Plus size={24} aria-hidden />}
            </motion.button>
        </div>
    );
}
