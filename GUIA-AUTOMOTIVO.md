# Guia - Modulo Automotivo

## Por que esse sistema e diferente

Para lojistas de carros, voce tem **3 problemas** que esse sistema resolve:

1. **Vendedor lento** → IA assume em 5 minutos se ele nao responder
2. **Lead perdido** → captura automatica de **14 portais** + Meta + Google
3. **Sem foto/financiamento** → IA envia foto do estoque + simula financiamento

---

## Captura de leads - 3 caminhos

### Caminho 1 - Webhook nativo (recomendado)
Cole essa URL no painel do portal:
```
https://gruponogueiramkt.com/api/webhook/lead/{webhook_token}?portal=webmotors
```

O `webhook_token` e gerado automaticamente para cada cliente. Suportado:
- `?portal=webmotors`
- `?portal=mobiauto`
- `?portal=icarros`
- `?portal=autoconf` (em breve)
- Sem portal = parser generico (qualquer JSON)

### Caminho 2 - Email parser
Cada cliente tem um email unico tipo:
```
loja-athos@leads.gruponogueiramkt.com
```

Configure o portal pra enviar email pra esse endereco. O sistema:
1. Recebe o email
2. Identifica origem pelo conteudo
3. Extrai nome, telefone, modelo de interesse
4. Cria o lead automaticamente

**Funciona com 100% dos portais** mesmo os que nao tem API.

### Caminho 3 - API integrada (premium)
Pra portais com API publica (Webmotors Pro, AutoConf), puxamos os leads de hora em hora.

---

## Round-robin de vendedor

Quando lead chega:
1. Sistema busca vendedores ativos do cliente
2. Calcula quem pegou menos lead nas ultimas 24h
3. Atribui automaticamente
4. Inicia timer SLA

## SLA do vendedor

Configurado por estagio do pipeline:
- **Lead novo**: 5 minutos
- **Primeiro contato**: 30 minutos
- **Visita agendada**: sem timer
- **Proposta**: 48 horas

Quando estoura SLA → automacao dispara:
- Notifica gerente
- IA assume e qualifica
- Escala pra outro vendedor

---

## IA com tools (Claude)

A IA tem acesso a:

| Tool | O que faz |
|---|---|
| `consultar_estoque(marca, modelo, ano_min, preco_max)` | Busca veiculos disponiveis |
| `enviar_foto_veiculo(veiculo_id)` | Envia 3 fotos + ficha tecnica via WhatsApp |
| `simular_financiamento(veiculo_id, entrada, parcelas)` | Calcula parcelas e CET |
| `agendar_visita(data_hora)` | Cria evento + move lead pro estagio |
| `escalar_para_humano(motivo)` | Devolve pro vendedor |

**Exemplo de conversa real:**

```
Cliente: tenho interesse no Onix
IA: [chama consultar_estoque(modelo="Onix")]
IA: Achei 3 Onix no estoque! Posso te enviar fotos?
Cliente: pode mandar
IA: [chama enviar_foto_veiculo(id_xyz)]
IA: Fotos enviadas! O 2020 prata sai por R$ 65k. Quer simular financiamento?
Cliente: quero - 20 mil entrada, 48x
IA: [chama simular_financiamento(id_xyz, 20000, 48)]
IA: 48x de R$ 1.247,50. Quer formalizar a proposta ou agendar visita?
Cliente: visita amanha 14h
IA: [chama agendar_visita("2026-04-15T14:00:00")]
IA: Agendado! Te aguardamos amanha 14h. Endereco: Rua X, 100.
```

---

## Pipeline padrao automotivo

```
Lead novo (5min SLA) →
Primeiro contato (30min SLA) →
Visita agendada →
Compareceu →
Proposta/Test drive →
Negociacao →
Financiamento em analise →
Vendido 🏆
        ↓
    Perdido ❌
```

Cada estagio pode ter automacoes:
- Lead novo → enviar mensagem boas-vindas + IA responde
- Visita agendada → criar evento Calendar + lembrete WhatsApp
- Vendido → pesquisa de satisfacao + tarefa pos-venda 7d

---

## Atribuicao de origem (UTM + portais)

Cada lead chega marcado:
- `meta_ads_facebook` / `meta_ads_instagram`
- `google_ads_search` / `google_ads_youtube`
- `webmotors`, `mobiauto`, `icarros`, `olx`, `mercadolivre`, etc

**Filtros possiveis:**
- "Quantos leads do Webmotors viraram venda?"
- "CPL real do Meta Ads vs Google Ads"
- "Vendedor que melhor converte leads de portal X"

---

## Setup rapido pra cliente automotivo

1. Importar cliente (auto-detecta automotivo): **Dashboard → Importar clientes**
2. Cadastrar vendedores: **Vendedores → Adicionar**
3. Importar estoque: **Estoque → Importar (CSV)** ou conectar DMS
4. Conectar Meta Ads: **Integracoes → Conectar Meta Ads**
5. Webhook portais: copiar URL do cliente e colar nos portais
6. Email parser: configurar Resend Inbound (apontar `leads.gruponogueiramkt.com` MX pra resend)
7. WhatsApp Z-API: ja vem configurado
8. Ativar IA: **Atendimento IA → Editar agente do cliente → Ativar**

Pronto - leads chegam, vendedor recebe, IA assume se demorar, follow-up automatico.

---

## White-label

Cada cliente pode ter o sistema dele com:
- Logo e cor proprias
- Subdominio (ex: `lojaathos.gruponogueiramkt.com`)
- Login de vendedores dele
- Apenas dados dele isolados (RLS)

**Modelo de venda:**
- R$ 297-497/mes pra lojista pequeno
- R$ 997-1.997/mes pra lojista medio (ate 3 vendedores)
- R$ 2.500+ pra rede com multiplas filiais

A agencia (voce) opera todos os tenants e cobra mensalidade.
