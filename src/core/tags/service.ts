import type { TagRepo } from "./ports.js";
import type { Tag } from "./types.js";
import { DEFAULT_SYSTEM_TAGS, CATEGORY_TAGS } from "./taxonomy.js";

export class TagValidationError extends Error {}
export class TagNotFoundError extends Error {}
export class SystemTagImmutableError extends Error {}

/** Cor neutra default quando o agente não informa uma — Tags do agente são funcionais, não decorativas. */
const DEFAULT_TAG_COLOR = "#94a3b8";

// Type-mirrors (Entradas/Saídas/...) + categorias canônicas (Transporte/Alimentação/...).
// As categorias dão substância ao suggestTag (#93); o seeding idempotente faz backfill
// em usuários existentes na próxima vez que ensureSystemTags rodar.
const SYSTEM_TAGS = [
  ...DEFAULT_SYSTEM_TAGS.map((t) => ({ name: t.name, color: t.color })),
  ...CATEGORY_TAGS.map((t) => ({ name: t.name, color: t.color })),
];

export interface CreateTagInput {
  userId: string;
  name: string;
  color?: string;
}

// Mesmos limites do boundary HTTP — o caminho do agente não pode aceitar o que
// a UI rejeita (ADR-0004 §1: write rápido em troca de casar a validação de domínio).
function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new TagValidationError("Nome da Tag é obrigatório.");
  if (trimmed.length > 50) throw new TagValidationError("Nome da Tag muito longo (máx. 50).");
  return trimmed;
}

function validateColor(color: string): string {
  if (color.length < 4 || color.length > 30) throw new TagValidationError("Cor da Tag inválida.");
  return color;
}

export function makeTagsService(repo: TagRepo) {
  /**
   * Garante que as tags de sistema existam para o usuário.
   * Cria apenas as que ainda não existem. É idempotente.
   */
  async function ensureSystemTags(userId: string): Promise<void> {
    const existingNames = new Set(await repo.listSystemNames(userId));
    const toCreate = SYSTEM_TAGS.filter((tag) => !existingNames.has(tag.name));
    if (toCreate.length === 0) return;
    await repo.createSystemTags(userId, toCreate);
  }

  /**
   * Cria uma Tag do domínio do User (ADR-0004). Nome único por usuário; nome
   * duplicado vira TagValidationError (o handler MCP a converte em tool error).
   * Sempre isSystem=false — só o seeding cria system tags.
   */
  async function createTag({ userId, name, color }: CreateTagInput): Promise<Tag> {
    const trimmed = validateName(name);
    const resolvedColor = validateColor(color ?? DEFAULT_TAG_COLOR);

    const existing = await repo.findByName(userId, trimmed);
    if (existing) {
      throw new TagValidationError(`Tag "${trimmed}" já existe.`);
    }

    return repo.create({ userId, name: trimmed, color: resolvedColor, isSystem: false });
  }

  /**
   * Lista as Tags do usuário (somente leitura). Semeia as system tags antes de ler,
   * para todo canal (UI, REST, agente) enxergar a taxonomia canônica (#93). System
   * tags primeiro, depois alfabético (contrato de ordenação da porta).
   */
  async function listTags(userId: string): Promise<Tag[]> {
    await ensureSystemTags(userId);
    return repo.listByUser(userId);
  }

  /**
   * Edita nome/cor de uma Tag do usuário. Tag inexistente ou de outro usuário é
   * indistinguível (TagNotFoundError) — não vaza existência. System tags são imutáveis.
   */
  async function updateTag(
    userId: string,
    tagId: string,
    patch: { name?: string; color?: string }
  ): Promise<Tag> {
    const existing = await repo.findById(tagId);
    if (!existing || existing.userId !== userId) {
      throw new TagNotFoundError("Tag não encontrada.");
    }
    if (existing.isSystem) {
      throw new SystemTagImmutableError("Tags do sistema não podem ser editadas");
    }

    const changes: { name?: string; color?: string } = {};
    if (patch.name !== undefined) {
      changes.name = validateName(patch.name);
      if (changes.name !== existing.name) {
        const duplicate = await repo.findByName(userId, changes.name);
        if (duplicate) throw new TagValidationError("Tag com este nome já existe");
      }
    }
    if (patch.color !== undefined) {
      changes.color = validateColor(patch.color);
    }

    return repo.update(tagId, changes);
  }

  /** Exclui uma Tag do usuário. Mesmas proteções de updateTag. */
  async function deleteTag(userId: string, tagId: string): Promise<void> {
    const existing = await repo.findById(tagId);
    if (!existing || existing.userId !== userId) {
      throw new TagNotFoundError("Tag não encontrada.");
    }
    if (existing.isSystem) {
      throw new SystemTagImmutableError("Tags do sistema não podem ser excluídas");
    }
    await repo.delete(tagId);
  }

  return { ensureSystemTags, createTag, listTags, updateTag, deleteTag };
}

export type TagsService = ReturnType<typeof makeTagsService>;
