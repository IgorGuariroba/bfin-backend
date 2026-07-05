import { randomBytes, scryptSync } from "node:crypto";

const PREFIX = "sk-bfin-";

// Resolvido em runtime (não no load do módulo): o `next build` avalia este
// arquivo com NODE_ENV=production ao coletar dados de página, mas sem as env
// vars de runtime. Lançar no top-level quebraria o build.
function getPepper(): string {
  const pepper = process.env.APIKEY_PEPPER;
  if (!pepper) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APIKEY_PEPPER é obrigatória em produção.");
    }
    return "dev-pepper-change-me";
  }
  return pepper;
}

export function hashApiKey(plain: string): string {
  return scryptSync(plain, getPepper(), 64).toString("base64url");
}

export function verifyApiKey(plain: string, hashedKey: string): boolean {
  return hashApiKey(plain) === hashedKey;
}

export function generateApiKey(): {
  plain: string;
  prefix: string;
  hashedKey: string;
} {
  const random = randomBytes(32).toString("base64url");
  const plain = `${PREFIX}${random}`;
  const prefix = `${PREFIX}${random.slice(0, 4)}`;
  return { plain, prefix, hashedKey: hashApiKey(plain) };
}
