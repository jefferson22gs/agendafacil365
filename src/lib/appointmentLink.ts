import { publicOrigin } from "@/config/brand";

// Link público para o cliente ver, cancelar ou reagendar o agendamento.
// A rota /appointment/:token (ManageAppointment) busca pelo cancellation_token,
// preenchido automaticamente pelo trigger set_appointment_cancellation_token.
// Recebe o agendamento inteiro porque cancellation_token ainda não está em
// src/integrations/supabase/types.ts (tipos gerados desatualizados).
export function getAppointmentManageLink(appointment: object | null | undefined): string {
  const token = (appointment as { cancellation_token?: string | null } | null)?.cancellation_token;
  if (!token) return "";
  return `${publicOrigin()}/appointment/${token}`;
}
