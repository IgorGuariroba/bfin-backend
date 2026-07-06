import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../lib/drizzle.js";
import { user as userTable } from "../db/schema.js";
import { trackCreatedUsers } from "../adapters/drizzle/test-helpers.js";

const { mockPreApprovalGet } = vi.hoisted(() => ({
  mockPreApprovalGet: vi.fn(),
}));

// PreApproval mockado (efeito de domínio); WebhookSignatureValidator segue REAL
// via importOriginal — a verificação de assinatura é exatamente o que está sob teste.
vi.mock("mercadopago", async (importOriginal) => ({
  ...(await importOriginal<typeof import("mercadopago")>()),
  PreApproval: class {
    get = mockPreApprovalGet;
  },
}));

const { buildApp } = await import("../app.js");

const SECRET = "test-mp-webhook-secret";
const DATA_ID = "preapproval-123";
const REQUEST_ID = "req-abc";
const trackUser = trackCreatedUsers();

function sign(dataId: string, ts: string, secret = SECRET) {
  // Manifesto oficial do MP: id em lowercase e `;` no final.
  const message = `id:${dataId.toLowerCase()};request-id:${REQUEST_ID};ts:${ts};`;
  return createHmac("sha256", secret).update(message).digest("hex");
}

function inject(
  app: ReturnType<typeof buildApp>,
  opts: { ts?: string; v1?: string; type?: string; dataId?: string } = {}
) {
  const dataId = opts.dataId ?? DATA_ID;
  const ts = opts.ts ?? String(Math.floor(Date.now() / 1000));
  const v1 = opts.v1 ?? sign(dataId, ts);
  return app.inject({
    method: "POST",
    url: "/api/webhook/mercadopago",
    headers: {
      "content-type": "application/json",
      "x-signature": `ts=${ts},v1=${v1}`,
      "x-request-id": REQUEST_ID,
    },
    payload: { type: opts.type ?? "subscription_preapproval", data: { id: dataId } },
  });
}

async function seedUser(opts: Partial<{ plan: string; mpSubscriptionId: string }> = {}) {
  const [user] = await db
    .insert(userTable)
    .values({
      id: crypto.randomUUID(),
      name: "Webhook MP User",
      email: `webhook-mp-${crypto.randomUUID()}@example.com`,
      ...opts,
    })
    .returning();
  trackUser(user.id);
  return user;
}

beforeEach(() => {
  vi.stubEnv("MERCADO_PAGO_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("DISCORD_WEBHOOK_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/webhook/mercadopago — verificação de assinatura", () => {
  it("responde 500 (fail-closed) quando o secret não está configurado", async () => {
    vi.stubEnv("MERCADO_PAGO_WEBHOOK_SECRET", "");

    const res = await inject(buildApp());

    expect(res.statusCode).toBe(500);
  });

  it("rejeita assinatura inválida com 401", async () => {
    const res = await inject(buildApp(), { v1: "deadbeef".repeat(8) });

    expect(res.statusCode).toBe(401);
  });

  it("rejeita replay: ts além da tolerância com 401", async () => {
    const staleTs = String(Math.floor(Date.now() / 1000) - 10 * 60);

    const res = await inject(buildApp(), { ts: staleTs });

    expect(res.statusCode).toBe(401);
  });

  it("ignora eventos de outro tipo sem exigir assinatura", async () => {
    const app = buildApp();
    const ts = String(Math.floor(Date.now() / 1000));

    const res = await app.inject({
      method: "POST",
      url: "/api/webhook/mercadopago",
      headers: { "content-type": "application/json", "x-signature": `ts=${ts},v1=xx` },
      payload: { type: "payment", data: { id: "pay-1" } },
    });

    expect(res.statusCode).toBe(200);
  });

  it("não exige x-internal-secret (rota pública, autenticada pela assinatura do MP)", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", "outro-secret");
    const user = await seedUser({ plan: "free" });
    mockPreApprovalGet.mockResolvedValue({
      id: DATA_ID,
      status: "authorized",
      external_reference: `${user.id}:monthly`,
    });

    const res = await inject(buildApp());

    expect(res.statusCode).toBe(200);
  });
});

describe("POST /api/webhook/mercadopago — falha no processamento", () => {
  it("responde 500 quando a consulta ao MP falha, sem vazar o status upstream", async () => {
    mockPreApprovalGet.mockRejectedValue({ message: "Unauthorized access to resource.", status: 401 });

    const res = await inject(buildApp());

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to process event" });
  });
});

describe("POST /api/webhook/mercadopago — evento legítimo", () => {
  it("authorized com assinatura válida ativa o pro do usuário", async () => {
    const user = await seedUser({ plan: "free" });
    mockPreApprovalGet.mockResolvedValue({
      id: DATA_ID,
      status: "authorized",
      external_reference: `${user.id}:monthly`,
    });

    const res = await inject(buildApp());

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    const [inDb] = await db.select().from(userTable).where(eq(userTable.id, user.id));
    expect(inDb.plan).toBe("pro");
    expect(inDb.mpSubscriptionId).toBe(DATA_ID);
  });
});
