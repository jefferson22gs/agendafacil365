# Pagamentos — InfinitePay + Mercado Pago

O cliente do Agenda Fácil 365 (dono do estabelecimento) pode pagar a assinatura de duas formas. As duas ficam disponíveis no Checkout e em **Minha Assinatura**:

| Forma | Como funciona | Liberação |
|---|---|---|
| **InfinitePay** (principal) | Link de pagamento Pix ou cartão (até 12x) gerado no servidor para o plano escolhido. É uma cobrança avulsa por período (mês ou ano). | Webhook `infinitepay-webhook`, que revalida o pagamento em `payment_check` antes de liberar. |
| **Mercado Pago** (mantido) | Assinatura recorrente (preapproval), sem mudança no fluxo. | Webhook `mercadopago-webhook`, como antes. |

**Recebedor InfinitePay:** InfiniteTag `$marco-boggian` (CNPJ 56.760.458/0001-91). A API usa o handle sem `$`: `marco-boggian`.

## Preços (fonte única no servidor)
- Mensal: R$ 39,90 (3990 centavos), libera 1 mês.
- Anual: R$ 400,00 (40000 centavos), libera 12 meses.

O valor nunca vem do navegador. Ele está definido em `supabase/functions/_shared/infinitepay/core.ts`, junto com os preços do Checkout. Se alguém pagar antes do vencimento, o novo período é somado ao fim do atual.

## Segurança
- **Sem chave de API:** a InfinitePay identifica o recebedor só pela InfiniteTag. Por isso o corpo do webhook não é aceito como prova de pagamento.
- **Validações antes de liberar o acesso:**
  1. O `order_nsu` foi criado pelo nosso servidor e existe na tabela `infinitepay_orders`.
  2. `payment_check` na InfinitePay confirma `paid = true`.
  3. O valor pago é maior ou igual ao valor do pedido.
  4. O pedido ainda está `pending` (idempotência: um pedido nunca libera duas vezes).
- **Retorno após o pagamento:** o `redirect_url` aceita só a origem do próprio app (`APP_PUBLIC_URL`), o que evita open-redirect.
- **Permissões da tabela:** o dono só **lê** os próprios pedidos; somente as Functions (service role) gravam.

## Endpoints usados (verificados em 05/11/2026)
- `POST https://api.infinitepay.io/invoices/public/checkout/links` retorna `{ url }`.
- `POST https://api.infinitepay.io/invoices/public/checkout/payment_check` retorna `{ success, paid, amount, paid_amount, capture_method }`.

## Para ativar (fase de implantação, exige autorização)
1. **Banco:** aplicar `supabase/pending/20261105000200_infinitepay_orders.sql`. Ele só cria a tabela nova e colunas opcionais; o rollback está no arquivo.
2. **Secrets das Functions**, em Supabase → Edge Functions → Secrets:
   - `INFINITEPAY_HANDLE=marco-boggian`
   - `APP_PUBLIC_URL=https://agendafacil365.vercel.app,https://agendafacil365.com.br`. A primeira URL é a origem padrão do retorno.
3. **Deploy das Functions:**
   - `supabase functions deploy infinitepay-checkout --project-ref ocbwsaydgkiseeardjga`
   - `supabase functions deploy infinitepay-webhook --project-ref ocbwsaydgkiseeardjga --no-verify-jwt`. A InfinitePay chama sem JWT; a segurança está na revalidação.
4. **Teste real com valor mínimo:** fazer um pagamento de teste e conferir a tabela `infinitepay_orders` (`status = paid`) e a assinatura `active`. Se preferir, estorne pelo app da InfinitePay.

Enquanto os passos 1 a 3 não forem feitos, o botão InfinitePay mostra "Pagamento por InfinitePay ainda não foi ativado pela equipe" e nada é cobrado. O Mercado Pago segue funcionando.

## Limitações
- A InfinitePay não faz cobrança recorrente automática nesse modelo: a cada período o cliente paga um novo link. Lembrete de renovação: usar os avisos de vencimento que já existem (`SubscriptionWarningBanner`).
- O cancelamento é simplesmente não renovar. O acesso continua até o fim do período pago.
