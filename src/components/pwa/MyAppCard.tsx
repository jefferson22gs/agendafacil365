import { useEffect, useState } from 'react';
import { Copy, ExternalLink, ImageUp, Share2, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { publicOrigin } from '@/config/brand';
import { hexColor, identity, textOnColor } from '../../../api/_pwa';

export interface PwaFields {
  pwa_name: string; pwa_short_name: string; pwa_description: string;
  pwa_theme_color: string; pwa_background_color: string; pwa_icon_url: string; pwa_enabled: boolean;
}
interface Props {
  salonId?: string; salonName: string; slug: string; logoUrl: string; primaryColor: string;
  value: PwaFields; onChange: (patch: Partial<PwaFields>) => void; ownerId?: string;
}

// <input type=color> só aceita #rrggbb minúsculo.
const toPickerHex = (c: string) => (c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c).toLowerCase();
const ICON_TYPES:Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_BYTES = 1024 * 1024;

/** Lê as dimensões no navegador antes do upload (o arquivo nunca é enviado se for inválido). */
const imageSize = (file: File) => new Promise<{ w: number; h: number }>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
  img.onerror = () => { reject(new Error('invalid')); URL.revokeObjectURL(url); };
  img.src = url;
});

/** "Meu aplicativo": o app instalável do salão (nome, cores, ícone), prévias e divulgação do link. */
export function MyAppCard({ salonId, salonName, slug, logoUrl, primaryColor, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [devices, setDevices] = useState<number | null>(null);
  const app = identity({ name: salonName || 'Seu salão', primary_color: primaryColor, logo_url: logoUrl, ...value });
  // Prévia aceita a imagem que o dono acabou de colocar mesmo antes de salvar (o manifest só usa imagem do Storage).
  const previewIcon = value.pwa_icon_url || logoUrl || null;
  const link = slug ? `${publicOrigin()}/s/${slug}` : '';
  const colorInvalid = (c: string) => !!c && hexColor(c, '') === '';

  useEffect(() => {
    if (!salonId) return;
    let alive = true;
    // Aparelhos de clientes (sem dono/equipe) com inscrição Web Push ativa. Endpoint e chaves nunca chegam ao navegador.
    (supabase as any).rpc('push_overview', { p_salon_id: salonId })
      .then(({ data, error }: { data: { client_devices?: number } | null; error: unknown }) => { if (alive && !error) setDevices(Number(data?.client_devices) || 0); });
    return () => { alive = false; };
  }, [salonId]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !salonId) return;
    const ext = ICON_TYPES[file.type];
    if (!ext) { toast.error('Use uma imagem PNG, JPG ou WebP.'); return; }
    if (file.size > MAX_BYTES) { toast.error('Imagem muito grande. Máximo 1 MB.'); return; }
    let size: { w: number; h: number };
    try { size = await imageSize(file); } catch { toast.error('Não foi possível ler a imagem.'); return; }
    if (size.w < 192 || size.h < 192) { toast.error(`Imagem pequena (${size.w}×${size.h}). Use pelo menos 192×192; o ideal é 512×512.`); return; }
    if (Math.abs(size.w - size.h) > Math.max(size.w, size.h) * 0.1) toast.warning('A imagem não é quadrada; ela será centralizada no ícone. O ideal é 512×512.');
    setUploading(true);
    const path = `${salonId}/app-icon-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('gallery').upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) { toast.error('Não foi possível enviar o ícone.'); return; }
    onChange({ pwa_icon_url: supabase.storage.from('gallery').getPublicUrl(path).data.publicUrl });
    toast.success('Ícone enviado. Clique em Salvar para aplicar no app.');
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success('Link do app copiado!'); }
    catch { toast.error('Não foi possível copiar o link'); }
  };
  const share = async () => {
    const data = { title: app.name, text: `Instale o app de ${app.name} e agende em um toque:`, url: link };
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* cancelado pelo usuário */ }
    } else copy();
  };

  return (
    <Card className="md:col-span-2" data-tour="settings-myapp">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Smartphone size={20} className="text-primary" aria-hidden /> Meu aplicativo</CardTitle>
        <CardDescription>Seus clientes instalam o app de {salonName || 'seu salão'} pelo link e recebem notificações dele.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4" data-tour="settings-myapp-enabled">
          <div className="space-y-1">
            <Label htmlFor="pwa_enabled">App próprio ativo</Label>
            <p className="text-sm text-muted-foreground">Quando desligado, a página pública não oferece instalar nem ativar notificações.</p>
          </div>
          <Switch id="pwa_enabled" checked={value.pwa_enabled} onCheckedChange={(v) => onChange({ pwa_enabled: v })} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4" data-tour="settings-myapp-fields">
            <div className="space-y-2">
              <Label htmlFor="pwa_name">Nome do app</Label>
              <Input id="pwa_name" maxLength={60} value={value.pwa_name} placeholder={salonName} onChange={(e) => onChange({ pwa_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwa_short_name">Nome curto (abaixo do ícone)</Label>
              <Input id="pwa_short_name" maxLength={24} value={value.pwa_short_name} placeholder={app.shortName} onChange={(e) => onChange({ pwa_short_name: e.target.value })} aria-describedby="pwa_short_name_hint" />
              <p id="pwa_short_name_hint" className="text-xs text-muted-foreground">Até 12 caracteres aparecem inteiros na maioria dos celulares.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwa_description">Descrição</Label>
              <Textarea id="pwa_description" maxLength={300} rows={2} value={value.pwa_description} placeholder={`Agende seu horário em ${salonName || 'nosso salão'}.`} onChange={(e) => onChange({ pwa_description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-tour="settings-myapp-colors">
              {([['pwa_theme_color', 'Cor do app'], ['pwa_background_color', 'Cor da abertura']] as const).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <div className="flex gap-2">
                    <input type="color" aria-label={`${label} (seletor)`} value={toPickerHex(key === 'pwa_theme_color' ? app.color : app.background)}
                      onChange={(e) => onChange({ [key]: e.target.value })} className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border-0" />
                    <Input id={key} value={value[key]} placeholder={key === 'pwa_theme_color' ? app.color : app.background} maxLength={7}
                      aria-invalid={colorInvalid(value[key])} onChange={(e) => onChange({ [key]: e.target.value.trim() })} className="min-w-0" />
                  </div>
                  {colorInvalid(value[key]) && <p className="text-xs text-destructive">Use o formato #RRGGBB.</p>}
                </div>
              ))}
            </div>
            <div className="space-y-2" data-tour="settings-myapp-icon">
              <Label htmlFor="pwa_icon">Ícone do app</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" className="h-11" disabled={!salonId || uploading}>
                  <label htmlFor="pwa_icon" className="cursor-pointer"><ImageUp size={16} aria-hidden /> {uploading ? 'Enviando…' : 'Enviar ícone'}</label>
                </Button>
                <input id="pwa_icon" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={upload} disabled={!salonId || uploading} />
                {value.pwa_icon_url && (
                  <Button type="button" variant="ghost" className="h-11" onClick={() => onChange({ pwa_icon_url: '' })}><Trash2 size={16} aria-hidden /> Usar o logo</Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG ou WebP, quadrado, recomendado 512×512 (mínimo 192×192), até 1 MB. Sem ícone, usamos o logo do salão ou a inicial do nome.</p>
              {!salonId && <p className="text-xs text-muted-foreground">Salve o estabelecimento antes de enviar o ícone.</p>}
            </div>
          </div>

          <div className="min-w-0 space-y-4" data-tour="settings-myapp-preview">
            <p className="text-sm font-medium text-foreground">Prévia</p>
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex w-24 flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-4" aria-label="Prévia do ícone na tela inicial" role="img">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[18px]" style={{ backgroundColor: app.color }}>
                  {previewIcon ? <img src={previewIcon} alt="" className="h-[78%] w-[78%] rounded-lg object-cover" />
                    : <span className="text-2xl font-bold" style={{ color: textOnColor(app.color) }}>{(app.name[0] || 'A').toUpperCase()}</span>}
                </div>
                <span className="w-full truncate text-center text-[11px] text-white">{app.shortName}</span>
              </div>
              <div className="flex h-44 w-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border p-2" style={{ backgroundColor: app.background }} aria-label="Prévia da tela de abertura" role="img">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl" style={{ backgroundColor: app.color }}>
                  {previewIcon ? <img src={previewIcon} alt="" className="h-full w-full object-cover" />
                    : <span className="text-lg font-bold" style={{ color: textOnColor(app.color) }}>{(app.name[0] || 'A').toUpperCase()}</span>}
                </div>
                <span className="w-full truncate text-center text-[11px] font-medium" style={{ color: textOnColor(app.background) }}>{app.name}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">No iPhone o ícone usa o logo enviado (PNG/JPG/WebP); a abertura é gerada pelo sistema.</p>

            <div className="space-y-2" data-tour="settings-myapp-share">
              <Label>Link do app</Label>
              <div className="min-w-0 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm">{link || 'Defina o slug e salve para gerar o link.'}</div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-11" onClick={copy} disabled={!link}><Copy size={16} aria-hidden /> Copiar link do app</Button>
                <Button type="button" variant="outline" className="h-11" onClick={share} disabled={!link}><Share2 size={16} aria-hidden /> Compartilhar</Button>
                <Button type="button" variant="ghost" className="h-11" onClick={() => window.open(link, '_blank', 'noopener')} disabled={!link}><ExternalLink size={16} aria-hidden /> Abrir</Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground" data-tour="settings-myapp-devices">
              {devices === null ? 'Aparelhos inscritos: —' : `${devices} ${devices === 1 ? 'aparelho de cliente inscrito' : 'aparelhos de clientes inscritos'} para receber notificações.`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
