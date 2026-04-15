/**
 * Controle de acesso modular por produto.
 * Cada rota sensivel mapeia pra uma lista de produtos que liberam ela.
 * Tenant master (Grupo Nogueira) tem acesso a tudo.
 */

// rotas "compartilhadas" que todo tenant com qualquer produto pode ver
export const SHARED_ROUTES = [
  "/perfil", "/planos", "/configuracoes", "/alertas", "/convite",
  "/onboarding", "/onboarding-progress",
];

// mapeamento: prefixo de rota -> produtos que liberam ela
export const ROUTE_PRODUCTS: Record<string, string[]> = {
  // Agencia (base)
  "/dashboard": ["agencia", "completo"],
  "/clientes": ["agencia", "completo"],
  "/social": ["agencia", "completo"],
  "/calendario": ["agencia", "completo"],
  "/leads": ["agencia", "completo"],
  "/pipelines": ["agencia", "completo"],
  "/automacoes": ["agencia", "completo"],
  "/automacoes-ig": ["agencia", "completo"],
  "/copiloto": ["agencia", "completo"],
  "/criativos": ["agencia", "completo"],
  "/rastreamento": ["agencia", "completo"],
  "/jornadas": ["agencia", "completo"],
  "/links-rastreaveis": ["agencia", "completo"],
  "/kanban": ["agencia", "completo"],
  "/financeiro": ["agencia", "completo"],
  "/contratos": ["agencia", "completo"],
  "/cobrancas": ["agencia", "completo"],
  "/assinaturas": ["agencia", "completo"],
  "/atendimento-ia": ["agencia", "completo"],
  "/agentes-ia": ["agencia", "completo"],
  "/utm-builder": ["agencia", "completo"],
  "/customer-success": ["agencia", "completo"],
  "/seo": ["agencia", "completo"],
  "/followup": ["agencia", "completo"],
  "/conversas": ["agencia", "completo"],
  "/integracoes": ["agencia", "completo"],

  // Automotivo
  "/estoque": ["automotivo", "completo"],
  "/vendedores": ["automotivo", "completo"],

  // Comercial
  "/prospeccao": ["comercial", "completo"],

  // YouTube
  "/youtube": ["youtube", "completo"],

  // Infoprodutos
  "/maxxima": ["infoprodutos", "completo"],
};

/** Dada uma rota, retorna os produtos que liberam ela (ou null se compartilhada). */
export function productsRequiredFor(pathname: string): string[] | null {
  // rotas compartilhadas = null (qualquer produto ativo basta)
  for (const shared of SHARED_ROUTES) {
    if (pathname === shared || pathname.startsWith(shared + "/")) return null;
  }

  // busca match por prefixo (rota mais especifica primeiro seria ideal, mas prefixos sao distintos)
  for (const [prefix, products] of Object.entries(ROUTE_PRODUCTS)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return products;
  }

  return null;
}

/** Verifica se tenant tem algum dos produtos necessarios. */
export function hasAnyProduct(activeProducts: string[], requiredProducts: string[] | null, isMaster: boolean): boolean {
  if (isMaster) return true;
  if (!requiredProducts) return true;
  return requiredProducts.some((p) => activeProducts.includes(p));
}
