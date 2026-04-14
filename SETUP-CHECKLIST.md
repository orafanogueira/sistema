# Checklist de Setup - Grupo Nogueira OS

Siga em ordem. Cada item tem o link de onde pegar o token/chave.

## 1. Local (antes de deploy)

- [ ] Instalar Node.js 20+ (`winget install OpenJS.NodeJS.LTS`)
- [ ] `cd sistema && npm install`
- [ ] Copiar `.env.example` para `.env.local`

## 2. Supabase (obrigatorio - 10 min)

- [ ] Criar conta em https://supabase.com
- [ ] New project - regiao South America (sao-paulo)
- [ ] Copiar:
  - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public key` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role key` -> `SUPABASE_SERVICE_ROLE_KEY`
  - Connection string (Session pooler, `postgres://...`) -> `DATABASE_URL`
- [ ] SQL Editor - colar e rodar:
  1. `supabase/schema.sql`
  2. `supabase/policies.sql`
- [ ] Testar: `npm run dev` -> criar conta em http://localhost:3000/signup

## 3. Meta Ads (obrigatorio - token ja existe)

- [ ] Pegar token dos scripts: `ccos-ratos/scripts/config-clientes.json` -> `meta.access_token`
- [ ] Colocar em `.env.local`: `META_ACCESS_TOKEN=...`
- [ ] Testar: ir em Integracoes -> Conectar Meta Ads -> colar `act_1457708059280155` (Rafa) ou `act_411266327455499` (Sicredi)

## 4. Claude IA (obrigatorio pra atendimento - 2 min)

- [ ] https://console.anthropic.com > Settings > API Keys > Create Key
- [ ] Colar em `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...`

## 5. Google (para Ads + GA4 + Calendar + Gmail - 30 min)

- [ ] https://console.cloud.google.com > Criar projeto `grupo-nogueira-os`
- [ ] APIs & Services > Library - habilitar:
  - [ ] Google Ads API
  - [ ] Google Analytics Data API
  - [ ] Google Calendar API
  - [ ] Gmail API
  - [ ] Tag Manager API
- [ ] OAuth consent screen - External - adicionar escopos (o sistema ja pede os corretos)
- [ ] Credentials > Create OAuth 2.0 Client ID (Web application)
  - Authorized redirect URI: `https://gruponogueiramkt.com/api/integracoes/google-oauth/callback`
  - (dev) Adicionar tambem `http://localhost:3000/api/integracoes/google-oauth/callback`
- [ ] Copiar `Client ID` e `Client Secret` -> `.env.local`
- [ ] Google Ads - pedir Developer Token: https://ads.google.com > Tools > API Center (pode levar ate 24h pra aprovar conta basica, meses pra Standard)
- [ ] Colocar em `.env.local`: `GOOGLE_ADS_DEVELOPER_TOKEN=...`

## 6. Meta App (para Messenger + IG DM + WhatsApp Cloud - 1-2h)

- [ ] https://developers.facebook.com > My Apps > Create App
- [ ] Tipo: **Business**
- [ ] Nome: `Grupo Nogueira OS`
- [ ] Conectar ao Business Manager existente
- [ ] Settings > Basic - pegar:
  - `App ID` -> `META_APP_ID`
  - `App Secret` -> `META_APP_SECRET`
- [ ] Adicionar produtos:
  - [ ] **Messenger**
  - [ ] **Instagram**
  - [ ] **WhatsApp** (Cloud API)
- [ ] Configurar Webhook (igual pros 3):
  - URL: `https://gruponogueiramkt.com/api/webhook/meta`
  - Verify Token: gerar string aleatoria longa
  - Colocar essa string em `.env.local`: `META_WEBHOOK_VERIFY_TOKEN=...`
  - Subscribe fields: `messages`, `messaging_postbacks`, `message_deliveries`
- [ ] Instagram > conectar conta Business
- [ ] WhatsApp > adicionar numero de teste
- [ ] App Review > solicitar permissoes:
  - `pages_messaging`
  - `instagram_manage_messages`
  - `whatsapp_business_messaging`
  - `business_management`
  - `pages_show_list`
  - `pages_read_engagement`

## 7. Z-API (WhatsApp - ja funciona)

- [x] Tokens ja no `.env.example`, mesmos dos scripts Python

## 8. Deploy Vercel (1 click depois do setup)

- [ ] Criar repo git em `sistema/`
- [ ] Push pro GitHub
- [ ] https://vercel.com > Import Project > selecionar repo
- [ ] Framework: Next.js (auto-detect)
- [ ] Environment Variables: colar tudo do `.env.local` (Production)
- [ ] Deploy
- [ ] Domains > Add `gruponogueiramkt.com`
- [ ] Apontar DNS (CNAME `cname.vercel-dns.com`)
- [ ] SSL ativo em ~5 min
- [ ] Cron ja configurado em `vercel.json`

## 9. Testes smoke (depois do deploy)

- [ ] Signup com email real - cria tenant owner
- [ ] Criar cliente - aparece na lista
- [ ] Integrar Meta Ads - dashboard puxa metricas
- [ ] Criar board Kanban - drag-drop funciona
- [ ] Criar agente IA e testar chat em `/api/ai/chat`

## 10. White-label (opcional - revenda)

- [ ] No tenant master, criar tenant cliente via Configuracoes
- [ ] Cliente acessa via subdominio ou slug: `gruponogueiramkt.com/t/[slug]`
- [ ] Customizar logo + cor primaria em Configuracoes

---

## Duvidas frequentes

**Onde fico sabendo que esta funcionando?**
Dashboard principal mostra contadores de clientes, integracoes, follow-up, conversas. Se zerar, algo nao foi conectado.

**O token do Meta vai expirar?**
Sim (60 dias no padrao). Solucao: usar System User token (nunca expira) no Business Manager.

**Posso usar so parte?**
Sim. Tudo funciona separado. Meta Ads sem Google Ads, follow-up sem IA, etc.

**O que ja funciona sem nenhum OAuth?**
- Auth + clientes + kanban + dashboards (com token Meta via .env)
- IA interna (precisa da API key Claude)
- WhatsApp Z-API (tokens no .env)

**O que depende de OAuth?**
- Google Ads / GA4 / Calendar / Gmail
- Messenger / Instagram DM / WhatsApp Cloud API (Meta App)
