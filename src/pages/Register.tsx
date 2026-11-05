import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/icons/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft, Check, Loader2, Store } from "lucide-react";
import { BRAND } from "@/config/brand";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Seller {
    id: string;
    name: string;
    email: string;
}

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [formData, setFormData] = useState({
    salonName: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    sellerId: "", // Campo para indicar quem indicou
  });

  const { signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    // Carregar lista de vendedores (apenas ativos)
    const loadSellers = async () => {
      try {
        const { data } = await supabase
          .from("sellers")
          .select("id, name, email")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (data) {
          setSellers(data);
        }
      } catch (error) {
        console.error("Error loading sellers:", error);
        // Não falhar o cadastro se não conseguir carregar vendedores
      }
    };

    loadSellers();

    // Verificar se há código de indicação na URL
    const urlParams = new URLSearchParams(window.location.search);
    const sellerParam = urlParams.get("seller");
    if (sellerParam) {
      setFormData(prev => ({ ...prev, sellerId: sellerParam }));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Passar o vendedor selecionado para o cadastro
    const { error } = await signUp(
      formData.email,
      formData.password,
      formData.name,
      formData.phone,
      formData.sellerId, // Passar vendedor que indicou
      formData.salonName
    );

    if (!error) {
      navigate('/dashboard');
    }

    setIsLoading(false);
  };

  const benefits = [
    "21 dias grátis para testar",
    "Sem cartão de crédito",
    "Suporte completo",
    "Cancele quando quiser",
  ];

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
                Crie sua conta grátis
              </h1>
              <p className="text-muted-foreground">
                Comece a organizar seu negócio agora mesmo
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
              <div className="space-y-2">
                <Label htmlFor="salonName">Nome do negócio</Label>
                <Input
                  id="salonName"
                  name="salonName"
                  type="text"
                  autoComplete="organization"
                  placeholder="Ex: Barbearia Premium"
                  value={formData.salonName}
                  onChange={handleChange}
                  className="h-12"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Como podemos te chamar?"
                  value={formData.name}
                  onChange={handleChange}
                  className="h-12"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="h-12"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={handleChange}
                  className="h-12"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    aria-describedby="password-hint"
                    value={formData.password}
                    onChange={handleChange}
                    className="h-12 pr-12"
                    required
                    minLength={6}
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
                <p id="password-hint" className="text-xs text-muted-foreground">Use pelo menos 6 caracteres.</p>
              </div>

              {/* Campo para selecionar vendedor que indicou */}
              {sellers.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="seller" className="flex items-center gap-2">
                    <Store className="w-4 h-4" aria-hidden="true" />
                    Quem te indicou? (Opcional)
                  </Label>
                  {/* Radix Select proíbe item com value="" (lança erro): "none" representa "sem vendedor". */}
                  <Select
                    value={formData.sellerId || "none"}
                    onValueChange={(value) => setFormData({ ...formData, sellerId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger id="seller" className="h-12" aria-describedby="seller-hint">
                      <SelectValue placeholder="Ninguém, me encontrei sozinho" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguém, me encontrei sozinho</SelectItem>
                      {sellers.map((seller) => (
                        <SelectItem key={seller.id} value={seller.id}>
                          {seller.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p id="seller-hint" className="text-xs text-muted-foreground">
                    Selecione quem te indicou o sistema para que ele receba comissão pela venda.
                  </p>
                </div>
              )}

              <Button type="submit" variant="brand" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                    Criando conta...
                  </>
                ) : (
                  'Criar minha conta grátis'
                )}
              </Button>

              {/* BLOQUEIO DE PUBLICAÇÃO: Termos de Uso e Política de Privacidade ainda não existem.
                  Os links "#" foram removidos; inserir os documentos aprovados juridicamente antes do lançamento. */}
            </form>

            <p className="text-center mt-6 text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link to="/login" className="inline-flex min-h-11 items-center text-primary hover:underline font-medium">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Painel secundário (apenas desktop). Depoimento e números não verificados removidos no rebranding. */}
      <aside className="hidden lg:flex items-center justify-center bg-brand-navy p-12 text-white">
        <div className="max-w-sm">
          <Logo size="lg" variant="white" />
          <h2 className="font-display text-3xl font-bold mt-10 mb-8">
            Por que escolher o {BRAND.name}?
          </h2>
          <ul className="space-y-5">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Check size={16} className="text-brand-sky" aria-hidden="true" />
                </span>
                <span className="text-lg">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
};

export default Register;

