# AgendaFacil365 - Sistema de Gestão para Salões de Beleza

**Sistema completo de gestão para salões de beleza e barbearias**

Desenvolvido por **Código Base**  
📞 WhatsApp: +55 11 98626-2240  
📸 Instagram: @codigo.base

---

## 🚀 Funcionalidades

- ✅ Agendamento Online 24/7
- ✅ Dashboard com métricas em tempo real
- ✅ Gestão de Clientes (CRM)
- ✅ Controle Financeiro completo
- ✅ Gestão de Profissionais
- ✅ Cupons e Promoções
- ✅ Sistema de Fidelidade
- ✅ BI Preditivo com IA
- ✅ Integração WhatsApp
- ✅ PWA (instala como app)
- ✅ Integração Mercado Pago

---

## 💰 Plano

**R$ 39,90/mês** - Tudo incluso, sem limitações

- 7 dias de teste grátis
- Profissionais ilimitados
- Agendamentos ilimitados
- Suporte prioritário

---

## 🛠️ Tecnologias

- **Frontend:** React 18 + TypeScript + Vite
- **Estilização:** TailwindCSS + ShadCN UI
- **Animações:** Framer Motion
- **Backend:** Supabase
- **Pagamentos:** Mercado Pago
- **PWA:** Vite PWA Plugin

---

## 📦 Instalação

```bash
# Clonar repositório
git clone [https://github.com/jefferson22gs/agendafacil365.git]
cd syshair

# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build
```

---

## 🌐 Deploy

### Vercel (Recomendado)

```bash
npm install -g vercel
vercel
```

### Netlify

```bash
npm run build
# Arraste a pasta 'dist' para o Netlify
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "run", "preview"]
```

---

## 📱 PWA

O sistema funciona como um aplicativo instalável:
- Acesse o site no celular
- Clique em "Adicionar à tela inicial"
- Use como um app nativo

---

## 📚 Documentação Completa

### Documentação Técnica
- 📖 [DOCUMENTACAO_COMPLETA.md](./DOCUMENTACAO_COMPLETA.md) - Documentação técnica detalhada do sistema
- 📘 [GUIDE_DESENVOLVEDORES.md](./GUIDE_DESENVOLVEDORES.md) - Guia para desenvolvedores usando a IA
- 🧠 [MEMORIA_SISTEMA.md](./MEMORIA_SISTEMA.md) - Resumo essencial do sistema para IA

### Guia de Uso
- 👥 [GUIA_USO.md](./GUIA_USO.md) - Guia passo a passo completo de todas funcionalidades
- 🎬 [DEMO_GUIDE.md](./DEMO_GUIDE.md) - Guia de demonstração com screenshots

### Implementação
- 👑 [IMPLEMENTATION_PLAN_SUPER_ADMIN.md](./IMPLEMENTATION_PLAN_SUPER_ADMIN.md) - Plano para Super Admin

### Skills para IA
- 🤖 Sistema possui skills especializados para Claude Code
  - `syshair-system` - Conhecimento principal do sistema
  - `supabase-syshair` - Conhecimento do banco de dados

**Como usar os skills:**
Basta mencionar que está trabalhando no SysHair e a IA automaticamente carregará o conhecimento do sistema.

Exemplos:
```
"Criar nova funcionalidade de agendamento no SysHair"
"Debugar erro no dashboard do SysHair em D:\Projetos\syshair-main"
"Adicionar validação de formulário seguindo padrões do SysHair"
```

---

## 📞 Suporte

**Desenvolvedor:** Código Base  
📞 WhatsApp: [+55 11 98626-2240](https://wa.me/5511986262240)  
📸 Instagram: [@codigo.base](https://instagram.com/codigo.base)  
📧 Email: jefferson22gs@gmail.com

### Horário de Suporte
- **SEG-SEX:** 09:00 - 18:00 (horário Brasília)
- **SÁB:** 09:00 - 14:00
- **DOM:** Fechado

**Suporte Desenvolvedores:**
- Horário de suporte dedicado para dúvidas técnicas
- Respostas em até 24h úteis
- Prioridade para bugs críticos em produção

---

## 🤝 Contribuindo

### Como Contribuir

1. **Fork** o repositório
2. **Branch** para sua feature (`git checkout -b feature/MinhaFeature`)
3. **Commit** suas mudanças (`git commit -m 'feat: adicionar feature X'`)
4. **Push** para o branch (`git push origin feature/MinhaFeature`)
5. **Pull Request** para revisão

### Convenções de Commit

- Use [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` Nova funcionalidade
  - `fix:` Bug fix
  - `docs:` Mudanças na documentação
  - `style:` Mudanças de formatação (sem lógica)
  - `refactor:` Refatoração de código
  - `test:` Adiciona ou modifica testes
  - `chore:` Outras mudanças

### Diretrizes de Código

- Usar TypeScript strict (nenhum `any`)
- Seguir padrões de componentes existentes
- Usar ShadCN UI components sempre que possível
- Usar React Query para data fetching
- Filtrar TODAS queries Supabase por `salon_id`
- Tratar erros em TODAS operations
- Não expor secrets/chaves no código

---

## 📄 Licença

Propriedade de Código Base. Todos os direitos reservados.

**2026 SysHair - Sistema de Gestão para Salões de Beleza**
*Transformando salões em máquinas de lucro*
