# Fatia A - Entregue

## O que entrou

### Schema novo (migration 003)
- `agent_catalog` - 27 agentes IA pre-configurados
- `agent_runs` - historico de execucoes
- `social_posts` + `social_post_metrics` + `social_profile_snapshots` + `social_content_strategy`
- `alerts` - alertas inteligentes com severity/tipo
- view `v_metrics_summary` + funcoes auxiliares

### 27 Agentes IA
**Social Media (12):**
1. Estrategia de Conteudo
2. Pesquisa e Tendencias
3. Roteirista de Reels
4. Legendas e Copy
5. Carrossel (output JSON estruturado)
6. Design Briefing
7. Adaptacao por Nicho
8. Atendimento e Aprovacao
9. Analise de Metricas
10. Reaproveitamento de Conteudo
11. Stories Diarios
12. Persona e Tom de Voz

**Trafego Pago (15):**
1. Diagnostico do Negocio
2. Planejamento de Campanha
3. Pesquisa de Publico
4. Pesquisa de Palavras-chave
5. Copy para Anuncios
6. Criativos de Performance
7. Estrutura Tecnica
8. Landing Page e Conversao
9. Otimizacao Diaria
10. Diagnostico de Lead
11. Escala
12. Relatorios e Insights
13. Remarketing
14. CRM e Follow-up
15. Auditoria de Conta (PRO)

Cada agente tem:
- Prompt profissional pronto pra uso (calibrado pra resultado direto)
- Schema de inputs esperados (com placeholders)
- Modelo + temperature recomendados
- Output formato (text, markdown ou json)

### Dashboard CEO completo
- 12 KPIs principais com delta vs periodo anterior
- 8 alertas inteligentes detectaveis automaticamente
- 5 rankings (ROAS, leads, CTR, crescimento, pior CPL)
- Health score por cliente
- Distribuicao de leads por origem (pie chart)
- Tabela completa da carteira (clientes ordenados por saude)

### Sistema de alertas
Detectores rodando a cada 1h:
- Queda de leads (>30%)
- Aumento de CPL (>35%)
- Sem postagem ha 4+ dias
- Tempo de resposta > 60min
- Leads esquecidos > 48h
- Vencimento proximo (5 dias)
- Desempenho excelente (+50% leads)

### Novas paginas
- `/dashboard` - Dashboard CEO completo
- `/agentes-ia` - Catalogo dos 27 agentes
- `/agentes-ia/[key]` - Pagina de execucao do agente
- `/social` - Lista de posts
- `/calendario` - Calendario editorial mensal
- `/alertas` - Lista completa de alertas

### Sidebar reorganizada
- Geral · Conteudo · CRM · Automotivo · IA · Times · Atendimento · Sistema

### Crons (vercel.json)
- `/api/cron/alerts` - hourly (detectar alertas)
- `/api/cron/automations` - 5min
- `/api/cron/followup` - 5min
- `/api/cron/sync-metrics` - daily 4am

---

## Setup pra ativar (no Supabase + Vercel)

### 1. Rodar migration 003
```sql
-- Supabase SQL Editor
-- cole e rode supabase/migrations/003_social_dashboards.sql
```

### 2. Popular catalogo de agentes
```bash
# Apos deploy na Vercel, faca uma chamada autenticada:
curl -X POST https://gruponogueiramkt.com/api/ai-agents/seed \
  -H "Authorization: Bearer $CRON_SECRET"

# OU pelo navegador, logado, abra DevTools console:
fetch("/api/ai-agents/seed", {method:"POST"})
```

### 3. Verificar
- `/agentes-ia` deve listar os 27 agentes
- `/dashboard` deve mostrar Dashboard CEO (mesmo vazio)
- Cron de alertas vai rodar na proxima hora cheia

---

## Como usar

### Gerar conteudo com IA (passo a passo)
1. Acesse `/agentes-ia`
2. Escolha um agente (ex: "Roteirista de Reels")
3. Selecione cliente (opcional - personaliza o output)
4. Preencha inputs (tema, objetivo, duracao)
5. Clique "Gerar com IA"
6. Output aparece em segundos
7. Copie e use

### Ver alertas
- `/dashboard` - top 12 alertas inline
- `/alertas` - todos os alertas + resolvidos
- Crons rodam de hora em hora

### Dashboard CEO
- KPIs gerais da carteira
- Comparativo automatico com periodo anterior
- Saude por cliente (score 0-100)
- Rankings + distribuicao de origens

---

## Proximas fatias (B a F)

- **B:** Painel social media operacional + diagnostico IA por cliente + calendario drag-drop
- **C:** Painel trafego pago detalhado + agente otimizacao diaria em cron
- **D:** Painel CRM/comercial completo
- **E:** Portal cliente white-label simplificado
- **F:** Auditoria automatica de conta + analise por veiculo

Cada fatia ~2-3h de trabalho. Validar uma antes de seguir pra proxima.
