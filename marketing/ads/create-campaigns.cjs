// Cria (PAUSADAS) as campanhas do PLANO-CAMPANHA.md na conta de anúncios. Nada é cobrado até ativar no Gerenciador.
// Uso: META_ADS_TOKEN=... node marketing/ads/create-campaigns.cjs [--page <PAGE_ID>]
// Sem --page cria campanha + conjunto; com --page cria também criativos e anúncios (a Meta exige Página).
// Idempotente por nome: se já existir, reaproveita. Imprime só ids, nunca o token.
const ACT = 'act_4432277893700877', PIXEL = '1447922076809128';
const T = process.env.META_ADS_TOKEN;
const PAGE = process.argv.includes('--page') ? process.argv[process.argv.indexOf('--page') + 1] : null;
const SITE = 'https://agendafacil365.com.br/';
const WA = '5511986262240';
if (!T) throw new Error('META_ADS_TOKEN ausente');
const G = 'https://graph.facebook.com/v21.0';
// curl em vez de fetch: nesta rede o Node não alcança a Graph API; META_PROXY (ex.: socks5h://127.0.0.1:1080) é opcional.
const { execFileSync } = require('node:child_process');
async function api(path, body) {
  const args = ['-s', '-m', '60', '--ssl-no-revoke', ...(process.env.META_PROXY ? ['--proxy', process.env.META_PROXY] : []), '-H', `Authorization: Bearer ${T}`];
  if (body) args.push('-H', 'Content-Type: application/json', '--data-binary', '@-');
  const j = JSON.parse(execFileSync('curl', [...args, `${G}/${path}`], { input: body ? JSON.stringify(body) : undefined, encoding: 'utf8' }));
  if (j.error) throw new Error(`${path}: ${j.error.error_user_msg || j.error.message}`);
  return j;
}
async function find(edge, name) {
  const j = await api(`${ACT}/${edge}?fields=id,name&limit=200`);
  return j.data.find(x => x.name === name)?.id ?? null;
}
async function ensure(edge, body) {
  return (await find(edge, body.name)) ?? (await api(`${ACT}/${edge}`, body)).id;
}
// Dono de negócio de beleza: interesse no setor E comportamento de dono/administrador de página comercial.
const TARGETING = {
  geo_locations: { countries: ['BR'] }, age_min: 22, age_max: 60, locales: [],
  flexible_spec: [
    { interests: [{ id: '6003088846792' }, { id: '6017503018509' }, { id: '6003988602106' }, { id: '6003423248519' }, { id: '6811343488093' }] },
    { behaviors: [{ id: '6002714898572' }, { id: '6020568271383' }, { id: '6020530281783' }] },
  ],
  targeting_automation: { advantage_audience: 0 },
};
// Status do WhatsApp entra quando a conta tiver o posicionamento liberado (ver PLANO-CAMPANHA.md).
const PLACEMENTS = {
  publisher_platforms: ['facebook', 'instagram'],
  facebook_positions: ['feed', 'story', 'facebook_reels'],
  instagram_positions: ['stream', 'story', 'reels'],
};
const UTM = (c) => `utm_source=meta&utm_medium=paid&utm_campaign=${c}&utm_content={{ad.name}}`;
const IMG = { 'a-story': '8697f69ca54959701d89b315227951b7', 'b-story': '32ae99d277d347ca138a53221d49c83b', 'c-square': '343f6cd6cb7ee59ebb290d8492aa33a0', 'd-square': '5756558e37b12219ccb1fc006c487bc3' };
const TEXT = {
  A: 'Cansado de responder "tem horário?" o dia inteiro? O Agenda Fácil 365 agenda, confirma e lembra seus clientes pelo WhatsApp, sozinho. Teste 30 dias grátis, sem cartão.',
  B: 'Cliente que esquece é horário perdido. Com lembrete automático e aviso de retorno, sua agenda fica cheia e seus clientes voltam. A partir de R$ 33,33/mês.',
};

(async () => {
  const out = {};
  // 1) Cadastros no site: R$ 30/dia, otimiza para CompleteRegistration do Pixel.
  out.c1 = await ensure('campaigns', { name: 'AF365 | Cadastros | Teste 7d', objective: 'OUTCOME_LEADS', status: 'PAUSED', special_ad_categories: [], is_adset_budget_sharing_enabled: false });
  out.s1 = await ensure('adsets', {
    name: 'AF365 | Cadastros | Donos de beleza BR', campaign_id: out.c1, status: 'PAUSED', daily_budget: 3000, billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL, custom_event_type: 'COMPLETE_REGISTRATION' },
    end_time: new Date(Date.now() + 8 * 86_400_000).toISOString(), targeting: { ...TARGETING, ...PLACEMENTS },
  });
  // 2) Conversas no WhatsApp: R$ 20/dia, clique abre o WhatsApp de vendas.
  out.c2 = await ensure('campaigns', { name: 'AF365 | Conversas WhatsApp | Teste 7d', objective: 'OUTCOME_ENGAGEMENT', status: 'PAUSED', special_ad_categories: [], is_adset_budget_sharing_enabled: false });
  if (PAGE) {
    out.s2 = await ensure('adsets', {
      name: 'AF365 | WhatsApp | Donos de beleza BR', campaign_id: out.c2, status: 'PAUSED', daily_budget: 2000, billing_event: 'IMPRESSIONS',
      optimization_goal: 'CONVERSATIONS', destination_type: 'WHATSAPP', bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      promoted_object: { page_id: PAGE, whatsapp_phone_number: WA },
      end_time: new Date(Date.now() + 8 * 86_400_000).toISOString(), targeting: { ...TARGETING, ...PLACEMENTS },
    });
    // Criativos + anúncios (pausados): vertical para Status/Stories/Reels, quadrado para feed.
    const ads = [
      ['AF365 | A | Agende sem mão', 'a-story', TEXT.A, 'Teste grátis por 30 dias'],
      ['AF365 | B | Menos faltas', 'b-story', TEXT.B, 'Agenda online + WhatsApp'],
      ['AF365 | C | Agenda cheia', 'c-square', TEXT.B, 'Feito para salões e barbearias'],
      ['AF365 | D | Robô WhatsApp', 'd-square', TEXT.A, 'Teste grátis por 30 dias'],
    ];
    for (const [name, img, msg, title] of ads) {
      const site = await ensure('adcreatives', { name: `${name} | site`, object_story_spec: { page_id: PAGE, link_data: { image_hash: IMG[img], link: SITE, message: msg, name: title, call_to_action: { type: 'SIGN_UP', value: { link: SITE } } } }, url_tags: UTM('cadastro') });
      out[`ad1 ${img}`] = await ensure('ads', { name: `${name} | site`, adset_id: out.s1, creative: { creative_id: site }, status: 'PAUSED', tracking_specs: [{ 'action.type': ['offsite_conversion'], fb_pixel: [PIXEL] }] });
      const wa = await ensure('adcreatives', { name: `${name} | whatsapp`, object_story_spec: { page_id: PAGE, link_data: { image_hash: IMG[img], link: `https://wa.me/${WA}`, message: msg, name: title, call_to_action: { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } } } } });
      out[`ad2 ${img}`] = await ensure('ads', { name: `${name} | whatsapp`, adset_id: out.s2, creative: { creative_id: wa }, status: 'PAUSED' });
    }
  }
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
