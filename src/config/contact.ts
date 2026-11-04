// Código Base - Developer Contact Information
// Agenda Fácil 365 é desenvolvido e mantido por Código Base

export const DEVELOPER_INFO = {
    company: "Código Base",
    whatsapp: "+5511986262240",
    whatsappFormatted: "+55 11 98626-2240",
    whatsappLink: "https://wa.me/5511986262240",
    instagram: "@codigo.base",
    instagramLink: "https://instagram.com/codigo.base",
    website: "https://w.app/codigobase",
    slogan: "Escale seu negócio com tecnologia. Sites, Apps e Automação que geram lucro.",
};

export const SUPPORT_LINKS = {
    whatsapp: DEVELOPER_INFO.whatsappLink,
    whatsappWithMessage: (message: string) =>
        `${DEVELOPER_INFO.whatsappLink}?text=${encodeURIComponent(message)}`,
    instagram: DEVELOPER_INFO.instagramLink,
};

// Pre-built WhatsApp messages
export const WHATSAPP_MESSAGES = {
    support: "Olá! Preciso de ajuda com o Agenda Fácil 365.",
    subscription: "Olá! Tenho uma dúvida sobre minha assinatura do Agenda Fácil 365.",
    demo: "Olá! Gostaria de saber mais sobre o Agenda Fácil 365.",
    trial: "Olá! Estou no período de teste do Agenda Fácil 365 e tenho uma dúvida.",
    bug: "Olá! Encontrei um problema no Agenda Fácil 365 e gostaria de reportar.",
};

export const getSupportWhatsAppLink = (type: keyof typeof WHATSAPP_MESSAGES = 'support') => {
    return SUPPORT_LINKS.whatsappWithMessage(WHATSAPP_MESSAGES[type]);
};
