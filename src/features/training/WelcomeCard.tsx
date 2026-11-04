import { Sparkles, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTraining } from "./TrainingProvider";
import { useFirstSteps } from "./useFirstSteps";

const WELCOME_KEY = "welcome";
const WELCOME_VERSION = 1;

/**
 * Boas-vindas depois que o salão existe. Aparece uma vez por usuário e salão, não bloqueia nada
 * e não aparece para quem já usa o sistema (salão com serviços, equipe e agendamentos).
 */
export function WelcomeCard() {
  const { progress, startTour } = useTraining();
  const { hasSalon, isLoading, snapshot, nextTask } = useFirstSteps();
  const record = progress.get(WELCOME_KEY, WELCOME_VERSION);

  if (isLoading || progress.isLoading || !hasSalon || !snapshot) return null;
  if (record && record.status !== "in_progress") return null;
  const experienced = snapshot.services > 0 && snapshot.professionals > 0 && snapshot.appointments > 0;
  if (experienced && !record) return null;

  const close = (status: "completed" | "skipped") =>
    progress.save({ key: WELCOME_KEY, version: WELCOME_VERSION, kind: "welcome", status });

  const startGuided = async () => {
    await close("completed");
    // Começa pelo que falta: o checklist define a prioridade (serviços → profissionais → link...).
    await startTour(nextTask?.tourId ?? "overview");
  };

  return (
    <Card className="border-primary/30" data-tour="welcome-card">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0" aria-hidden>
            <Sparkles className="text-primary" size={22} aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-semibold">Seu estabelecimento está criado!</h2>
              <button
                type="button"
                onClick={() => void close("skipped")}
                className="touch-target -m-2 rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Fechar boas-vindas"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Agora vamos preparar o Agenda Fácil 365 para receber seus clientes. Eu mostro onde clicar, passo a passo.
              Você pode parar quando quiser e continuar depois pelo botão <strong>Ajuda</strong>.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="brand" onClick={() => void startGuided()}>
                Começar configuração guiada
              </Button>
              <Button variant="outline" onClick={() => void startTour("overview").then(() => close("completed"))}>
                Conhecer o sistema
              </Button>
              <Button variant="ghost" onClick={() => void close("skipped")}>
                Explorar sozinho
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
