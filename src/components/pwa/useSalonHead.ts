import { useEffect } from 'react';
import { identity, textOnColor, type PwaIdentity } from '../../../api/_pwa';
import { salonTheme } from '@/lib/salonTheme';
import { setTenantApp } from '@/hooks/usePWA';

/** Altera um <link>/<meta> do head e devolve a função que restaura o valor original (ou remove o que criou). */
function setHead(selector: string, create: () => HTMLElement, attr: string, value: string): () => void {
  let el = document.head.querySelector<HTMLElement>(selector);
  const created = !el;
  const previous = el?.getAttribute(attr) ?? null;
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
  return () => {
    if (created) el!.remove();
    else if (previous === null) el!.removeAttribute(attr);
    else el!.setAttribute(attr, previous);
  };
}
const meta = (name: string) => () => Object.assign(document.createElement('meta'), { name });
const link = (rel: string) => () => Object.assign(document.createElement('link'), { rel });

/**
 * Head do app do salão enquanto /s/:slug está aberta: manifest próprio (/api/manifest/:slug), theme-color,
 * título, e as metas do iOS (apple-touch-icon, apple-mobile-web-app-title, status-bar). Tudo é restaurado no unmount
 * para a identidade do salão não vazar para outras rotas. Demo: nada (sem PWA).
 */
export function useSalonHead(salon: (Omit<PwaIdentity, 'slug'> & { slug?: string | null; updated_at?: string | null }) | null) {
  const key = salon ? JSON.stringify(salon) : '';
  useEffect(() => {
    if (!salon || import.meta.env.MODE === 'demo') return;
    const app = identity({ ...salon, slug: salon.slug || undefined });
    setTenantApp(salon.slug || 'salon');
    const root = document.documentElement;
    const tokens = salonTheme(salon.primary_color || app.color, root.classList.contains('dark'));
    const previousTokens = Object.keys(tokens).map(k => [k, root.style.getPropertyValue(k)]);
    const applyTheme = () => Object.entries(salonTheme(salon.primary_color || app.color, root.classList.contains('dark')))
      .forEach(([k, v]) => root.style.setProperty(k, v));
    applyTheme();
    const observer = new MutationObserver(applyTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    const version = salon.updated_at ? `?v=${encodeURIComponent(salon.updated_at)}` : '';
    const previousTitle = document.title;
    document.title = `${salon.name} | Agendamento`;
    const restore = [
      ...(salon.slug && salon.pwa_enabled !== false ? [setHead('link[rel="manifest"]', link('manifest'), 'href', `/api/manifest/${encodeURIComponent(salon.slug)}${version}`)] : []),
      setHead('meta[name="theme-color"]', meta('theme-color'), 'content', app.color),
      ...(salon.slug ? [setHead('link[rel="apple-touch-icon"]', link('apple-touch-icon'), 'href', `/api/icon/${encodeURIComponent(salon.slug)}?format=png&size=180${version ? `&${version.slice(1)}` : ''}`)] : []),
      ...Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')).map(el => {
        const old = el.href, type = el.type;
        el.href = salon.slug ? `/api/icon/${encodeURIComponent(salon.slug)}?format=png&size=192` : app.logo || 'data:,';
        el.removeAttribute('type');
        return () => { el.href = old; el.type = type; };
      }),
      setHead('meta[name="apple-mobile-web-app-title"]', meta('apple-mobile-web-app-title'), 'content', app.shortName),
      setHead('meta[name="application-name"]', meta('application-name'), 'content', app.shortName),
      setHead('meta[name="apple-mobile-web-app-status-bar-style"]', meta('apple-mobile-web-app-status-bar-style'), 'content',
        // "black-translucent" desenharia a página sob a barra de status (o cabeçalho não reserva a safe area).
        textOnColor(app.color) === '#FFFFFF' ? 'black' : 'default'),
    ];
    return () => {
      observer.disconnect();
      previousTokens.forEach(([k, v]) => v ? root.style.setProperty(k, v) : root.style.removeProperty(k));
      restore.reverse().forEach(r => r()); document.title = previousTitle; setTenantApp(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
