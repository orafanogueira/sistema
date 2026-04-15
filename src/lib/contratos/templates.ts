/**
 * Templates de contrato pre-prontos por vertical.
 * Variaveis no formato {{nome}} sao substituidas no momento da geracao.
 */

export interface TemplateDef {
  key: string;
  name: string;
  vertical: string;
  categoria: string;
  variables: string[];
  body: string;
}

export const CONTRATO_TEMPLATES: TemplateDef[] = [
  {
    key: "agencia_marketing",
    name: "Prestacao de Servicos de Marketing Digital",
    vertical: "agencia",
    categoria: "prestacao_servico",
    variables: ["contratante_nome","contratante_cnpj","contratante_endereco","contratada_nome","contratada_cnpj","valor_mensal","prazo_meses","data_inicio","escopo","dia_vencimento"],
    body: `CONTRATO DE PRESTACAO DE SERVICOS DE MARKETING DIGITAL

CONTRATADA: {{contratada_nome}}, CNPJ {{contratada_cnpj}}.
CONTRATANTE: {{contratante_nome}}, CNPJ {{contratante_cnpj}}, com sede em {{contratante_endereco}}.

CLAUSULA 1 - OBJETO
A CONTRATADA prestara servicos de marketing digital a CONTRATANTE, compreendendo:
{{escopo}}

CLAUSULA 2 - PRAZO
O presente contrato tem prazo de {{prazo_meses}} meses, iniciando em {{data_inicio}}, renovando-se automaticamente por periodos iguais salvo manifestacao contraria com 30 dias de antecedencia.

CLAUSULA 3 - REMUNERACAO
A CONTRATANTE pagara mensalmente a CONTRATADA o valor de R$ {{valor_mensal}}, com vencimento no dia {{dia_vencimento}} de cada mes.

CLAUSULA 4 - OBRIGACOES DA CONTRATADA
a) Executar os servicos com diligencia profissional;
b) Manter sigilo sobre informacoes do CONTRATANTE;
c) Entregar relatorios mensais de performance;
d) Atender em horario comercial.

CLAUSULA 5 - OBRIGACOES DA CONTRATANTE
a) Fornecer acessos necessarios as plataformas de anuncio;
b) Disponibilizar verba de midia acordada separadamente;
c) Realizar pagamentos no prazo;
d) Aprovar pecas em ate 48h uteis.

CLAUSULA 6 - VERBAS DE MIDIA
Valores aplicados em plataformas de anuncio (Meta, Google, TikTok, etc) sao de responsabilidade EXCLUSIVA da CONTRATANTE, pagos diretamente as plataformas.

CLAUSULA 7 - PROPRIEDADE INTELECTUAL
As pecas criadas sao de uso do CONTRATANTE durante a vigencia do contrato. Metodologias, processos e estrategias permanecem da CONTRATADA.

CLAUSULA 8 - RESCISAO
Podera ser rescindido por qualquer parte com aviso previo de 30 dias. Inadimplencia superior a 15 dias autoriza rescisao imediata pela CONTRATADA.

CLAUSULA 9 - FORO
Fica eleito o foro da comarca da sede da CONTRATADA.

Data: {{data_inicio}}
`,
  },

  {
    key: "automotivo_consignacao",
    name: "Contrato de Consignacao de Veiculo",
    vertical: "automotivo",
    categoria: "consignacao",
    variables: ["consignante_nome","consignante_cpf","consignatario_nome","consignatario_cnpj","veiculo_marca","veiculo_modelo","veiculo_ano","veiculo_placa","veiculo_chassi","valor_minimo","comissao_pct","prazo_dias","data_inicio"],
    body: `CONTRATO DE CONSIGNACAO DE VEICULO

CONSIGNANTE: {{consignante_nome}}, CPF {{consignante_cpf}}.
CONSIGNATARIO: {{consignatario_nome}}, CNPJ {{consignatario_cnpj}}.

CLAUSULA 1 - OBJETO
O CONSIGNANTE entrega ao CONSIGNATARIO, em consignacao para venda, o veiculo:
- Marca/Modelo: {{veiculo_marca}} {{veiculo_modelo}}
- Ano: {{veiculo_ano}}
- Placa: {{veiculo_placa}}
- Chassi: {{veiculo_chassi}}

CLAUSULA 2 - VALOR MINIMO DE VENDA
R$ {{valor_minimo}}. Vendas abaixo exigem autorizacao previa por escrito.

CLAUSULA 3 - COMISSAO
{{comissao_pct}}% sobre o valor de venda sera retido pelo CONSIGNATARIO.

CLAUSULA 4 - PRAZO
{{prazo_dias}} dias a partir de {{data_inicio}}, renovavel por acordo.

CLAUSULA 5 - RESPONSABILIDADES
a) CONSIGNANTE: quitar debitos existentes ate a entrega (IPVA, licenciamento, multas);
b) CONSIGNATARIO: guarda e seguranca do veiculo, divulgacao, atendimento;
c) Seguro: [a combinar].

CLAUSULA 6 - VENDA
Efetivada a venda, o CONSIGNATARIO repassa ao CONSIGNANTE o valor liquido em ate 3 dias uteis.

CLAUSULA 7 - DEVOLUCAO
Caso nao haja venda no prazo, o CONSIGNANTE retira o veiculo sem custos.

Data: {{data_inicio}}
`,
  },

  {
    key: "social_media_apenas",
    name: "Prestacao de Servicos - Social Media",
    vertical: "agencia",
    categoria: "prestacao_servico",
    variables: ["contratante_nome","contratante_cnpj","contratada_nome","contratada_cnpj","valor_mensal","prazo_meses","data_inicio","qtd_posts_mes","qtd_stories_mes","dia_vencimento"],
    body: `CONTRATO DE PRESTACAO DE SERVICOS - SOCIAL MEDIA

CONTRATADA: {{contratada_nome}}, CNPJ {{contratada_cnpj}}.
CONTRATANTE: {{contratante_nome}}, CNPJ {{contratante_cnpj}}.

CLAUSULA 1 - OBJETO
Servicos de Social Media nas redes do CONTRATANTE:
- {{qtd_posts_mes}} posts/reels/carrosseis por mes
- {{qtd_stories_mes}} stories por mes
- Planejamento editorial
- Metricas mensais

CLAUSULA 2 - PRAZO
{{prazo_meses}} meses desde {{data_inicio}}.

CLAUSULA 3 - VALOR
R$ {{valor_mensal}}/mes, vencimento dia {{dia_vencimento}}.

CLAUSULA 4 - APROVACAO
Cliente aprova conteudo em ate 48h. Apos isso, aprovado automaticamente.

CLAUSULA 5 - RESCISAO
Aviso previo de 30 dias.

Data: {{data_inicio}}
`,
  },

  {
    key: "trafego_pago_apenas",
    name: "Prestacao de Servicos - Trafego Pago",
    vertical: "agencia",
    categoria: "prestacao_servico",
    variables: ["contratante_nome","contratante_cnpj","contratada_nome","contratada_cnpj","honorario_mensal","verba_midia_mensal","plataformas","prazo_meses","data_inicio","dia_vencimento"],
    body: `CONTRATO DE GESTAO DE TRAFEGO PAGO

CONTRATADA: {{contratada_nome}}, CNPJ {{contratada_cnpj}}.
CONTRATANTE: {{contratante_nome}}, CNPJ {{contratante_cnpj}}.

CLAUSULA 1 - OBJETO
Gestao de anuncios pagos em: {{plataformas}}.

CLAUSULA 2 - VALORES
Honorario: R$ {{honorario_mensal}}/mes.
Verba midia: R$ {{verba_midia_mensal}}/mes (pago DIRETAMENTE pelo CONTRATANTE as plataformas).

CLAUSULA 3 - PRAZO
{{prazo_meses}} meses desde {{data_inicio}}.

CLAUSULA 4 - OBRIGACOES DA CONTRATADA
- Configurar e otimizar campanhas
- Relatorio mensal de performance
- Sugestoes de criativos

CLAUSULA 5 - OBRIGACOES DO CONTRATANTE
- Disponibilizar acessos de anuncio
- Responder leads no tempo certo
- Aprovar criativos em 48h

CLAUSULA 6 - RESULTADO
CONTRATADA nao garante CPL/CPA/ROAS especifico - performance depende de variaveis externas.

CLAUSULA 7 - VENCIMENTO
Dia {{dia_vencimento}} de cada mes.

CLAUSULA 8 - RESCISAO
Aviso previo 30 dias.

Data: {{data_inicio}}
`,
  },

  {
    key: "comercial_generico",
    name: "Prestacao de Servicos (generico)",
    vertical: "comercial",
    categoria: "prestacao_servico",
    variables: ["contratante_nome","contratante_cpf_cnpj","contratada_nome","contratada_cnpj","escopo","valor_total","forma_pagamento","prazo","data_inicio"],
    body: `CONTRATO DE PRESTACAO DE SERVICOS

CONTRATANTE: {{contratante_nome}}, inscrito no CPF/CNPJ {{contratante_cpf_cnpj}}.
CONTRATADA: {{contratada_nome}}, CNPJ {{contratada_cnpj}}.

1. OBJETO
A CONTRATADA prestara servicos conforme escopo abaixo:
{{escopo}}

2. VALOR E PAGAMENTO
Valor total: R$ {{valor_total}}
Forma de pagamento: {{forma_pagamento}}

3. PRAZO
{{prazo}}, iniciando em {{data_inicio}}.

4. CONFIDENCIALIDADE
Ambas as partes obrigam-se a manter sigilo sobre informacoes da outra parte.

5. FORO
Foro de eleicao o da cidade sede da CONTRATADA.

Data: {{data_inicio}}
`,
  },
];

export function getTemplate(key: string): TemplateDef | undefined {
  return CONTRATO_TEMPLATES.find((t) => t.key === key);
}

export function renderTemplate(body: string, values: Record<string, string | number>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => String(values[k] ?? `{{${k}}}`));
}
