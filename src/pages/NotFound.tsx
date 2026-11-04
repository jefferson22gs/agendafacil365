import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Logo } from "@/components/icons/Logo";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-md">
        <Logo size="md" variant="auto" className="mb-6" />
        <p className="mb-2 text-sm font-semibold text-primary">Erro 404</p>
        <h1 className="mb-3 font-display text-2xl font-bold text-foreground">Página não encontrada</h1>
        <p className="mb-6 text-muted-foreground">
          O endereço que você acessou não existe ou foi movido. Confira o link ou volte para a página inicial.
        </p>
        <Button asChild variant="brand" size="lg" className="w-full sm:w-auto">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  );
};

export default NotFound;
