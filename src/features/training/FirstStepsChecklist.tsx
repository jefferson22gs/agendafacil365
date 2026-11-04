import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, ChevronRight, PlayCircle, X, PartyPopper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTraining } from "./TrainingProvider";
import { FIRST_STEPS_KEY, FIRST_STEPS_VERSION, useFirstSteps } from "./useFirstSteps";

interface Props {
  /** Na Central mostra sempre; no Dashboard some quando concluído ou dispensado. */
  variant?: "dashboard" | "center";
}

export function FirstStepsChecklist({ variant = "dashboard" }: Props) {
  const navigate = useNavigate();
  const { startTour, progress } = useTraining();
  const { tasks, completed, total, nextTask, dismissed, hasSalon, isLoading } = useFirstSteps();

  if (isLoading || !hasSalon) return null;
  const allDone = completed === total;
  if (variant === "dashboard" && (dismissed || allDone)) return null;

  const dismiss = () =>
    void progress.save({
      key: FIRST_STEPS_KEY,
      version: FIRST_STEPS_VERSION,
      kind: "first_steps",
      status: "in_progress",
      metadata: { dismissed: true },
    });

  const percent = Math.round((completed / total) * 100);

  return (
    <Card data-tour="first-steps">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Primeiros passos</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {allDone
                ? "Seu estabelecimento está pronto para receber clientes."
                : `${completed} de ${total} concluídos. ${percent >= 50 ? "Falta pouco!" : "Vamos deixar seu estabelecimento pronto."}`}
            </p>
          </div>
          {variant === "dashboard" && (
            <button
              type="button"
              onClick={dismiss}
              className="touch-target -m-2 rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Ocultar primeiros passos (continua disponível na Central de Treinamento)"
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </div>
        <Progress value={percent} className="h-2 mt-3" aria-label={`Progresso: ${percent}%`} />
      </CardHeader>
      <CardContent className="pt-0">
        {allDone ? (
          <div className="flex items-center gap-3 rounded-xl bg-primary/10 p-3 text-sm">
            <PartyPopper size={20} className="text-primary flex-shrink-0" aria-hidden />
            <span>Pronto! Agora explore Clientes, WhatsApp e Financeiro na Central de Treinamento.</span>
          </div>
        ) : (
          <ul className="space-y-1">
            {tasks.map((task) => {
              const isNext = task.id === nextTask?.id;
              return (
                <li key={task.id}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-2",
                      isNext && "bg-primary/5 ring-1 ring-primary/20",
                    )}
                  >
                    {task.done ? (
                      <CheckCircle2 size={20} className="text-success flex-shrink-0" aria-label="Concluído" />
                    ) : (
                      <Circle size={20} className="text-muted-foreground flex-shrink-0" aria-label="Pendente" />
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(task.route)}
                      className="flex-1 min-w-0 min-h-[44px] text-left rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className={cn("text-sm font-medium", task.done && "text-muted-foreground line-through")}>{task.title}</p>
                      {!task.done && <p className="text-xs text-muted-foreground">{task.description}</p>}
                    </button>
                    {!task.done && task.tourId && (
                      <Button
                        size="sm"
                        variant={isNext ? "default" : "ghost"}
                        className="flex-shrink-0"
                        onClick={() => void startTour(task.tourId!)}
                        aria-label={`Me mostre: ${task.title}`}
                      >
                        {isNext ? (
                          <>
                            <PlayCircle size={16} className="mr-1" aria-hidden /> Me mostre
                          </>
                        ) : (
                          <ChevronRight size={16} aria-hidden />
                        )}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
