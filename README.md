# Grupo Nogueira OS

Sistema operacional da agencia. Multi-tenant, white-label, Next.js 15 + Supabase.

## Modulos

- **Dashboard tempo real** - Meta Ads + Google Ads + GA4 por cliente
- **Clientes** - CRUD, vencimentos, ticket, status
- **Kanban** - Boards por cliente ou por time
- **Times** - Trafego, Comercial, Social Media, Video Maker
- **Follow-up** - Templates + fluxos automaticos em Email (Gmail) e WhatsApp (Z-API)
- **Atendimento IA** - Agentes Claude em Messenger, Instagram DM, WhatsApp
- **White-label** - Crie tenants para clientes revenda com logo e dominio proprio
- **Integracoes** - Meta Ads, Google Ads, GA4, GTM, Calendar, Gmail, Z-API

## Setup

### 1. Pre-requisitos

```bash
# Instalar Node.js 20+ (Windows)
winget install OpenJS.NodeJS.LTS

# Verificar
node -v  # >= 20
npm -v
```

### 2. Instalar dependencias

```bash
cd sistema
npm install
```

### 3. Criar projeto Supabase

1. Acesse https://supabase.com e crie um projeto (tier free serve pro MVP)
2. Project Settings > API - copie: `URL`, `anon key`, `service_role key`
3. Project Settings > Database - copie a connection string (Session pooler)
4. SQL Editor - rode em ordem:
   - `supabase/schema.sql` (estrutura)
   - `supabase/policies.sql` (RLS)
   - (opcional) `supabase/seed.sql` apos criar conta

### 4. Preencher .env.local

```bash
cp .env.example .env.local
# edite .env.local e preencha pelo menos:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - DATABASE_URL
# - META_ACCESS_TOKEN (ja tem nos scripts Python)
# - ANTHROPIC_API_KEY (https://console.anthropic.com)
```

### 5. Rodar localmente

```bash
npm run dev
# http://localhost:3000
```

---

## Integracoes - o que configurar

### Meta Ads (imediato - token ja existe)
- Use o `META_ACCESS_TOKEN` que ja esta nos scripts Python
- Na tela **Integracoes** do sistema, clica "Conectar Meta Ads" e cola o `act_xxx`
- Pronto - dashboards puxam em tempo real

### Messenger + Instagram + WhatsApp Cloud (precisa criar Meta App)
1. https://developers.facebook.com > Criar App (tipo Business)
2. Adicionar produtos: Messenger, Instagram, WhatsApp
3. Settings > Basic - pegar `App ID` e `App Secret` -> .env
4. Messenger > Webhook:
   - Callback URL: `https://gruponogueiramkt.com/api/webhook/meta`
   - Verify Token: gerar string e colocar em `META_WEBHOOK_VERIFY_TOKEN`
   - Subscrever: `messages`, `messaging_postbacks`
5. WhatsApp > Configuration: mesmo webhook
6. Instagram > Configurar Instagram Business
7. App Review - solicitar permissoes `pages_messaging`, `instagram_manage_messages`, `whatsapp_business_messaging`

### Google (Ads + GA4 + Calendar + Gmail + GTM)
1. https://console.cloud.google.com > Novo projeto
2. APIs & Services > Habilitar:
   - Google Ads API
   - Google Analytics Data API
   - Google Calendar API
   - Gmail API
   - Tag Manager API
3. OAuth consent screen (External, adicionar escopos)
4. Credentials > OAuth 2.0 Client ID
   - Authorized redirect URI: `https://gruponogueiramkt.com/api/integracoes/google-oauth/callback`
   - Copiar Client ID / Client Secret -> .env
5. Google Ads - pedir Developer Token em ads.google.com > API Center

### WhatsApp (Z-API)
- Tokens ja estao no `.env.example` (mesmos dos scripts Python)
- Sem setup adicional

### Claude (IA)
- https://console.anthropic.com > Settings > API Keys
- Criar chave e colocar em `ANTHROPIC_API_KEY`

---

## Deploy

### Vercel (recomendado)

```bash
# Instalar CLI (opcional)
npm i -g vercel

# Deploy
vercel
# seguir wizard - conectar com GitHub
# apontar dominio gruponogueiramkt.com no Vercel Dashboard
```

No painel Vercel:
- Environment Variables - colar tudo do `.env.local` (Production)
- Settings > Domains - adicionar `gruponogueiramkt.com`
- Settings > Cron - ja configurado em `vercel.json`

### Supabase

- O projeto ja roda no plano free (500MB DB, 2GB bandwidth)
- Database > Extensions - habilitar `pg_cron` se quiser tarefas no banco

---

## Estrutura de pastas

```
sistema/
├── src/
│   ├── app/
│   │   ├── (auth)/         login + signup
│   │   ├── (dashboard)/    todas paginas protegidas
│   │   └── api/            routes (clientes, meta-ads, webhook, cron, etc)
│   ├── components/
│   │   ├── ui/             primitives (button, card, input, etc)
│   │   ├── layout/         sidebar + topbar
│   │   ├── clientes/       dialog novo cliente, dashboard por cliente
│   │   ├── kanban/         board drag-and-drop
│   │   ├── times/          shared team page
│   │   └── integracoes/    dialogs de conexao
│   ├── lib/
│   │   ├── supabase/       client/server clients
│   │   ├── integrations/   meta-ads, google-ads, ga4, zapi, ai, etc
│   │   └── utils.ts
│   └── middleware.ts       auth guard
├── supabase/
│   ├── schema.sql          estrutura (multi-tenant)
│   ├── policies.sql        RLS
│   └── seed.sql            dados iniciais
├── package.json
├── tailwind.config.ts
├── next.config.ts
├── vercel.json             crons
└── .env.example
```

---

## Proximos passos pos-MVP

- [ ] Editor de fluxos de follow-up (visual, drag-drop)
- [ ] Biblioteca de templates de copy com filtros
- [ ] Upload de criativos -> aprovacao do cliente (portal white-label)
- [ ] Relatorios agendados automaticos (PDF + WhatsApp + email)
- [ ] Analise de criativos com Claude (auto-tag, performance prediction)
- [ ] Agendamento via Google Calendar no portal do cliente
- [ ] Billing (Stripe) para cobrar pelo sistema white-label
- [ ] App mobile (Expo) com push notifications

---

## Versao

v0.1.0 - MVP inicial (2026-04-13)
