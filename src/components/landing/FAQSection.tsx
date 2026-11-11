import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { getSupportWhatsAppLink } from "@/config/contact";
import { cn } from "@/lib/utils";

// Preços, desconto, teste e regras copiados da versão anterior — não alterar sem validação comercial.
const faqs = [
    {
        category: "Geral",
        questions: [
            {
                question: `O que é o ${BRAND.name}?`,
                answer: `O ${BRAND.name} é um sistema de agendamento online e gestão para negócios de serviços, como salões de beleza, barbearias e estúdios de estética. Ele automatiza agendamentos, gerencia clientes, controla finanças e muito mais - tudo em uma única plataforma acessível pelo celular ou computador.`
            },
            {
                question: "Preciso instalar algum programa?",
                answer: `Não! O ${BRAND.name} funciona 100% na nuvem. Você pode acessar pelo navegador do celular, tablet ou computador. Também oferecemos um app PWA que pode ser instalado na tela inicial do seu dispositivo para acesso rápido.`
            },
            {
                question: "O sistema funciona offline?",
                answer: "O app pode ser instalado na tela inicial do celular, mas é preciso estar conectado à internet para agendar e consultar a agenda."
            }
        ]
    },
    {
        category: "Pagamento",
        questions: [
            {
                question: `Quanto custa o ${BRAND.name}?`,
                answer: `O ${BRAND.name} oferece dois planos: Mensal (R$ 39,90/mês) e Anual (R$ 400,00/ano com 15% de desconto). Ambos incluem TODAS as funcionalidades, sem limite de profissionais ou agendamentos.`
            },
            {
                question: "Vale a pena assinar o plano anual?",
                answer: "Sim! Com o plano anual você economiza R$ 78,80 por ano (equivale a R$ 33,33/mês). Além disso, não precisa se preocupar com renovações mensais."
            },
            {
                question: "Posso testar antes de assinar?",
                answer: "Sim! Ao criar sua conta você tem 30 dias de teste grátis com acesso a todas as funcionalidades, sem cadastrar cartão de crédito. A assinatura (mensal ou anual) é feita depois, pela InfinitePay ou pelo Mercado Pago."
            },
            {
                question: "Existe contrato?",
                answer: "Sim. Na contratação, o contrato é preenchido automaticamente com os dados do seu negócio e assinado eletronicamente pelas duas partes, via Autentique, com validade jurídica. Ele inclui os termos de proteção de dados (LGPD)."
            },
            {
                question: "Como funciona o pagamento?",
                answer: "O pagamento é feito por cartão de crédito ou PIX pela InfinitePay, ou por cartão, PIX ou boleto pelo Mercado Pago. Você pode escolher entre pagamento mensal ou anual. Pode cancelar a qualquer momento, sem multas."
            },
            {
                question: "Vocês cobram taxa sobre os agendamentos?",
                answer: "Não! Diferente de outros sistemas, não cobramos nenhuma taxa sobre os serviços realizados no seu negócio. O valor da assinatura é fixo."
            }
        ]
    },
    {
        category: "Funcionalidades",
        questions: [
            {
                question: "Como funciona a integração com WhatsApp?",
                answer: `Você conecta o WhatsApp do seu negócio ao ${BRAND.name} e o sistema envia automaticamente: confirmações de agendamento, lembretes antes do horário (você escolhe a antecedência), avisos de cancelamento e reagendamento e mensagens de aniversário. Cada automação pode ser ativada separadamente.`
            },
            {
                question: "Meus clientes conseguem agendar sozinhos?",
                answer: "Sim! Você recebe um link próprio do seu negócio (ex.: …/s/seu-negocio) que pode compartilhar nas redes sociais. Os clientes acessam, escolhem o serviço, profissional e horário - sem precisar ligar."
            },
            {
                question: "Como funciona o retorno automático de procedimentos?",
                answer: "Em cada serviço você define o prazo de retorno (7, 15, 30, 60, 90, 120, 180 dias ou personalizado). Ao concluir o atendimento, o sistema calcula a data e, nesse dia, avisa o cliente por WhatsApp, e-mail e no app — e você também é avisado. Se o cliente reagendar antes, o lembrete é cancelado sozinho."
            },
            {
                question: "Meus clientes veem a minha marca ou a do sistema?",
                answer: "A sua. A página de agendamento e o app que o cliente instala no celular mostram a logo e as cores do seu negócio, e os e-mails chegam com o nome do seu negócio como remetente."
            },
            {
                question: "O sistema é acessível?",
                answer: "Sim. Seguimos as diretrizes WCAG 2.2 nível AA: o texto sobre a cor do seu negócio é ajustado para ficar sempre legível, os botões são fáceis de tocar e as telas funcionam com teclado e leitor de tela."
            },
            {
                question: "Posso gerenciar múltiplas unidades?",
                answer: "Sim! O plano inclui gestão de múltiplas unidades. Você consegue ver relatórios consolidados ou separados por filial, tudo no mesmo painel."
            },
            {
                question: "O sistema calcula comissões automaticamente?",
                answer: "Sim! Você define a porcentagem de comissão de cada profissional e o sistema calcula automaticamente com base nos serviços realizados. No final do mês, é só consultar o relatório."
            }
        ]
    },
    {
        category: "Suporte",
        questions: [
            {
                question: "Como funciona o suporte?",
                // ponytail: removidos "tempo médio de resposta de 2 horas" e "tutoriais em vídeo" (não verificados).
                answer: "Oferecemos suporte via WhatsApp, e-mail e chat dentro do sistema. Também há uma central de ajuda com tutoriais dentro do painel."
            },
            {
                question: "Vocês ajudam a migrar meus dados?",
                answer: "Sim! Nossa equipe ajuda você a importar sua lista de clientes e configurar todos os serviços. A migração é gratuita."
            },
            {
                question: "E se eu quiser cancelar?",
                answer: "Você pode cancelar a qualquer momento pelo próprio painel, sem burocracia. Não cobramos multa e seus dados ficam disponíveis para exportação por 30 dias após o cancelamento."
            }
        ]
    }
];

export const FAQSection = () => {
    const [activeCategory, setActiveCategory] = useState("Geral");
    const currentFAQs = faqs.find(f => f.category === activeCategory)?.questions || [];

    return (
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 bg-surface-1 py-16 md:py-24">
            <div className="container px-4">
                <div className="mx-auto mb-10 max-w-2xl text-center">
                    <h2 id="faq-title" className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                        Perguntas frequentes
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground">Tudo que você precisa saber para começar.</p>
                </div>

                <div role="group" aria-label="Categorias de perguntas" className="mb-8 flex flex-wrap justify-center gap-2">
                    {faqs.map(({ category }) => (
                        <button
                            key={category}
                            type="button"
                            aria-pressed={activeCategory === category}
                            onClick={() => setActiveCategory(category)}
                            className={cn(
                                "h-11 rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                activeCategory === category
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "border border-border bg-card text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <Accordion key={activeCategory} type="single" collapsible className="mx-auto max-w-3xl space-y-3">
                    {currentFAQs.map((faq) => (
                        <AccordionItem key={faq.question} value={faq.question} className="rounded-2xl border border-border bg-card px-6 shadow-sm">
                            <AccordionTrigger className="min-h-11 text-left text-base font-medium text-foreground hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>

                <div className="mt-12 text-center">
                    <p className="mb-4 text-muted-foreground">Não encontrou sua dúvida?</p>
                    <Button asChild variant="outline" size="lg">
                        <a href={getSupportWhatsAppLink('support')} target="_blank" rel="noopener noreferrer">
                            <MessageCircle aria-hidden />
                            Fale conosco no WhatsApp
                        </a>
                    </Button>
                </div>
            </div>
        </section>
    );
};
