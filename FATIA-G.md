# Fatia G - Rastreamento Tintim-like

## O que entrou

### Banco (migration 004)
- `jornadas` + `jornada_etapas` + `jornada_keywords`
- `short_links` + `link_clicks`
- `page_views` (tracking via script embedado no site do cliente)
- `pixel_events` (fila de envios Meta CAPI + Google Offline)
- `lead_messages` (historico com matched_keywords e value_extracted)
- `pixel_config` (config pixel/token por cliente)
- Trigger automatico: quando lead muda de etapa, enfileira pixel event

### Libs (core logic)
- `rastreamento/device.ts` - parse User-Agent + IP client
- `rastreamento/value-extractor.ts` - regex BR "R$ X,YY"
- `rastreamento/keyword-engine.ts` - motor que avanca lead na jornada
- `rastreamento/meta-capi.ts` - envio server-to-server Meta Conversion API (c/ hash SHA256)
- `rastreamento/google-offline.ts` - CSV pra Google Ads Offline Conversions

### Endpoints publicos (sem auth)
- `GET /api/t/[slug]` - redirect de short-link com captura de fbclid/gclid/UTM + cookie session
- `POST /api/track/view` - recebe pageview do site do cliente
- `GET /api/track/script/[token]` - gera snippet JS pro cliente embedar no site
- `POST /api/track/wa-message` - recebe mensagem WhatsApp (Z-API webhook ou direto)

### Endpoints autenticados
- `GET/POST /api/jornadas` - listar/criar jornadas
- `GET/POST /api/short-links` - listar/criar links rastreaveis
- `GET /api/rastreamento/dashboard?cliente_id=&days=30` - dados consolidados
- `GET /api/google-offline/export?cliente_id=` - baixa CSV Google
- `GET /api/cron/pixel-events` - processa fila (roda a cada 5 min)

### UI
- `/rastreamento` - Dashboard Tintim-like (conversas, origem, funil, faturamento)
- `/jornadas` - Listagem e criacao de jornadas com 3 presets (automotivo/comercial/agencia)
- `/links-rastreaveis` - CRUD de short-links + copiar URL curta

### Cron (vercel.json)
- `/api/cron/pixel-events` - a cada 5 minutos dispara eventos Meta CAPI pendentes

---

## Fluxo tipico de uso (loja de carros)

### 1. Agencia configura o cliente
1. Cria jornada padrao "Automotivo" em `/jornadas`
2. Em `/configuracoes/pixel-config` cadastra:
   - Meta Pixel ID + Access Token (CAPI)
   - Google Ads customer_id (opcional)
3. Gera 1-2 short-links em `/links-rastreaveis`:
   - "site-home-whatsapp" -> `https://wa.me/55XX?text=Oi...`
   - "anuncio-meta-ads" -> idem mas com campaign_ref

### 2. Cliente instala o script no site dele
No `<head>` do site da loja, cola:
```html
<script src="https://gruponogueiramkt.com/api/track/script/SEU_WEBHOOK_TOKEN" async></script>
```
O script captura `fbclid`/`gclid`/UTMs ANTES do usuario clicar em WhatsApp.

### 3. Usuario clica em anuncio Meta -> site -> botao WhatsApp
- Script registra pageview com fbclid
- Script enriquece TODOS os links `wa.me` com UTMs e session_id
- Usuario clica -> WhatsApp abre com mensagem pronta + params preservados

### 4. Z-API (ou webhook Meta) recebe mensagem
Configura webhook pra POST em:
```
https://gruponogueiramkt.com/api/track/wa-message
```
Body:
```json
{
  "cliente_token": "...",
  "direction": "in",
  "phone": "5511999999999",
  "content": "Oi, tenho interesse no Onix 2020"
}
```

### 5. Motor de keywords avanca o lead
- "tenho interesse" -> etapa Primeiro Contato
- "quero agendar" -> etapa Visita
- "parabens pela compra" -> etapa Venda + extrai R$ X,XX
- Na etapa com `meta_event=Purchase`, dispara Meta CAPI automatico

### 6. Meta IA recebe os dados
- Evento Purchase chega no Pixel com external_id=lead.id, fbclid, email hashed, valor, etc
- Meta usa pra treinar otimizacao da campanha
- ROAS da conta melhora progressivamente

### 7. Google Ads offline conversions
- Eventos com `gclid` disponivel ficam na fila
- Mensalmente voce exporta CSV em `/api/google-offline/export`
- Upload em Google Ads > Tools > Conversions > Upload

---

## Setup rapido

### 1. Rodar migration 004 no Supabase
```sql
-- SQL Editor > cole e rode supabase/migrations/004_rastreamento_tintim.sql
```

### 2. Criar primeira jornada
- Acesse `/jornadas`
- "Criar jornada padrao"
- Seleciona cliente + template Automotivo
- Pronto. 7 etapas com 30+ keywords + 4 eventos Meta configurados.

### 3. Gerar short-link
- `/links-rastreaveis`
- "Novo link"
- Seleciona cliente, cola URL do WhatsApp, mensagem pronta
- Copia a URL curta (ex: `gruponogueiramkt.com/api/t/abc123`)

### 4. Configurar pixel (manual por enquanto - UI na Fatia G.2)
No Supabase > pixel_config > inserir:
```sql
insert into pixel_config (cliente_id, meta_pixel_id, meta_access_token)
values ('xxx', '1234567890', 'EAAxx...');
```

### 5. Testar
- Abre URL curta com `?fbclid=TESTE123`
- Em 2-3 min o clique aparece em `/rastreamento`
- Configure Z-API webhook pra mensagens WhatsApp
- Envia mensagem de teste: "parabens pela compra de r$ 50000"
- Lead vai pra etapa Venda, valor R$ 50.000 capturado, evento Purchase disparado

---

## O que AINDA falta (Fatia G.2 - proxima iteracao)
- UI pra editar etapas + keywords individualmente
- UI pra configurar pixel_config (hoje e via SQL)
- Integracao direta Meta Messenger/IG DM webhook
- Chamada da Google Ads API Standard (quando dev token aprovado)
- Geolocalizacao de IP (cidade/regiao do clicker)
- Deduplicacao browser + server (Meta Pixel JS + CAPI no mesmo evento_id)
