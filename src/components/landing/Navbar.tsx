import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/icons/Logo";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { DEMO_URL, IS_DEMO } from "@/config/demo";

const navLinks = [
  { label: "Funcionalidades", href: "#features" },
  { label: "Preços", href: "#pricing" },
  { label: "Sobre", href: "#about" },
  { label: "Contato", href: "#contact" },
];

const linkClass =
  "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
      <nav aria-label="Principal" className="container px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo size="sm" />
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={linkClass}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2 md:flex">
            {!IS_DEMO && (
              <Button asChild variant="outline" className="h-11">
                <a href={DEMO_URL}>Ver demonstração</a>
              </Button>
            )}
            <Button asChild variant="ghost" className="h-11">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild variant="brand" className="h-11 px-5">
              <Link to="/register">Criar conta grátis</Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            aria-expanded={isOpen}
            aria-controls="landing-mobile-menu"
            aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            {isOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </nav>

      {isOpen && (
        <div id="landing-mobile-menu" className="border-t border-border bg-card shadow-md md:hidden">
          <div className="container space-y-1 px-4 py-4">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={close} className={`${linkClass} flex min-h-11 items-center text-base`}>
                {link.label}
              </a>
            ))}
            <div className="grid gap-2 pt-3">
              {!IS_DEMO && (
                <Button asChild variant="outline" className="h-11 w-full">
                  <a href={DEMO_URL}>Ver demonstração</a>
                </Button>
              )}
              <Button asChild variant="outline" className="h-11 w-full">
                <Link to="/login" onClick={close}>Entrar</Link>
              </Button>
              <Button asChild variant="brand" className="h-11 w-full">
                <Link to="/register" onClick={close}>Criar conta grátis</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
