import { Logo } from "@/components/icons/Logo";
import { Instagram, MessageCircle, ExternalLink } from "lucide-react";
import { BRAND } from "@/config/brand";
import { DEVELOPER_INFO, getSupportWhatsAppLink } from "@/config/contact";
import { WcagBadge } from "@/components/a11y/WcagBadge";

// Páginas legais são HTML estático em public/ (legíveis por robôs da Meta sem JavaScript).
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
    title: "Legal",
    links: [
      { label: "Privacidade", href: "/privacidade" },
      { label: "Termos de uso", href: "/termos" },
      { label: "Exclusão de dados", href: "/exclusao-de-dados" },
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
        <div className="mb-10 grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-7">
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
          <div className="flex flex-col items-center gap-1 md:items-start">
            <p>© {year} {BRAND.name}. Todos os direitos reservados.</p>
            <WcagBadge />
          </div>
          <p className="flex flex-wrap items-center justify-center gap-x-2 md:justify-end">
            <span>Desenvolvido por</span>
            <a
              href={DEVELOPER_INFO.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${DEVELOPER_INFO.company} (site, abre em nova aba)`}
              className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {DEVELOPER_INFO.company}
            </a>
            <span aria-hidden="true">·</span>
            <a
              href={DEVELOPER_INFO.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`WhatsApp ${DEVELOPER_INFO.whatsappFormatted} (abre em nova aba)`}
              className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <MessageCircle size={14} aria-hidden />
              {DEVELOPER_INFO.whatsappFormatted}
            </a>
            <span aria-hidden="true">·</span>
            <a
              href={DEVELOPER_INFO.instagramLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram ${DEVELOPER_INFO.instagram} (abre em nova aba)`}
              className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <Instagram size={14} aria-hidden />
              {DEVELOPER_INFO.instagram}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
