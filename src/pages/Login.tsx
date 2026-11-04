import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/icons/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft, Loader2, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BRAND } from "@/config/brand";
import { getSupportWhatsAppLink } from "@/config/contact";

// Recursos reais do plano (mesma lista exibida em Checkout/Assinatura).
const highlights = [
  "Agendamento online",
  "Gestão de clientes",
  "Controle financeiro",
  "Integração com WhatsApp",
];

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (!error) {
      navigate('/dashboard');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* Formulário (prioridade no mobile) */}
      <main className="flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar ao início
          </Link>

          {/* No desktop o logo aparece no painel navy */}
          <div className="mb-6 lg:hidden">
            <Logo size="md" variant="default" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-md sm:p-8">
            <div className="mb-6">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Bem-vindo de volta
              </h1>
              <p className="text-muted-foreground">
                Entre na sua conta para continuar
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {/* ponytail: não há fluxo de recuperação (sem tela de nova senha nem redirect no Supabase Auth).
                      Encaminha ao suporte real até o fluxo ser implementado. */}
                  <a href={getSupportWhatsAppLink('support')} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    Esqueceu a senha?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-12"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    aria-controls="password"
                    className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <Button type="submit" variant="brand" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <p className="text-center mt-6 text-sm text-muted-foreground">
              Não tem uma conta?{" "}
              <Link to="/register" className="inline-flex min-h-11 items-center text-primary hover:underline font-medium">
                Criar conta grátis
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Painel secundário (apenas desktop) */}
      <aside className="hidden lg:flex items-center justify-center bg-brand-navy p-12 text-white">
        <div className="max-w-sm">
          <Logo size="lg" variant="white" />
          <h2 className="font-display text-3xl font-bold mt-10 mb-3">
            Agendamento e gestão para o seu negócio
          </h2>
          <p className="text-white/80 mb-8">{BRAND.description}</p>
          <ul className="space-y-4">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <Check size={18} className="text-brand-sky flex-shrink-0" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
};

export default Login;
