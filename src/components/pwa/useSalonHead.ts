import { useEffect } from 'react';
import { identity, textOnColor, type PwaIdentity } from '../../../api/_pwa';
import { BRAND } from '@/config/brand';

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
export function useSalonHead(salon: (PwaIdentity & { slug: string; updated_at?: string | null }) | null) {
  const key = salon ? JSON.stringify(salon) : '';
  useEffect(() => {
    if (!salon || import.meta.env.MODE === 'demo') return;
    const app = identity(salon);
    const version = salon.updated_at ? `?v=${encodeURIComponent(salon.updated_at)}` : '';
    const previousTitle = document.title;
    document.title = `${salon.name} | Agendamento`;
    const restore = [
      setHead('link[rel="manifest"]', link('manifest'), 'href', `/api/manifest/${salon.slug}${version}`),
      setHead('meta[name="theme-color"]', meta('theme-color'), 'content', app.color),
      // iOS ignora SVG no apple-touch-icon: logo do Storage (PNG/JPG/WebP) ou o PNG da plataforma.
      setHead('link[rel="apple-touch-icon"]', link('apple-touch-icon'), 'href', app.logo ?? BRAND.assets.appleTouch),
      setHead('meta[name="apple-mobile-web-app-title"]', meta('apple-mobile-web-app-title'), 'content', app.shortName),
      setHead('meta[name="application-name"]', meta('application-name'), 'content', app.shortName),
      setHead('meta[name="apple-mobile-web-app-status-bar-style"]', meta('apple-mobile-web-app-status-bar-style'), 'content',
        // "black-translucent" desenharia a página sob a barra de status (o cabeçalho não reserva a safe area).
        textOnColor(app.color) === '#ffffff' ? 'black' : 'default'),
    ];
    return () => { restore.reverse().forEach(r => r()); document.title = previousTitle; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
