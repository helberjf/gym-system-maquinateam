import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envBackup: Record<string, string | undefined> = {};

beforeEach(() => {
  envBackup.ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
  envBackup.ZAPI_INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN;
  envBackup.ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
});

afterEach(() => {
  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.restoreAllMocks();
});

import {
  normalizeBrazilianPhone,
  sendWhatsAppText,
} from "@/lib/messaging/whatsapp";

describe("normalizeBrazilianPhone", () => {
  it("returns null for obviously invalid phones", () => {
    expect(normalizeBrazilianPhone("abc")).toBeNull();
    expect(normalizeBrazilianPhone("1234")).toBeNull();
  });

  it("prepends 55 when missing", () => {
    expect(normalizeBrazilianPhone("11987654321")).toBe("5511987654321");
  });

  it("keeps 55 when already present", () => {
    expect(normalizeBrazilianPhone("5511987654321")).toBe("5511987654321");
  });

  it("strips non digit characters", () => {
    expect(normalizeBrazilianPhone("(11) 98765-4321")).toBe("5511987654321");
  });
});

describe("sendWhatsAppText", () => {
  it("returns noop provider when Z-API credentials are absent", async () => {
    delete process.env.ZAPI_INSTANCE_ID;
    delete process.env.ZAPI_INSTANCE_TOKEN;

    const result = await sendWhatsAppText({
      to: "11987654321",
      message: "oi",
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("noop");
  });

  it("returns invalid_phone when normalization fails", async () => {
    process.env.ZAPI_INSTANCE_ID = "inst";
    process.env.ZAPI_INSTANCE_TOKEN = "tok";

    const result = await sendWhatsAppText({
      to: "bad",
      message: "oi",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_phone");
  });

  it("POSTs to Z-API with normalized phone and returns provider z-api", async () => {
    process.env.ZAPI_INSTANCE_ID = "inst";
    process.env.ZAPI_INSTANCE_TOKEN = "tok";
    process.env.ZAPI_CLIENT_TOKEN = "client-tok";

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messageId: "msg-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await sendWhatsAppText({
      to: "(11) 98765-4321",
      message: "Ola!",
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("z-api");
    expect(result.messageId).toBe("msg-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain("inst");
    expect(call[0]).toContain("tok");
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["Client-Token"]).toBe("client-tok");
    expect(JSON.parse(String(init.body))).toMatchObject({
      phone: "5511987654321",
      message: "Ola!",
    });
  });

  it("returns error when Z-API responds non-2xx", async () => {
    process.env.ZAPI_INSTANCE_ID = "inst";
    process.env.ZAPI_INSTANCE_TOKEN = "tok";

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("oops", { status: 500 }),
    );

    const result = await sendWhatsAppText({
      to: "11987654321",
      message: "oi",
    });

    expect(result.ok).toBe(false);
    expect(result.provider).toBe("z-api");
    expect(result.error).toBe("status_500");
  });
});
