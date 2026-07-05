/** Tags padrão do sistema — criadas automaticamente para cada usuário e não editáveis */
export const DEFAULT_SYSTEM_TAGS = [
  { name: "Entradas", color: "#2db55d" },
  { name: "Saídas",   color: "#ff385c" },
  { name: "Diários",  color: "#92174d" },
  { name: "Economias", color: "#2db55d" },
] as const;

/**
 * Taxonomia canônica de categorias de gasto (#93). Semeadas como system tags por
 * `ensureSystemTags` e usadas por `suggestTag` para inferir uma Tag a partir da descrição.
 * `keywords` são casadas por substring numa descrição já normalizada (minúsculas, sem acento),
 * portanto devem ser escritas sem acento. Fonte única: seeding e sugestão leem daqui.
 */
export const CATEGORY_TAGS = [
  {
    name: "Alimentação",
    color: "#f5a623",
    keywords: ["mercado", "supermercado", "ifood", "restaurante", "lanche", "padaria", "comida", "almoco", "jantar"],
  },
  {
    name: "Transporte",
    color: "#4a90e2",
    keywords: ["uber", "99", "taxi", "gasolina", "combustivel", "onibus", "metro", "passagem", "estacionamento"],
  },
  {
    name: "Moradia",
    color: "#7b6ef6",
    keywords: ["aluguel", "condominio", "luz", "agua", "internet", "iptu", "faxina"],
  },
  {
    name: "Lazer",
    color: "#460479",
    keywords: ["cinema", "bar", "show", "viagem", "netflix", "spotify", "streaming", "jogo", "festa"],
  },
  {
    name: "Saúde",
    color: "#50c878",
    keywords: ["farmacia", "remedio", "medico", "consulta", "exame", "academia", "dentista"],
  },
] as const;
