import { useState } from 'react';
import { getEstablishmentBranding, type PwaIdentity } from '../../../api/_pwa';

type SalonLike = Omit<PwaIdentity, 'slug'> & { slug?: string | null };

/** Logo/foto anexada pelo salão; se ausente ou quebrada, iniciais nas cores do salão (nunca a marca da plataforma). */
export function SalonLogo({ salon, className = '' }: { salon: SalonLike; className?: string }) {
  const b = getEstablishmentBranding({ ...salon, slug: salon.slug || undefined });
  const [failed, setFailed] = useState<string | null>(null);
  return b.logo && failed !== b.logo
    ? <img src={b.logo} alt={`Logo de ${salon.name}`} className={`object-contain bg-card ${className}`} onError={() => setFailed(b.logo)} />
    : <span role="img" aria-label={`Logo de ${salon.name}`} className={`inline-flex shrink-0 items-center justify-center font-bold ${className}`}
        style={{ backgroundColor: b.primary, color: b.primaryForeground }}>{b.initials}</span>;
}
