import { CATEGORY_TAGS } from "../tags/taxonomy.js";

// Sinais de receita para suggestType. Lista conservadora: o default é gasto → "saida".
// "diario" jamais é sugerido (é projeção — ADR-0004).
const INCOME_KEYWORDS = [
  "salário",
  "salario",
  "recebi",
  "rendimento",
  "depósito",
  "deposito",
  "reembolso",
];

/** Sugere type a partir da descrição: receita → "entrada", resto → "saida" (nunca "diario"). */
export function suggestType(description: string): "entrada" | "saida" {
  const d = (description ?? "").toLowerCase();
  return INCOME_KEYWORDS.some((k) => d.includes(k)) ? "entrada" : "saida";
}

/** Minúsculas + remove acentos, para casar descrição × nome de Tag sem sensibilidade a diacríticos. */
function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Sugere o id de uma Tag do usuário a partir da descrição. Retorna null se nada casar.
 * Heurística conservadora (ADR-0004): primeiro tenta o nome da própria Tag na descrição,
 * depois um sinônimo de categoria (taxonomia canônica em CATEGORY_TAGS — #93). Nunca inventa
 * Tag — só aponta para uma existente (as categorias são semeadas por ensureSystemTags).
 */
export function suggestTag(
  description: string,
  tags: { id: string; name: string }[],
): string | null {
  const d = normalize(description);
  if (!d) return null;

  // 1) Nome da Tag aparece na descrição (ex.: "Academia" em "academia mensal").
  for (const tag of tags) {
    const n = normalize(tag.name);
    if (n && d.includes(n)) return tag.id;
  }

  // 2) Palavra-chave de categoria → Tag cujo nome case com a categoria.
  for (const cat of CATEGORY_TAGS) {
    if (cat.keywords.some((k) => d.includes(k))) {
      const target = normalize(cat.name);
      const tag = tags.find((t) => normalize(t.name).includes(target));
      if (tag) return tag.id;
    }
  }
  return null;
}
