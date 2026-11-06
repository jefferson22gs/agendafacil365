import { createContext, useContext, type ReactNode } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";

/** Telas antigas renderizadas dentro da central: sem segundo AdminLayout. */
export const EmbeddedContext = createContext(false);
export const PageShell = ({ children }: { children: ReactNode }) =>
  useContext(EmbeddedContext) ? <>{children}</> : <AdminLayout>{children}</AdminLayout>;
