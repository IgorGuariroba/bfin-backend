import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  apiKeysService,
  insightsService,
  previsaoService,
  tagsService,
  transactionsService,
} from "../adapters/index.js";
import { classifyDomainError } from "../core/error-classifier.js";

const fmt = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    val,
  );

/** Empacota um resultado de leitura como conteúdo JSON para o agente consumir. */
function jsonContent(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

/**
 * Formata um Date como YYYY-MM-DD em hora local. As Transaction são gravadas ao
 * meio-dia local (parseTransactionDay), então os componentes locais dão a
 * data-calendário correta — é a mesma base que list/insights usam para o dia.
 */
function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Empacota o resultado de uma tool (ação síncrona) tratando qualquer erro de
 * domínio classificado (src/core/error-classifier.ts) como resposta de tool
 * com isError — mensagem legível em vez de erro JSON-RPC opaco. Erros não
 * classificados propagam (500/erro de protocolo).
 */
async function toolResult(
  produce: () => Promise<{
    content: Array<{ type: "text"; text: string }>;
    structuredContent?: Record<string, unknown>;
  }>,
) {
  try {
    return await produce();
  } catch (error) {
    if (classifyDomainError(error)) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: (error as Error).message }],
      };
    }
    throw error;
  }
}

/**
 * Executa uma leitura e empacota o resultado como JSON. Erros de domínio
 * classificados viram tool error estruturado (isError) em vez de propagar
 * erro JSON-RPC genérico.
 */
async function readContent(produce: () => Promise<unknown>) {
  return toolResult(async () => jsonContent(await produce()));
}

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês no formato YYYY-MM")
  .describe("Mês no formato YYYY-MM (ex.: 2026-06).");

/**
 * Monta o servidor MCP registrando o catálogo de tools do agente. Cada tool é
 * declarativa: schema de entrada/saída + chamada a um caso de uso (service do
 * core) + formatação da resposta — sem orquestração de domínio inline. Só
 * `userId`/`apiKeyId` (contexto do principal já resolvido pela rota) atravessam
 * o fechamento.
 */
export function buildMcpServer(userId: string, apiKeyId: string): McpServer {
  const server = new McpServer({ name: "bfin-assistente", version: "1.0.0" });

  server.registerTool(
    "create_transaction",
    {
      description:
        "Registra uma movimentação financeira (Transaction) na conta do usuário.",
      inputSchema: {
        description: z.string().describe("Descrição da movimentação"),
        amount: z.number().positive().describe("Valor, sempre positivo"),
        date: z.string().describe("Data no formato YYYY-MM-DD"),
        type: z
          .enum(["entrada", "saida", "cartao", "economia"])
          .optional()
          .describe(
            "Tipo da movimentação. Se omitido, é inferido da descrição (gasto → 'saida', receita → 'entrada'). " +
              "Gasto real (mercado, uber, etc.) é 'saida'. 'diario' não é permitido — é reservado à projeção da Previsão.",
          ),
        force: z
          .boolean()
          .optional()
          .describe(
            "Força a criação mesmo quando houver uma transação duplicata suspeita.",
          ),
        repeat: z
          .enum(["daily", "weekly", "monthly"])
          .optional()
          .describe(
            "Recorrência: 'daily', 'weekly' ou 'monthly'. Omitido = não repete.",
          ),
        repeatEnd: z
          .enum(["forever", "count"])
          .optional()
          .describe(
            "Fim da recorrência: 'forever' (12 ocorrências) ou 'count' (use repeatCount). Só vale com repeat.",
          ),
        repeatCount: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Número de ocorrências quando repeatEnd='count'."),
      },
      // Canal de máquina paralelo ao texto (ADR-0006): devolve o id para o agente
      // encadear uma correção (update/delete) sem re-listar. `type` é string (não
      // enum) de propósito: a candidata duplicata pode ser de qualquer tipo, e a
      // validação estrita do outputSchema não deve estourar por um tipo legítimo.
      outputSchema: {
        id: z
          .string()
          .describe("Id da movimentação criada (ou da duplicata existente)."),
        duplicated: z
          .boolean()
          .describe(
            "true = nada foi criado; id/campos referem-se à duplicata existente.",
          ),
        type: z.string().describe("Tipo resolvido da movimentação."),
        amount: z.number().describe("Valor persistido."),
        date: z.string().describe("Data no formato YYYY-MM-DD."),
        tagId: z
          .string()
          .nullable()
          .describe("Tag aplicada (auto-sugerida) ou null."),
      },
    },
    async ({
      description,
      amount,
      date,
      type,
      force,
      repeat,
      repeatEnd,
      repeatCount,
    }) =>
      toolResult(async () => {
        // Sugestão + criação compostas no core (suggest/createSuggested): a
        // fronteira só transporta. A auditoria da escrita do agente
        // (recordAgentWrite) permanece aqui — apiKeyId é preocupação de
        // transporte, não do domínio de Transações.
        const result = await transactionsService.createSuggested({
          userId,
          description,
          amount,
          date,
          type,
          source: "agent",
          force,
          repeat,
          repeatEnd,
          repeatCount,
        });
        if (result.duplicated) {
          const dup = result.transaction;
          return {
            content: [
              {
                type: "text" as const,
                text: `Possível duplicata: já existe "${dup.description}" (${dup.type}) ${fmt(dup.amount)}. Envie force=true para criar mesmo assim.`,
              },
            ],
            structuredContent: {
              id: dup.id,
              duplicated: true,
              type: dup.type,
              amount: dup.amount,
              date: ymd(dup.date),
              tagId: dup.tags[0]?.id ?? null,
            },
          };
        }
        const tx = result.transaction;
        await apiKeysService.recordAgentWrite({
          apiKeyId,
          userId,
          action: "create",
          entityId: tx.id,
        });
        const tagName = tx.tags[0]?.name;
        const recurrenceNote =
          repeat && repeatEnd === "count" && repeatCount
            ? ` Recorrência ${repeat} (${repeatCount}x).`
            : repeat
              ? ` Recorrência ${repeat}.`
              : "";
        const tagNote = tagName ? ` Tag: ${tagName}.` : "";
        return {
          content: [
            {
              type: "text" as const,
              text: `Movimentação criada: ${tx.description} (${tx.type}) ${fmt(tx.amount)} em ${date}.${tagNote}${recurrenceNote}`,
            },
          ],
          structuredContent: {
            id: tx.id,
            duplicated: false,
            type: tx.type,
            amount: tx.amount,
            date: ymd(tx.date),
            tagId: tx.tags[0]?.id ?? null,
          },
        };
      }),
  );

  server.registerTool(
    "get_month_summary",
    {
      description:
        "Resumo do mês em uma chamada: entradas, custo de vida, quanto sobrou (sobrouNoMes) e saldo. Use para responder 'quanto sobrou este mês'.",
      inputSchema: { month: monthSchema },
    },
    async ({ month }) =>
      readContent(() => insightsService.getMonthSummary(userId, month)),
  );

  server.registerTool(
    "get_totais",
    {
      description:
        "Totais detalhados do mês por tipo (entrada/saida/cartao/diario/economia), custo de vida, performance, saldo e comparação com o mês anterior.",
      inputSchema: { month: monthSchema },
    },
    async ({ month }) =>
      readContent(() => insightsService.getTotais(userId, month)),
  );

  server.registerTool(
    "get_saldos",
    {
      description:
        "Evolução do saldo acumulado dia a dia no mês (para mostrar como o saldo varia ao longo do mês).",
      inputSchema: { month: monthSchema },
    },
    async ({ month }) =>
      readContent(() => insightsService.getSaldos(userId, month)),
  );

  server.registerTool(
    "get_sugestoes",
    {
      description:
        "Insights financeiros proativos do mês (saldo negativo, gasto diário acima da Previsão, economia baixa, custo de vida em alta). Lista vazia = nada a sinalizar.",
      inputSchema: { month: monthSchema },
    },
    async ({ month }) =>
      readContent(() => insightsService.getSugestoes(userId, month)),
  );

  server.registerTool(
    "list_transactions",
    {
      description:
        "Lista movimentações com filtros, para responder perguntas como 'quanto gastei com mercado'. Filtre por mês, tipo e/ou Tag.",
      inputSchema: {
        month: monthSchema.optional(),
        type: z
          .enum(["entrada", "saida", "diario", "cartao", "economia"])
          .optional()
          .describe(
            "Filtra por tipo da movimentação. 'diario' é a projeção de gasto variável da Previsão (não gasto real).",
          ),
        tagId: z
          .string()
          .optional()
          .describe("Filtra pelas movimentações com esta Tag."),
      },
    },
    async ({ month, type, tagId }) =>
      readContent(() =>
        transactionsService.listTransactions(userId, { month, type, tagId }),
      ),
  );

  server.registerTool(
    "update_transaction",
    {
      description:
        "Edita uma movimentação existente, identificada pelo seu id (alvo explícito). " +
        "Envie só os campos a corrigir; os demais ficam intactos.",
      inputSchema: {
        id: z.string().describe("Identificador da movimentação a editar."),
        description: z.string().optional().describe("Nova descrição."),
        amount: z
          .number()
          .positive()
          .optional()
          .describe("Novo valor, sempre positivo."),
        date: z
          .string()
          .optional()
          .describe("Nova data no formato YYYY-MM-DD."),
        type: z
          .enum(["entrada", "saida", "cartao", "economia"])
          .optional()
          .describe(
            "Novo tipo. 'diario' não é permitido — é reservado à projeção da Previsão.",
          ),
        tagIds: z
          .array(z.string())
          .optional()
          .describe("Substitui o conjunto de Tags (lista vazia remove todas)."),
      },
      // Estado resultante para o agente encadear outra edição (ADR-0006).
      outputSchema: {
        id: z.string().describe("Id da movimentação editada."),
        type: z.string().describe("Tipo após a edição."),
        amount: z.number().describe("Valor após a edição."),
        date: z.string().describe("Data no formato YYYY-MM-DD após a edição."),
        tagIds: z.array(z.string()).describe("Conjunto de Tags resultante."),
      },
    },
    async ({ id, description, amount, date, type, tagIds }) =>
      toolResult(async () => {
        const tx = await transactionsService.updateTransaction({
          userId,
          id,
          description,
          amount,
          date,
          type,
          tagIds,
        });
        await apiKeysService.recordAgentWrite({
          apiKeyId,
          userId,
          action: "update",
          entityId: tx.id,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Movimentação atualizada: ${tx.description} (${tx.type}) ${fmt(tx.amount)}.`,
            },
          ],
          structuredContent: {
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            date: ymd(tx.date),
            tagIds: tx.tags.map((t) => t.id),
          },
        };
      }),
  );

  server.registerTool(
    "delete_transaction",
    {
      description:
        "Remove permanentemente uma movimentação pelo seu id (irreversível). " +
        "Use para apagar um lançamento errado.",
      inputSchema: {
        id: z.string().describe("Identificador da movimentação a remover."),
      },
    },
    async ({ id }) =>
      toolResult(async () => {
        await transactionsService.deleteTransaction(userId, id);
        await apiKeysService.recordAgentWrite({
          apiKeyId,
          userId,
          action: "delete",
          entityId: id,
        });
        return {
          content: [
            { type: "text" as const, text: `Movimentação ${id} removida.` },
          ],
        };
      }),
  );

  server.registerTool(
    "create_tag",
    {
      description:
        "Cria uma Tag (categoria) na conta do usuário, para classificar movimentações. " +
        "O nome é único por usuário.",
      inputSchema: {
        name: z
          .string()
          .describe("Nome da Tag (ex.: 'Viagem'). Único por usuário."),
        color: z
          .string()
          .optional()
          .describe(
            "Cor em hex (ex.: '#4a90e2'). Se omitida, usa uma cor neutra.",
          ),
      },
      // Devolve o id da Tag para o agente encadear (ex.: aplicá-la num
      // update_transaction) sem re-listar (ADR-0006).
      outputSchema: {
        id: z.string().describe("Id da Tag criada."),
        name: z.string().describe("Nome da Tag."),
        color: z.string().describe("Cor resolvida da Tag (hex)."),
      },
    },
    async ({ name, color }) =>
      toolResult(async () => {
        const tag = await tagsService.createTag({ userId, name, color });
        await apiKeysService.recordAgentWrite({
          apiKeyId,
          userId,
          action: "create",
          entityId: tag.id,
        });
        return {
          content: [
            { type: "text" as const, text: `Tag criada: ${tag.name}.` },
          ],
          structuredContent: { id: tag.id, name: tag.name, color: tag.color },
        };
      }),
  );

  server.registerTool(
    "list_tag",
    {
      description:
        "Lista as Tags (categorias) do usuário, para escolher um filtro ou descobrir a taxonomia disponível.",
      inputSchema: {},
    },
    async () => readContent(() => tagsService.listTags(userId)),
  );

  server.registerTool(
    "get_previsao",
    {
      description:
        "Retorna a Previsão configurada do usuário (itens de gasto previsto, somente leitura). " +
        "Não aplica nem altera nada.",
      inputSchema: {},
    },
    async () => readContent(() => previsaoService.listPrevisoes(userId)),
  );

  return server;
}
