import { contrastRatio, DARK_TEXT, hexColor, LIGHT_TEXT, textOnColor } from '../../api/_pwa';

const hsl = (color: string): string => {
  const h = hexColor(color).slice(1);
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  const hue = !d ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return `${(hue * 60).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
};

/**
 * Tokens CSS do salão. Botão: cor do salão + texto calculado (>=4.5:1). Texto/foco sobre a superfície:
 * usa a cor do salão só se ela tiver 4.5:1 contra o fundo; senão cai no texto padrão do tema (sempre legível).
 */
export function salonTheme(color: string, dark: boolean): Record<string, string> {
  const bg = hexColor(color);
  const surfaces = dark ? ['#0B1220', '#14213D'] : ['#F4F8FF', '#FFFFFF'];
  const text = surfaces.every(s => contrastRatio(bg, s) >= 4.5) ? bg : dark ? LIGHT_TEXT : DARK_TEXT;
  return {
    '--primary': hsl(bg), '--primary-hover': hsl(bg), '--primary-foreground': hsl(textOnColor(bg)),
    '--primary-text': hsl(text), '--ring': hsl(text), '--tenant-text': text,
  };
}
