import type { Article } from "./types";

/** Normaliza para busca: minúsculas, sem acento, sem pontuação. */
export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Grupos de sinônimos: digitar qualquer termo do grupo encontra os demais. */
const SYNONYMS: string[][] = [
  ["agenda", "agendamento", "horario", "marcar", "reserva", "calendario", "atendimento"],
  ["cliente", "contato", "freguesa", "fregues", "paciente"],
  ["profissional", "funcionario", "equipe", "cabeleireiro", "barbeiro", "manicure", "colaborador"],
  ["servico", "procedimento", "corte", "preco", "valor", "tabela"],
  ["whatsapp", "zap", "wpp", "zapzap", "whats", "mensagem", "qr", "qrcode"],
  ["disparo", "disparador", "mensagem em massa", "envio em massa", "campanha", "transmissao", "broadcast"],
  ["financeiro", "dinheiro", "faturamento", "caixa", "comissao", "lucro", "receita"],
  ["relatorio", "analytics", "grafico", "estatistica", "numeros", "desempenho"],
  ["link", "pagina", "site", "online", "compartilhar", "divulgar", "slug"],
  ["cupom", "desconto", "promocao", "codigo"],
  ["pacote", "combo", "plano de servicos"],
  ["assinatura", "plano", "pagamento", "mensalidade", "mercado pago", "renovar", "cancelar"],
  ["chatbot", "robo", "ia", "inteligencia artificial", "assistente", "atendente automatico"],
  ["status", "stories", "story", "postagem"],
  ["importar", "vcf", "agenda do celular", "contatos do celular"],
  ["exportar", "baixar", "planilha", "csv", "excel"],
  ["configuracao", "configurar", "ajustes", "dados do salao", "dados do estabelecimento", "estabelecimento", "endereco", "horario de funcionamento"],
  ["galeria", "foto", "antes e depois", "imagem", "portfolio"],
  ["avaliacao", "estrela", "nota", "comentario", "opiniao"],
  ["produto", "estoque", "venda", "loja"],
  ["unidade", "filial", "multi unidade", "rede"],
  ["app", "aplicativo", "instalar", "pwa", "celular"],
];

function expand(term: string): string[] {
  const out = new Set([term]);
  for (const group of SYNONYMS) {
    if (group.some((w) => w.startsWith(term) || term.startsWith(w))) group.forEach((w) => out.add(w));
  }
  return Array.from(out);
}

/** Busca client-side, tolerante a acento e sinônimo. Retorna artigos ordenados por relevância. */
export function searchArticles(articles: Article[], query: string): Article[] {
  const q = normalize(query);
  if (!q) return [];
  const terms = q.split(" ").filter((t) => t.length >= 2);
  if (terms.length === 0) return [];

  const scored = articles.map((a) => {
    const title = normalize(a.title);
    const summary = normalize(a.summary);
    const keywords = normalize((a.keywords ?? []).join(" "));
    const body = normalize(a.steps.map((s) => s.text).join(" "));
    let score = 0;
    for (const term of terms) {
      const variants = expand(term);
      let best = 0;
      for (const v of variants) {
        const exact = v === term ? 1 : 0.7;
        if (title.includes(v)) best = Math.max(best, 6 * exact);
        else if (keywords.includes(v)) best = Math.max(best, 4 * exact);
        else if (summary.includes(v)) best = Math.max(best, 3 * exact);
        else if (body.includes(v)) best = Math.max(best, 1 * exact);
      }
      score += best;
    }
    return { a, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .map((s) => s.a);
}
