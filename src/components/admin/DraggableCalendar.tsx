import { useState, useMemo } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, GripVertical, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Appointment {
    id: string;
    clientName: string;
    serviceName: string;
    professionalName: string;
    time: string;
    duration: number; // minutes
    status: "scheduled" | "confirmed" | "completed" | "cancelled";
}

interface TimeSlot {
    time: string;
    appointments: Appointment[];
}

interface DraggableCalendarProps {
    appointments: Appointment[];
    onAppointmentMove?: (appointmentId: string, newTime: string) => void;
    date?: Date;
    onDateChange?: (date: Date) => void;
    className?: string;
}

// Sortable appointment item
function SortableAppointment({ appointment }: { appointment: Appointment }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: appointment.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const statusColors = {
        scheduled: "border-l-primary",
        confirmed: "border-l-success",
        completed: "border-l-muted-foreground",
        cancelled: "border-l-destructive",
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "p-3 rounded-lg bg-card border border-border border-l-4 transition-shadow",
                statusColors[appointment.status],
                isDragging && "shadow-lg opacity-90 z-50"
            )}
            {...attributes}
        >
            <div className="flex items-start gap-2">
                <button
                    {...listeners}
                    className="p-1 hover:bg-secondary rounded cursor-grab active:cursor-grabbing touch-target"
                    aria-label="Arrastar agendamento"
                >
                    <GripVertical size={16} className="text-muted-foreground" />
                </button>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{appointment.clientName}</p>
                    <p className="text-sm text-muted-foreground truncate">{appointment.serviceName}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {appointment.time} ({appointment.duration}min)
                        </span>
                        <span className="flex items-center gap-1">
                            <User size={12} />
                            {appointment.professionalName}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Time slot column
function TimeSlotColumn({ slot }: { slot: TimeSlot }) {
    const appointmentIds = slot.appointments.map(a => a.id);

    return (
        <div className="min-h-[100px]">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-muted-foreground w-14">{slot.time}</span>
                <div className="flex-1 h-px bg-border" />
            </div>
            {slot.appointments.length > 0 ? (
                <SortableContext items={appointmentIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 pl-16">
                        {slot.appointments.map((appointment) => (
                            <SortableAppointment key={appointment.id} appointment={appointment} />
                        ))}
                    </div>
                </SortableContext>
            ) : (
                <div className="h-16 pl-16">
                    <div className="h-full rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">Horário disponível</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export function DraggableCalendar({
    appointments,
    onAppointmentMove,
    date = new Date(),
    onDateChange,
    className,
}: DraggableCalendarProps) {
    const [currentDate, setCurrentDate] = useState(date);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Generate time slots (8:00 - 20:00)
    const timeSlots = useMemo(() => {
        const slots: TimeSlot[] = [];
        for (let hour = 8; hour <= 20; hour++) {
            const time = `${hour.toString().padStart(2, "0")}:00`;
            slots.push({
                time,
                appointments: appointments.filter(a => a.time.startsWith(hour.toString().padStart(2, "0"))),
            });
        }
        return slots;
    }, [appointments]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            // Find the target time slot based on the over element
            const activeAppointment = appointments.find(a => a.id === active.id);
            if (activeAppointment) {
                toast.success(`Agendamento movido para novo horário`);
                onAppointmentMove?.(active.id as string, over.id as string);
            }
        }
    };

    const navigateDate = (direction: "prev" | "next") => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
        setCurrentDate(newDate);
        onDateChange?.(newDate);
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
        });
    };

    const activeAppointment = activeId
        ? appointments.find(a => a.id === activeId)
        : null;

    return (
        <Card className={className}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Agenda do Dia</CardTitle>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => navigateDate("prev")} aria-label="Dia anterior">
                        <ChevronLeft size={18} />
                    </Button>
                    <span className="text-sm font-medium sm:min-w-[200px] text-center capitalize">
                        {formatDate(currentDate)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => navigateDate("next")} aria-label="Próximo dia">
                        <ChevronRight size={18} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="space-y-2">
                        {timeSlots.map((slot) => (
                            <TimeSlotColumn key={slot.time} slot={slot} />
                        ))}
                    </div>

                    <DragOverlay>
                        {activeAppointment && (
                            <div className="p-3 rounded-lg bg-card border border-primary shadow-xl opacity-90">
                                <p className="font-medium">{activeAppointment.clientName}</p>
                                <p className="text-sm text-muted-foreground">{activeAppointment.serviceName}</p>
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-primary" /> Agendado
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-success" /> Confirmado
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-muted-foreground" /> Concluído
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Arraste para reorganizar
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

// Sample data generator for testing
export function generateSampleAppointments(): Appointment[] {
    return [
        {
            id: "1",
            clientName: "Maria Silva",
            serviceName: "Corte + Escova",
            professionalName: "João",
            time: "09:00",
            duration: 60,
            status: "confirmed",
        },
        {
            id: "2",
            clientName: "Carlos Santos",
            serviceName: "Barba",
            professionalName: "Pedro",
            time: "09:30",
            duration: 30,
            status: "scheduled",
        },
        {
            id: "3",
            clientName: "Ana Oliveira",
            serviceName: "Coloração",
            professionalName: "Lucia",
            time: "10:00",
            duration: 120,
            status: "confirmed",
        },
        {
            id: "4",
            clientName: "Roberto Lima",
            serviceName: "Corte Masculino",
            professionalName: "João",
            time: "14:00",
            duration: 30,
            status: "scheduled",
        },
        {
            id: "5",
            clientName: "Fernanda Costa",
            serviceName: "Manicure + Pedicure",
            professionalName: "Carla",
            time: "15:00",
            duration: 90,
            status: "scheduled",
        },
    ];
}
