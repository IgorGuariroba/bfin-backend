import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { checkRateLimit, classifyRpc } from "./rate-limit.js";

const config = { limit: 3, windowMs: 60_000 };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("permite chamadas dentro do limite da janela", () => {
    const key = `k-${crypto.randomUUID()}`;
    for (let i = 0; i < config.limit; i++) {
      const result = checkRateLimit(key, config);
      expect(result.allowed).toBe(true);
    }
  });

  it("bloqueia a chamada que excede o limite e informa retryAfter em segundos", () => {
    const key = `k-${crypto.randomUUID()}`;
    for (let i = 0; i < config.limit; i++) checkRateLimit(key, config);

    const result = checkRateLimit(key, config);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBe(config.windowMs / 1000);
  });

  it("reabre a janela após windowMs e volta a permitir", () => {
    const key = `k-${crypto.randomUUID()}`;
    for (let i = 0; i < config.limit; i++) checkRateLimit(key, config);
    expect(checkRateLimit(key, config).allowed).toBe(false);

    vi.advanceTimersByTime(config.windowMs);

    expect(checkRateLimit(key, config).allowed).toBe(true);
  });

  it("isola baldes por chave (uma chave estourada não afeta a outra)", () => {
    const a = `k-${crypto.randomUUID()}`;
    const b = `k-${crypto.randomUUID()}`;
    for (let i = 0; i < config.limit; i++) checkRateLimit(a, config);
    expect(checkRateLimit(a, config).allowed).toBe(false);

    expect(checkRateLimit(b, config).allowed).toBe(true);
  });
});

describe("classifyRpc", () => {
  const call = (name: string) =>
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name } });

  it("classifica tools/call de uma write-tool como write", () => {
    for (const name of [
      "create_transaction",
      "update_transaction",
      "delete_transaction",
      "create_tag",
    ]) {
      expect(classifyRpc(call(name))).toBe("write");
    }
  });

  it("classifica tools/call de uma read-tool como read", () => {
    for (const name of ["get_month_summary", "list_transactions", "list_tag", "get_previsao"]) {
      expect(classifyRpc(call(name))).toBe("read");
    }
  });

  it("classifica tools/list e initialize (handshake de protocolo) como read", () => {
    expect(classifyRpc(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }))).toBe(
      "read"
    );
    expect(classifyRpc(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }))).toBe(
      "read"
    );
  });

  it("trata body não-JSON como read (não onera a cota de escrita)", () => {
    expect(classifyRpc("not json")).toBe("read");
  });

  it("classifica batch JSON-RPC com qualquer write-tool como write (sem bypass)", () => {
    const batch = JSON.stringify([
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_tag" } },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "create_transaction" } },
    ]);
    expect(classifyRpc(batch)).toBe("write");
  });

  it("classifica batch JSON-RPC só de leituras como read", () => {
    const batch = JSON.stringify([
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_month_summary" } },
    ]);
    expect(classifyRpc(batch)).toBe("read");
  });
});
