import { describe, it, expect } from "vitest";
import { suggestType, suggestTag } from "./suggest.js";

/**
 * Cobrança direta das funções puras de sugestão: a heurística (palavras-chave,
 * normalização de diacríticos, prioridade das estratégias) ganha especificação
 * por testes. Antes deste spec as funções foram extraídas "para testabilidade"
 * mas nunca testadas diretamente.
 */

describe("suggestType", () => {
  it("sugere 'entrada' para descrições com sinal de receita", () => {
    expect(suggestType("Salário do mês")).toBe("entrada");
    expect(suggestType("reembolso da viagem")).toBe("entrada");
    expect(suggestType("depósito bancário")).toBe("entrada");
  });

  it("ignora acentos ao casar palavras-chave de receita", () => {
    expect(suggestType("salario")).toBe("entrada");
    expect(suggestType("deposito")).toBe("entrada");
  });

  it("sugere 'saida' como default conservador para gastos comuns", () => {
    expect(suggestType("Mercado")).toBe("saida");
    expect(suggestType("Uber para o trabalho")).toBe("saida");
  });

  it("jamais sugere 'diario' (reservado à projeção)", () => {
    // Descrição neutra → saida, nunca diario.
    expect(suggestType("qualquer coisa")).toBe("saida");
  });

  it("trata descrição vazia/nula como saida (default)", () => {
    expect(suggestType("")).toBe("saida");
    expect(suggestType(null as unknown as string)).toBe("saida");
  });
});

describe("suggestTag", () => {
  const tags = [
    { id: "t-academia", name: "Academia" },
    { id: "t-viagem", name: "Viagem" },
    { id: "t-moradia", name: "Moradia" }, // casará por categoria (keyword "aluguel")
  ];

  it("casa pelo nome da própria Tag que aparece na descrição (prioridade)", () => {
    expect(suggestTag("mensalidade da academia", tags)).toBe("t-academia");
  });

  it("ignora acentos e maiúsculas ao casar nome da Tag", () => {
    expect(suggestTag("ACADEMIA", tags)).toBe("t-academia");
  });

  it("cai na taxonomia de categoria quando nenhuma Tag casa por nome", () => {
    // "aluguel" é keyword da categoria Moradia; há uma Tag "Moradia".
    expect(suggestTag("aluguel do apartamento", tags)).toBe("t-moradia");
  });

  it("nome da própria Tag vence sobre a categoria quando ambos casam", () => {
    // "viagem" é keyword da categoria Lazer E nome de uma Tag do usuário.
    // A Tag do usuário (user story 9) tem prioridade.
    expect(suggestTag("viagem de férias", tags)).toBe("t-viagem");
  });

  it("retorna null quando nada casa (não inventa Tag)", () => {
    expect(suggestTag("transferência interna", tags)).toBeNull();
  });

  it("retorna null para descrição vazia", () => {
    expect(suggestTag("", tags)).toBeNull();
    expect(suggestTag(null as unknown as string, tags)).toBeNull();
  });
});

/**
 * Cobertura da taxonomia canônica de CATEGORY_TAGS (#93): cada categoria casa
 * por sua keyword e aponta para a Tag correspondente do usuário. Migrada do
 * teste de integração do adapter — aqui é o lugar certo (função pura do core).
 */
describe("suggestTag — taxonomia de categorias", () => {
  const taxonomyTags = [
    { id: "t-alim", name: "Alimentação" },
    { id: "t-transp", name: "Transporte" },
    { id: "t-moradia", name: "Moradia" },
    { id: "t-lazer", name: "Lazer" },
    { id: "t-saude", name: "Saúde" },
  ];

  it("casa keyword de categoria → Tag correspondente", () => {
    expect(suggestTag("uber pro trabalho", taxonomyTags)).toBe("t-transp");
    expect(suggestTag("Mercado da esquina", taxonomyTags)).toBe("t-alim");
    expect(suggestTag("netflix", taxonomyTags)).toBe("t-lazer");
    expect(suggestTag("aluguel do mês", taxonomyTags)).toBe("t-moradia");
    expect(suggestTag("farmacia popular", taxonomyTags)).toBe("t-saude");
  });

  it("retorna null quando a keyword casa mas o usuário não tem a Tag da categoria", () => {
    expect(
      suggestTag("uber", [{ id: "t-alim", name: "Alimentação" }]),
    ).toBeNull();
  });
});
