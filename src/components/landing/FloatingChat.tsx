import { useState, useEffect } from "react";
import { BRAND } from "@/config/brand";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { DEVELOPER_INFO, getSupportWhatsAppLink } from "@/config/contact";

const quickMessages = [
    "Quero conhecer o sistema",
    "Como funciona o trial?",
    "Preciso de ajuda para migrar",
    "Quanto custa?",
];

const botResponses: Record<string, string> = {
    "Quero conhecer o sistema": `Ótimo! 🎉 O ${BRAND.name} reúne agendamento online e gestão para negócios de serviços. Posso agendar uma demonstração gratuita para você! Qual melhor horário?`,
    "Como funciona o trial?": "Ao criar sua conta, você tem 30 dias de teste com TODAS as funcionalidades liberadas! 🚀 Não precisa de cartão de crédito. Quer começar agora?",
    "Preciso de ajuda para migrar": "Sem problemas! Nossa equipe faz a migração gratuita para você. 💪 Posso agendar?",
    "Quanto custa?": `O ${BRAND.name} tem 2 opções: 💰 Mensal R$ 39,90/mês ou Anual R$ 400,00/ano (15% de desconto!). Tudo incluso: profissionais ilimitados, agendamentos ilimitados, sem taxas extras. Quer criar sua conta e testar por 30 dias?`,
};

interface Message {
    id: number;
    text: string;
    isBot: boolean;
    timestamp: Date;
}

export const FloatingChat = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            text: `Olá! 👋 Sou a assistente virtual do ${BRAND.name}. Como posso ajudar você hoje?`,
            isBot: true,
            timestamp: new Date(),
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [showBubble, setShowBubble] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowBubble(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen]);

    const handleSendMessage = (text: string) => {
        if (!text.trim()) return;

        // Add user message
        const userMessage: Message = {
            id: messages.length + 1,
            text,
            isBot: false,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setInputValue("");

        // Simulate bot typing
        setIsTyping(true);
        setTimeout(() => {
            const botText = botResponses[text] ||
                "Entendi! 😊 Para um atendimento personalizado, vou te conectar com nossa equipe via WhatsApp. Clique no botão abaixo!";

            const botMessage: Message = {
                id: messages.length + 2,
                text: botText,
                isBot: true,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, botMessage]);
            setIsTyping(false);
        }, 1500);
    };

    return (
        <>
            {/* Floating Button */}
            <div className="fixed bottom-6 right-6 z-50">
                <AnimatePresence>
                    {showBubble && !isOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 10 }}
                            className="absolute bottom-full right-0 mb-3 mr-2 hidden whitespace-nowrap md:block"
                        >
                            <div className="bg-card border border-border rounded-2xl rounded-br-none px-4 py-3 shadow-lg">
                                <p className="text-sm text-foreground">💬 Precisa de ajuda?</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    type="button"
                    onClick={() => {
                        setIsOpen((v) => !v);
                        setShowBubble(false);
                    }}
                    aria-label={isOpen ? "Fechar chat de atendimento" : "Abrir chat de atendimento"}
                    aria-expanded={isOpen}
                    aria-controls="landing-chat"
                    className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-brand hover:bg-brand-hover transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    {isOpen ? <X size={24} aria-hidden /> : <MessageCircle size={24} aria-hidden />}
                </button>
            </div>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        id="landing-chat"
                        role="dialog"
                        aria-label={`Assistente ${BRAND.name}`}
                        className="fixed bottom-24 right-4 sm:right-6 z-50 w-[340px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-120px)]"
                    >
                        <div className="bg-card rounded-2xl overflow-hidden shadow-lg border border-border flex flex-col max-h-[500px]">
                            {/* Header */}
                            <div className="bg-primary p-3 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-white" aria-hidden />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white text-sm">Assistente {BRAND.shortName}</p>
                                        <p className="text-[10px] text-white/70">Respostas automáticas</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    aria-label="Fechar chat"
                                    className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                >
                                    <X size={18} aria-hidden />
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="h-[200px] overflow-y-auto p-3 space-y-3 bg-surface-1 flex-1" aria-live="polite">
                                {messages.map((message) => (
                                    <motion.div
                                        key={message.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.isBot
                                                ? 'bg-card border border-border rounded-bl-none'
                                                : 'bg-primary text-primary-foreground rounded-br-none'
                                                }`}
                                        >
                                            <p className="text-sm">{message.text}</p>
                                            <p className={`text-xs mt-1 ${message.isBot ? 'text-muted-foreground' : 'text-white/70'}`}>
                                                {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}

                                {isTyping && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex justify-start"
                                    >
                                        <div className="bg-card border border-border/50 rounded-2xl rounded-bl-none px-4 py-3">
                                            <div className="flex gap-1">
                                                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Quick Replies */}
                            <div className="px-3 py-2 border-t border-border/30 bg-card/50 flex-shrink-0">
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {quickMessages.map((msg, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => handleSendMessage(msg)}
                                            className="min-h-9 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {msg}
                                        </button>
                                    ))}
                                </div>

                                {/* Input */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                                        placeholder="Digite sua mensagem..."
                                        aria-label="Mensagem"
                                        className="flex-1 min-w-0 h-11 px-4 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleSendMessage(inputValue)}
                                        aria-label="Enviar mensagem"
                                        className="w-11 h-11 shrink-0 rounded-full bg-primary hover:bg-brand-hover flex items-center justify-center text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Send size={16} aria-hidden />
                                    </button>
                                </div>
                            </div>

                            {/* WhatsApp Link */}
                            <a
                                href={getSupportWhatsAppLink('demo')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-success text-center text-success-foreground text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <MessageCircle size={16} aria-hidden />
                                    Falar no WhatsApp ({DEVELOPER_INFO.whatsappFormatted})
                                </span>
                            </a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
