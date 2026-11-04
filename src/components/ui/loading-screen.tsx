import { Logo } from '@/components/icons/Logo';

interface LoadingScreenProps {
  message?: string;
}

// Spinner discreto em volta do símbolo da marca; respeita prefers-reduced-motion.
export const LoadingScreen = ({ message = 'Carregando...' }: LoadingScreenProps) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-background flex flex-col items-center justify-center gap-4"
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin motion-reduce:animate-none"
        />
        <Logo showText={false} size="sm" variant="auto" decorative />
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
};
