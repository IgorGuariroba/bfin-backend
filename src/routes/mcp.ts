import { Readable } from "node:stream";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  apiKeysService,
  insightsService,
  previsaoService,
  tagsService,
  transactionsService,
} from "../adapters/index.js";
import {
  TransactionNotFoundError,
  TransactionValidationError,
} from "../core/transactions/index.js";
import { suggestTag, suggestType } from "../core/transactions/suggest.js";
import { TagValidationError } from "../core/tags/index.js";
import { InsightsValidationError } from "../core/insights/index.js";
import { checkRateLimit, classifyRpc, RATE_LIMITS } from "../lib/rate-limit.js";

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
 * Executa uma leitura e empacota o resultado como JSON. Erros de validação
 * (mês/data inválidos) viram tool error estruturado (isError) — espelha o
 * tratamento de create_transaction, em vez de propagar erro JSON-RPC genérico.
 */
async function readContent(produce: () => Promise<unknown>) {
  try {
    return jsonContent(await produce());
  } catch (error) {
    if (
      error instanceof TransactionValidationError ||
      error instanceof TagValidationError ||
      error instanceof InsightsValidationError
    ) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: error.message }],
      };
    }
    throw error;
  }
}

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês no formato YYYY-MM")
  .describe("Mês no formato YYYY-MM (ex.: 2026-06).");

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function buildServer(userId: string, apiKeyId: string): McpServer {
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
    }) => {
      try {
        // Resolve type e Tag sugerida a partir da descrição (ADR-0004) — em
        // memória, já que Tags e Transactions vivem no mesmo processo.
        const resolvedType = type ?? suggestType(description);
        const userTags = await tagsService.listTags(userId);
        const suggestedTagId = suggestTag(description, userTags);
        const result = await transactionsService.createTransaction({
          userId,
          type: resolvedType,
          description,
          amount,
          date,
          source: "agent",
          force,
          repeat,
          repeatEnd,
          repeatCount,
          tagIds: suggestedTagId ? [suggestedTagId] : undefined,
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
      } catch (error) {
        if (error instanceof TransactionValidationError) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: error.message }],
          };
        }
        throw error;
      }
    },
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
    async ({ id, description, amount, date, type, tagIds }) => {
      try {
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
      } catch (error) {
        if (
          error instanceof TransactionValidationError ||
          error instanceof TransactionNotFoundError
        ) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: error.message }],
          };
        }
        throw error;
      }
    },
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
    async ({ id }) => {
      try {
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
      } catch (error) {
        if (
          error instanceof TransactionValidationError ||
          error instanceof TransactionNotFoundError
        ) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: error.message }],
          };
        }
        throw error;
      }
    },
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
    async ({ name, color }) => {
      try {
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
      } catch (error) {
        if (error instanceof TagValidationError) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: error.message }],
          };
        }
        throw error;
      }
    },
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

export function mcpRoutes(app: FastifyInstance) {
  // Captura o corpo cru em vez do JSON já parseado: precisamos do texto exato
  // pra classificar a chamada (classifyRpc) e reconstruir o Request Web
  // Standard que o transport do MCP espera — escopo desta rota só (contexto
  // encapsulado do Fastify), não afeta content-type parsing das demais rotas.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, body);
    },
  );

  // Path idêntico ao público (bfin.app/api/mcp): o Traefik/Dokploy roteia por
  // path pra esse container sem precisar de strip-path — evita ambiguidade
  // sobre o que seria removido (a rota é a única exposta publicamente aqui,
  // as demais deste processo são internas, atrás de INTERNAL_API_SECRET).
  app.post("/api/mcp", async (request, reply) => {
    const token = bearerToken(request);
    if (!token) {
      console.warn("apikey: auth denied", { reason: "missing_token" });
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const principal = await apiKeysService.resolvePrincipal(token);
    if (!principal) {
      console.warn("apikey: auth denied", { reason: "invalid_token" });
      return reply.code(401).send({ error: "Unauthorized" });
    }

    // Rate limit por ApiKey, separado por leitura/escrita (ADR-0004).
    const rawBody = (request.body as string | undefined) ?? "";
    const kind = classifyRpc(rawBody);
    const limit = checkRateLimit(
      `${principal.apiKeyId}:${kind}`,
      RATE_LIMITS[kind],
    );
    if (!limit.allowed) {
      console.warn("apikey: rate limited", {
        apiKeyId: principal.apiKeyId,
        kind,
      });
      reply.header("retry-after", String(limit.retryAfter));
      return reply.code(429).send({ error: "Rate limit exceeded" });
    }

    // Reconstrói um Request Web Standard a partir do request cru do Fastify —
    // o transport do MCP (WebStandardStreamableHTTPServerTransport) só
    // trabalha com a Fetch API (Request/Response/ReadableStream), não com o
    // par (req, res) do Node puro que o Fastify usa por baixo.
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(", "));
    }
    // Descarta os headers que descrevem o corpo na forma em que chegou
    // (comprimido/chunked): rawBody já é texto plano e o transport recalcula
    // o que precisar a partir dele.
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.delete("transfer-encoding");

    const webRequest = new Request(`http://internal${request.url}`, {
      method: request.method,
      headers,
      body: rawBody,
    });

    const server = buildServer(principal.userId, principal.apiKeyId);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    await server.connect(transport);

    const response = await transport.handleRequest(webRequest);

    // Resposta pode ser um stream SSE — sai do fluxo automático do Fastify
    // (hijack) e escreve status/headers/corpo direto no ServerResponse cru.
    reply.hijack();
    reply.raw.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      Readable.fromWeb(response.body).pipe(reply.raw);
    } else {
      reply.raw.end();
    }
  });
}
