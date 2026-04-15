# Fatias L + B + M — Entregues offline

Trabalho feito enquanto voce estava off. Sao 3 fatias completas + ajustes.

## Resumo rapido

- ✅ **Fatia L** — Copiloto IA com tool use + UTM Builder + Dashboard publico
- ✅ **Fatia B** — Aprovacao de posts pelo cliente (link publico sem login)
- ✅ **Fatia M** — SEO projects + gerador de conteudo IA (blog + GMB)

Total: **18 arquivos novos**, 1 migration, 5 APIs, 4 UI pages, 3 libs.

---

## O que voce precisa fazer (na ordem)

### 1. Sincronizar arquivos

```powershell
robocopy "C:\Users\rafae\OneDrive\Documentos\claude code\ccos-ratos\sistema" "C:\projetos\sistema" /E /XD node_modules .next .vercel .git /XF .env.local
```

### 2. Rodar migration 007 no Supabase

- Supabase CLAUDECODE → SQL Editor → New query
- Abre no VS Code: `C:\projetos\sistema\supabase\migrations\007_copilot_utm_publico.sql`
- Ctrl+A → Ctrl+C → Ctrl+V → Run
- Aguarda "Success"

### 3. Commit + push

```powershell
cd C:\projetos\sistema ; git add . ; git commit -m "Fatias L+B+M: Copiloto IA + UTM + Dashboard publico + Aprovacao posts + SEO" ; git push
```

### 4. Aguardar deploy (~3 min)

Vercel → Deployments → aguarda Ready

---

## O que tem pra testar

### Copiloto IA (`/copiloto`)
Assistente que executa acoes reais. Pergunta por exemplo:
- "Quantos leads tivemos nos ultimos 7 dias?"
- "Analise as campanhas do Athos Motors"
- "Qual e o MRR atual?"
- "Lista meus clientes automotivos"
- "Tem algum alerta critico agora?"
- "Gera link publico do dashboard pra Dignissima"
- "Sugira otimizacoes nas campanhas de Sicredi"

A IA vai invocar tools reais (consulta BD, Meta Ads API, etc) e responder com dados atualizados.

**Tools disponiveis:**
- `listar_clientes` - lista com filtros
- `buscar_cliente` - busca por nome
- `analisar_campanhas_meta` - KPIs Meta Ads
- `contar_leads` - leads por periodo
- `criar_cobranca` - cria no Asaas via API
- `resumo_financeiro` - MRR/ARR/inadimplencia
- `listar_alertas`
- `sugerir_otimizacao_campanhas`
- `gerar_link_dashboard_publico`

### UTM Builder (`/utm-builder`)
- URL builder visual com presets de source/medium
- Copy one-click
- URL final preserva dominios + adiciona UTMs padrao

### Dashboard Publico (gerado via Copiloto ou manual)
URL: `https://app.gruponogueiramkt.com/dashboard-publico/{token}`
- Cliente ve sem login
- Mostra metricas Meta/Google, leads, posts sociais
- Configuravel por visao

Pra gerar manualmente: SQL Editor:
```sql
insert into dashboard_public_links (tenant_id, cliente_id, name)
values (
  (select tenant_id from memberships where user_id = auth.uid() limit 1),
  'ID_DO_CLIENTE',
  'Dashboard compartilhado'
) returning token;
```

### Aprovacao de posts (Fatia B)
Cada post social tem um `aprovacao_token` gerado automaticamente.

URL publica: `https://app.gruponogueiramkt.com/aprovacao-post/{token}`

Pra pegar token de um post:
```sql
select aprovacao_token from social_posts where id = 'POST_ID';
```

Cliente acessa, ve o conteudo (titulo, copy, hashtags, slides do carrossel), pode:
- ✅ Aprovar
- ❌ Rejeitar (com comentario obrigatorio)
- 💬 So comentar (sem mudar status)

Todas as acoes ficam registradas em `social_post_revisoes`.

### SEO (`/seo`)
- Projetos SEO por cliente com: site URL, GMB Place ID, GSC property, GA4 property
- Cadastro de keywords alvo
- Gerador de blog post + GMB post via IA (`/api/seo/gerar-conteudo`)
- Classificacao automatica de intent + funil

**API pra gerar conteudo:**
```bash
POST /api/seo/gerar-conteudo
{
  "seo_project_id": "...",
  "type": "blog_post",           # ou "gmb_post"
  "topic": "Como escolher um carro usado seguro",
  "keywords": "carro usado, como escolher",
  "length": "medium"             # short, medium, long
}
```

IA retorna em markdown otimizado (H1/H2/H3, keywords naturais, meta title e description).

---

## Sidebar atualizada

Novos links:
- **IA** → Copiloto IA
- **Performance** → UTM Builder + SEO / Organico

Ja tem em **Conteudo**: Automacoes IG (da Fatia H)

---

## Arquivos criados

### Migration
- `supabase/migrations/007_copilot_utm_publico.sql` (inclui Fatia L, B e M)

### Libs
- `src/lib/copilot/tools.ts` - tools do copiloto (9 tools)
- `src/lib/copilot/runner.ts` - executor com tool-use loop
- `src/lib/seo/keyword-research.ts` - stubs pra Google KWP + Trends + classificadores

### APIs
- `src/app/api/copilot/chat/route.ts` - chat do copiloto
- `src/app/api/dashboard-publico/[token]/route.ts` - dashboard publico
- `src/app/api/social-posts/route.ts` + `[id]/route.ts` - CRUD social
- `src/app/api/aprovacao-post/[token]/route.ts` - aprovacao publica
- `src/app/api/seo/projects/route.ts` - projetos SEO
- `src/app/api/seo/gerar-conteudo/route.ts` - gera blog/GMB via IA

### UI
- `src/app/(dashboard)/copiloto/page.tsx` + component
- `src/app/(dashboard)/utm-builder/page.tsx` + component
- `src/app/(dashboard)/seo/page.tsx` + component
- `src/app/dashboard-publico/[token]/page.tsx` - pagina publica
- `src/app/aprovacao-post/[token]/page.tsx` + client - pagina publica

---

## Status do roadmap

| Fatia | Status |
|---|---|
| A — Agentes IA + Dashboard CEO | ✅ |
| G — Rastreamento Tintim | ✅ |
| N — Contratos + Billing | ✅ |
| H — ManyChat IG | ✅ |
| **L — Copiloto IA + UTM + Dashboard publico** | ✅ |
| **B — Aprovacao de posts** | ✅ |
| **M — SEO projects + content IA** | ✅ |
| O — Maquina Maxxima | ⏳ |
| J — IA criativa (imagem/video) | ⏳ |
| K — Customer Success | ⏳ |

**7 de 10 fatias principais entregues.**

---

## Proximos passos sugeridos

1. Testar Fatias L/B/M depois do deploy
2. Atacar Fatia O (Maquina Maxxima) - a mais complexa
3. Polimento: relatorios agendados, exports PDF, mais templates
