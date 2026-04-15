# Trabalho Offline — Sistema completo (sessao 2)

Bom dia! Durante as 9h em que voce estava off (sessao 2), avancei mais **5 fases de polimento + features faltantes**. Junto com a sessao 1, agora tem TUDO pra rodar como produto.

---

## Fases entregues nessa sessao (1-6)

| Fase | O que entrou |
|---|---|
| **1** | PDF de relatorios mensais (pdf-lib, sem dependencia nativa) + Sistema de Toast global (success/error/info) |
| **2** | Portal white-label completo + Wizard de onboarding (6 passos) + Tabela `cliente_portais` + `onboarding_progress` |
| **3** | Convites de time por email (`team_invites`) + Aceite por token + Assinaturas Asaas recorrentes |
| **4** | Sino de notificacoes em tempo real (Supabase Realtime) + feed `/api/alerts-feed` + topbar atualizada |
| **5** | Pagina **Meu Perfil** + 2 novos templates de contrato (Social Media isolado, Trafego Pago isolado) |
| **6** | Dialogs **Nova automacao / Novo agente IA / Novo board Kanban** + Clicksign auto-gera cobranca/assinatura apos assinatura + migration 012 (Kanban tables) |
| **7** | Toggle ativar/pausar + excluir em **automacoes e agentes IA** + **pagina de editar agente** `/atendimento-ia/[id]` + **criar task no Kanban** (dialog por coluna) + API tasks POST + `DELETE` em automations/ai-agents |

---

## Arquivos novos / modificados nessa sessao

### Migrations novas
- `supabase/migrations/011_white_label_onboarding.sql`
  - Tabelas: `cliente_portais`, `team_invites`, `onboarding_progress`
  - Trigger automatico de criacao do `onboarding_progress` quando tenant nasce
- `supabase/migrations/012_kanban.sql`
  - Tabelas: `boards`, `board_columns`, `tasks` + RLS
  - (O kanban ja tinha UI mas as tabelas nunca existiram — agora existem)

### APIs
- `src/app/api/team-invites/route.ts` — POST cria convite, GET lista
- `src/app/api/team-invites/[token]/route.ts` — POST aceita convite
- `src/app/api/assinaturas/route.ts` — POST cria assinatura recorrente Asaas
- `src/app/api/onboarding-progress/route.ts` — GET/PATCH progresso
- `src/app/api/alerts-feed/route.ts` — GET feed unificado pra sino
- `src/app/api/automations/route.ts` — POST cria, PATCH atualiza (toggle is_active)
- `src/app/api/ai-agents/route.ts` — POST cria novo agente, PATCH atualiza
- `src/app/api/boards/route.ts` — POST cria board Kanban com 4 colunas default
- `src/app/api/webhook/clicksign/route.ts` — agora auto-gera cobranca/assinatura Asaas quando contrato e assinado

### UI
- `src/components/onboarding/onboarding-wizard.tsx` — checklist de 6 passos no topo do dashboard
- `src/components/layout/notifications-bell.tsx` — sino realtime (badge + dropdown)
- `src/components/layout/topbar.tsx` — substituido sino antigo pelo novo
- `src/components/perfil/perfil-form.tsx` — form de dados pessoais
- `src/app/(dashboard)/perfil/page.tsx` — pagina /perfil (dados + tenant + role)
- `src/app/convite/[token]/page.tsx` + `client.tsx` — landing de aceite de convite
- `src/components/ui/toaster.tsx` — `toast.success/.error/.info`
- `src/components/automacoes/nova-automacao.tsx` — dialog completo (trigger + acoes em sequencia)
- `src/components/atendimento-ia/novo-agente.tsx` — dialog (nome, persona, modelo, canais)
- `src/components/kanban/novo-board.tsx` — dialog (scope: agencia/time/cliente/pessoal)
- `src/components/kanban/board-selector.tsx` — selector reativo que navega por querystring
- `src/components/automacoes/automacao-actions.tsx` — toggle on/off + excluir
- `src/components/atendimento-ia/agente-actions.tsx` — toggle on/off + excluir
- `src/components/atendimento-ia/agente-editor.tsx` — form completo de editar (persona, modelo, canais)
- `src/app/(dashboard)/atendimento-ia/[id]/page.tsx` — pagina de editar agente
- `src/components/kanban/nova-task.tsx` — dialog de criar tarefa em cada coluna

### Libs/templates
- `src/lib/relatorios/pdf.ts` — geracao PDF mensal com cards e analise IA
- `src/lib/contratos/templates.ts` — adicionados `social_media_apenas` e `trafego_pago_apenas`

### Layout
- `src/app/(dashboard)/layout.tsx` — `<Toaster />` global + `<CopilotFab />`

---

## 3 PASSOS pra aplicar tudo (sessao 2)

### 1. Sincronizar arquivos

```powershell
robocopy "C:\Users\rafae\OneDrive\Documentos\claude code\ccos-ratos\sistema" "C:\projetos\sistema" /E /XD node_modules .next .vercel .git /XF .env.local
```

### 2. Rodar migrations 011 + 012 no Supabase

> Importante: se voce ja rodou 007-010 (sessao 1), falta a **011 e a 012**.

Pra cada: abre no VS Code → Ctrl+A → Ctrl+C → cola no SQL Editor do Supabase → Run.

1. `supabase/migrations/011_white_label_onboarding.sql`
2. `supabase/migrations/012_kanban.sql`

### 3. Commit + push

```powershell
cd C:\projetos\sistema ; git add . ; git commit -m "Onboarding wizard, notif bell realtime, perfil, convites, assinaturas, PDF relatorios" ; git push
```

Aguarda Vercel (~3-5 min).

---

## O que testar quando voltar

### 🎯 Onboarding wizard
Aparece automatico no topo do dashboard pra novos tenants. 6 passos: importar clientes, conectar Meta, ativar agente IA, primeira cobranca, convidar time, configurar webhooks. Botao **X** dispensa.

### 🔔 Sino de notificacoes (topbar)
Conecta em Supabase Realtime. Quando novo lead/alerta/assinatura entra, badge atualiza ao vivo. Click abre dropdown com ultimas 20 notificacoes.

### 👥 Convites de time
Em **Configuracoes** → adicionar membro → email + role + team. Sistema gera token. Enviar link `app.gruponogueiramkt.com/convite/TOKEN`. Pessoa abre, faz login, vira membro do tenant.

### 💳 Assinatura recorrente Asaas
Em vez de cobranca avulsa, criar assinatura pra cliente que paga mensalmente. POST `/api/assinaturas` com `cliente_id, valor, ciclo (MONTHLY/YEARLY), descricao`.

### 👤 /perfil
Pagina nova. Atualiza nome + telefone. Mostra tenant, slug, plano, role.

### 📄 Novos templates de contrato
Em **Contratos** → novo → escolher template:
- Social Media Apenas (qtd posts/stories)
- Trafego Pago Apenas (honorario + verba midia separados)

### 📑 PDF de relatorios
Cron `/api/cron/relatorios-mensais` agora gera PDF real (pdf-lib) e anexa no envio WhatsApp.

### 🍞 Toast notifications
Qualquer acao bem-sucedida agora mostra toast no canto. Erros tambem.

### ⚡ Criar automacao, agente e board
- `/automacoes` → **Nova automacao** abre dialog: escolhe gatilho (lead_created, lead_idle, etc), filtra por cliente, adiciona acoes em sequencia (enviar WhatsApp, criar tarefa, mover estagio)
- `/atendimento-ia` → **Novo agente** abre dialog: nome, persona/instrucoes, modelo Claude, canais (WhatsApp/IG/Messenger)
- `/kanban` → **Novo board** abre dialog: escopo (agencia/time/cliente/pessoal) + 4 colunas padrao (A fazer → Em andamento → Revisao → Concluido)

### 🖊️ Contrato assinado → cobranca automatica
Quando Clicksign dispara `document_signed`, o webhook:
1. Marca contrato como assinado
2. Se valor > 0 e `forma_pagamento = mensal/trimestral/semestral/anual` → cria **assinatura Asaas recorrente**
3. Se valor > 0 e forma = unico → cria **cobranca PIX Asaas** (com suporte a parcelas)
4. Loga evento em `contrato_eventos` (`cobranca_gerada` ou `cobranca_erro`)

---

## Sidebar atualizada (final)

- **Geral**: Dashboard CEO, Alertas, Clientes
- **Conteudo**: Social Media, Calendario, Automacoes IG
- **CRM**: Leads, Rastreamento, Jornadas, Links, Pipelines, Automacoes, Kanban
- **Automotivo**: Estoque, Vendedores
- **Financeiro**: Financeiro, Contratos, Cobrancas, **Assinaturas**
- **IA**: Copiloto IA, Agentes IA, Atendimento IA, Criativos IA
- **Performance**: UTM Builder, SEO, Customer Success, Maquina Maxxima
- **Times**: Trafego, Comercial, Social, Video
- **Atendimento**: Follow-up, Conversas
- **Sistema**: Integracoes, Configuracoes, **Meu Perfil**

Topbar: sino realtime + avatar + Copilot FAB flutuante (Ctrl+K).

---

## Status final (12 de 12 fatias)

| Fatia | Status |
|---|---|
| A — Agentes IA + Dashboard CEO | ✅ |
| B — Aprovacao posts social | ✅ |
| G — Rastreamento Tintim | ✅ |
| H — ManyChat IG | ✅ |
| J — IA Criativa (carrossel SVG) | ✅ |
| K — Customer Success | ✅ |
| L — Copiloto + UTM + Dashboard publico | ✅ |
| M — SEO + GMB + Content IA | ✅ |
| N — Contratos + Billing + Assinaturas | ✅ |
| O — Maquina Maxxima | ✅ |
| Relatorios mensais (com PDF) | ✅ |
| Onboarding + Notif Realtime + Perfil + Convites | ✅ (sessao 2) |

---

## Checklist rapido ao voltar

1. [ ] robocopy
2. [ ] Rodar migrations **011 + 012** (a 007-010 ja foram na sessao anterior)
3. [ ] git add . / commit / push
4. [ ] Aguardar deploy Vercel Ready
5. [ ] Testar dashboard — wizard de onboarding aparece?
6. [ ] Testar sino — abre, mostra alertas?
7. [ ] Testar `/perfil` — atualiza nome?
8. [ ] Criar 1 convite de time, abrir link em janela anonima
9. [ ] Criar contrato novo com template "Social Media Apenas"
10. [ ] `/automacoes` → Nova automacao (gatilho lead_created + enviar WhatsApp) + pausar/ativar
11. [ ] `/atendimento-ia` → Novo agente (Ana SDR) + clicar Editar = pagina `/atendimento-ia/[id]`
12. [ ] `/kanban` → Novo board + clicar **+** em coluna = criar tarefa + arrastar entre colunas
13. [ ] Simular assinatura Clicksign e ver se cobranca Asaas aparece
14. [ ] Se der erro de build, cola log aqui

Pendencias externas (nao bloqueiam):
- Meta App Review (depende Facebook)
- Google Ads dev token Standard
- Clicksign API key (so adicionar em env vars quando contratar)

Bom dia e bom retorno! 🚀
