import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTraining } from "./TrainingProvider";
import type { FirstStepId, FirstStepTask } from "./types";

export const FIRST_STEPS_KEY = "first-steps";
export const FIRST_STEPS_VERSION = 1;

interface SalonSnapshot {
  hasSalon: boolean;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  slug: string | null;
  publicBooking: boolean;
  hasHours: boolean;
  services: number;
  professionals: number;
  appointments: number;
}

const countRows = async (table: "services" | "professionals" | "appointments", salonId: string) => {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("salon_id", salonId);
  if (error) throw error;
  return count ?? 0;
};

/** Lê só o necessário para saber o que já foi configurado. Nunca grava nada. */
export function useSalonSnapshot() {
  const { salonId } = useTraining();
  return useQuery({
    queryKey: ["training-snapshot", salonId],
    enabled: Boolean(salonId),
    staleTime: 30_000,
    queryFn: async (): Promise<SalonSnapshot> => {
      const [{ data: salon, error }, services, professionals, appointments] = await Promise.all([
        supabase
          .from("salons")
          .select("name, phone, whatsapp, address, slug, public_booking_enabled, working_hours, opening_time, closing_time")
          .eq("id", salonId!)
          .maybeSingle(),
        countRows("services", salonId!),
        countRows("professionals", salonId!),
        countRows("appointments", salonId!),
      ]);
      if (error) throw error;
      const hours = salon?.working_hours;
      const hasHours =
        (!!hours && typeof hours === "object" && Object.keys(hours as object).length > 0) ||
        Boolean(salon?.opening_time && salon?.closing_time);
      return {
        hasSalon: Boolean(salon),
        name: salon?.name ?? null,
        phone: salon?.phone ?? null,
        whatsapp: salon?.whatsapp ?? null,
        address: salon?.address ?? null,
        slug: salon?.slug ?? null,
        publicBooking: salon?.public_booking_enabled !== false,
        hasHours,
        services,
        professionals,
        appointments,
      };
    },
  });
}

/** Checklist "Primeiros passos" detectado pelos dados reais + evento de compartilhamento do link. */
export function useFirstSteps() {
  const { salonId, progress } = useTraining();
  const snapshot = useSalonSnapshot();
  const record = progress.get(FIRST_STEPS_KEY, FIRST_STEPS_VERSION);
  const linkShared = record?.metadata?.linkShared === true;
  const dismissed = record?.metadata?.dismissed === true;

  const tasks = useMemo<FirstStepTask[]>(() => {
    const s = snapshot.data;
    const done: Record<FirstStepId, boolean> = {
      "salon-info": Boolean(s?.name && (s.phone || s.whatsapp) && s.address),
      hours: Boolean(s?.hasHours),
      service: (s?.services ?? 0) > 0,
      professional: (s?.professionals ?? 0) > 0,
      "public-link": Boolean(s?.slug && s.publicBooking),
      "share-link": linkShared,
      "first-appointment": (s?.appointments ?? 0) > 0,
    };
    const list: Omit<FirstStepTask, "done">[] = [
      { id: "salon-info", title: "Complete os dados do estabelecimento", description: "Nome, telefone ou WhatsApp e endereço.", route: "/admin/settings", tourId: "settings-info" },
      { id: "hours", title: "Defina os horários de funcionamento", description: "Dias e horários em que o estabelecimento atende.", route: "/admin/settings", tourId: "settings-hours" },
      { id: "service", title: "Cadastre seu primeiro serviço", description: "Com preço e duração.", route: "/admin/services", tourId: "services" },
      { id: "professional", title: "Cadastre um profissional", description: "Quem vai atender os clientes.", route: "/admin/professionals", tourId: "professionals" },
      { id: "public-link", title: "Ative seu link de agendamento", description: "A página onde o cliente marca sozinho.", route: "/admin/settings", tourId: "settings-public-link" },
      { id: "share-link", title: "Copie ou abra seu link", description: "Teste como o cliente vê e compartilhe.", route: "/admin/settings", tourId: "settings-public-link" },
      { id: "first-appointment", title: "Receba o primeiro agendamento", description: "Marque um teste ou peça a um cliente.", route: "/admin/appointments", tourId: "appointments" },
    ];
    return list.map((t) => ({ ...t, done: done[t.id] }));
  }, [snapshot.data, linkShared]);

  const completed = tasks.filter((t) => t.done).length;
  const nextTask = tasks.find((t) => !t.done);

  return {
    salonId,
    hasSalon: snapshot.data?.hasSalon ?? false,
    isLoading: snapshot.isLoading || progress.isLoading,
    tasks,
    completed,
    total: tasks.length,
    nextTask,
    dismissed,
    snapshot: snapshot.data,
    refetch: snapshot.refetch,
  };
}

/** Registra que o dono copiou/abriu o link público (passo 6). Chamado pelos botões de Configurações. */
export function useMarkLinkShared() {
  const { progress } = useTraining();
  return () =>
    progress.save({
      key: FIRST_STEPS_KEY,
      version: FIRST_STEPS_VERSION,
      kind: "first_steps",
      status: "in_progress",
      metadata: { linkShared: true },
    });
}
