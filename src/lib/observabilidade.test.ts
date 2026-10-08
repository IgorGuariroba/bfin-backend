import { describe, expect, it, vi } from "vitest";
import { observe, operationId } from "./observabilidade.js";

describe("observabilidade de negócio", () => {
  it("preserva resultado e não registra o conteúdo retornado", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = { token: "segredo-financeiro" };
    expect(await observe("webhook.processing", async () => result)).toBe(
      result,
    );
    const event = JSON.parse(log.mock.calls.at(-1)![0]);
    expect(event.result).toBe("success");
    expect(JSON.stringify(event)).not.toContain(result.token);
    log.mockRestore();
  });
  it("preserva a exceção sem publicar sua mensagem ou stack", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = new Error("senha e payload privados");
    await expect(
      observe("webhook.persistence.activate", async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(JSON.parse(log.mock.calls.at(-1)![0]).result).toBe("error");
    expect(JSON.stringify(log.mock.calls)).not.toContain(error.message);
    log.mockRestore();
  });
  it("correlaciona reentregas sem expor o identificador externo", () => {
    const id = operationId("payment-private-id", "key-one");
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(operationId("payment-private-id", "key-one")).toBe(id);
    expect(operationId("payment-private-id", "key-two")).not.toBe(id);
  });
});
