import { Logo } from "@/components/icons/Logo";
import { Instagram, MessageCircle, ExternalLink } from "lucide-react";
import { BRAND } from "@/config/brand";
import { DEVELOPER_INFO, getSupportWhatsAppLink } from "@/config/contact";

// ponytail: Blog, Termos de uso, Privacidade e Cookies apontavam para "#" (sem rota). Removidos até existirem páginas.
const footerColumns = [
  {
    title: "Produto",
    links: [
      { label: "Funcionalidades", href: "#features" },
      { label: "Preços", href: "#pricing" },
      { label: "Como funciona", href: "#how-it-works" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre", href: "#about" },
      { label: "Contato", href: getSupportWhatsAppLink('support') },
    ],
  },
  {
    title: "Suporte",
    links: [
      { label: "WhatsApp Suporte", href: getSupportWhatsAppLink('support') },
      { label: "Instagram", href: DEVELOPER_INFO.instagramLink },
    ],
  },
  {
    title: "Acesso",
    links: [
      { label: "Entrar", href: "/login" },
      { label: "Criar conta", href: "/register" },
    ],
  },
];

const socialLinks = [
  { icon: Instagram, href: DEVELOPER_INFO.instagramLink, label: "Instagram" },
  { icon: MessageCircle, href: DEVELOPER_INFO.whatsappLink, label: "WhatsApp" },
];

const linkClass =
  "inline-flex min-h-11 items-center gap-1 rounded text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0 md:py-1";

export const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card pt-12 pb-8 md:pt-16">
      <div className="container px-4">
        <div className="mb-10 grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2">
            <Logo className="mb-4" />
            <p className="mb-6 max-w-xs text-sm text-muted-foreground">{BRAND.description}</p>
            <div className="flex items-center gap-2">
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} (abre em nova aba)`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon size={18} aria-hidden />
                </a>
              ))}
            </div>
          </div>

          {footerColumns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-3 text-sm font-semibold text-foreground">{col.title}</h2>
              <ul className="space-y-1 md:space-y-2">
                {col.links.map((link) => {
                  const external = link.href.startsWith("http");
                  return (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noopener noreferrer" : undefined}
                        className={linkClass}
                      >
                        {link.label}
                        {external && <ExternalLink size={12} aria-hidden />}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-center text-sm text-muted-foreground md:flex-row md:text-left">
          <p>© {year} {BRAND.name}. Todos os direitos reservados.</p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
            <p>
              Desenvolvido por{" "}
              <a
                href={DEVELOPER_INFO.instagramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                {DEVELOPER_INFO.company}
              </a>
            </p>
            <a
              href={DEVELOPER_INFO.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 hover:text-foreground sm:min-h-0"
            >
              <MessageCircle size={14} aria-hidden />
              {DEVELOPER_INFO.whatsappFormatted}
            </a>
            <a
              href={DEVELOPER_INFO.instagramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 hover:text-foreground sm:min-h-0"
            >
              <Instagram size={14} aria-hidden />
              {DEVELOPER_INFO.instagram}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
