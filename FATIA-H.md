# Fatia H - Automacoes Instagram (ManyChat-like)

## O que entrou

### Banco (migration 006)
- `instagram_accounts` - contas IG Business conectadas
- `ig_posts_monitorados` - posts que a automacao escuta
- `ig_automacoes` - palavras-chave + resposta DM + configuracao
- `ig_automacao_runs` - historico de cada disparo
- `ig_comments_raw` - raw log de comentarios recebidos
- Extensao de `leads` com `ig_automacao_id`, `ig_post_id`, `ig_username`

### Libs
- `instagram/graph-api.ts` - wrapper Meta Graph API (DM privada, reply publico, listar posts, webhooks)
- `instagram/comment-processor.ts` - motor de keywords + disparador de DM

### Endpoints
- `GET/POST /api/automacoes-ig` - CRUD de automacoes
- `GET/PATCH/DELETE /api/automacoes-ig/[id]`
- `GET/POST /api/instagram-connect` - conectar conta IG Business
- `POST /api/webhook/meta` - **expandido** pra processar field `comments`

### UI
- `/automacoes-ig` - lista + criar nova + conectar conta IG
- `/automacoes-ig/[id]` - detalhe + historico de execucoes

### Sidebar
Adicionado "Automacoes IG" na secao Conteudo.

---

## Como funciona (fluxo real)

1. Cliente tem conta IG Business + Page Facebook
2. Admin conecta no sistema (UI de Conectar IG)
3. Admin cria automacao:
   - Palavras-chave: `quero`, `info`, `link`
   - Resposta DM: `Oi {{nome}}! Aqui esta o que voce pediu: [link]`
   - Opcao: responder publicamente: `Mandei no seu direct!`
4. Alguem comenta `quero info` num post
5. Webhook Meta recebe evento `comments`
6. Sistema verifica automacoes ativas, faz match de keyword
7. Envia DM privada via Graph API
8. (opcional) Responde publicamente tambem
9. Cria lead no CRM com origem `meta_ads_instagram` + post_id
10. Se `ai_takes_over=true`, proximo messaging da conversa passa pela IA

---

## Setup pra ativar

### 1. Migration 006
SQL Editor > cole `supabase/migrations/006_instagram_automacoes.sql` > Run

### 2. Conta Instagram Business + Page Facebook
- Converte a conta IG do cliente pra Business
- Conecta ela a uma Page Facebook (nas configuracoes do IG)

### 3. Meta App
Precisa de Meta App com as permissoes:
- `instagram_basic`
- `instagram_manage_messages`
- `pages_manage_metadata`
- `pages_read_engagement`
- `pages_messaging`

**App Review:** essas permissoes precisam ser aprovadas pelo Meta. Leva 1-4 semanas. Em modo desenvolvimento funciona apenas com contas de teste.

### 4. Webhook Meta
No App Meta > Webhooks, inscreve o campo `comments` da Page.
URL: `https://app.gruponogueiramkt.com/api/webhook/meta`
Verify token: usar valor de `META_WEBHOOK_VERIFY_TOKEN`

### 5. Conectar no sistema
`/automacoes-ig` > botao **Conectar Instagram** > preenche:
- IG Business Account ID
- Page ID
- Page Access Token (long-lived)

Esses dados voce pega em [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer):
- Busca `/me/accounts` → Page ID + token
- Com token da page: `/<page_id>?fields=instagram_business_account` → IG Business ID

### 6. Criar automacao
Botao **Nova automacao** > preenche palavras-chave + resposta > Save

### 7. Teste
No IG, comenta num post um texto com a palavra-chave.
Em ~5s, voce deve receber DM privada automaticamente.

---

## Limitacoes conhecidas

- **App review:** sem app aprovado pela Meta, funciona apenas com contas de teste (desenvolvedores adicionados ao app)
- **7 dias pra Private Reply:** a Meta so permite responder privadamente comentarios feitos nos ultimos 7 dias
- **Rate limits:** Meta Graph API tem limites de 200 calls/hora por user (nao e problema na pratica)
- **"Only followers":** nao implementado ainda (API Meta nao expoe isso facilmente)
- **Match "all":** exige que todas as keywords estejam no texto

---

## Proximos passos (Fatia H.2 futuro)

- OAuth automatico de conta IG (hoje e manual)
- Listar posts do IG na UI (sem precisar digitar post_id)
- Suporte a DM recebida (trigger `dm_received`)
- Suporte a respostas de story
- Filtro real de "so seguidores"
- IA toma conta da conversa apos 1 mensagem
