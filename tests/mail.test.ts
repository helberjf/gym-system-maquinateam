import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const emailsSend = vi.fn();
  return { emailsSend };
});

vi.mock("resend", () => {
  const emailsSend = mocks.emailsSend;
  function Resend() {
    return { emails: { send: emailsSend } };
  }
  return { Resend };
});

import {
  getMailConfigurationStatus,
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
} from "@/lib/mail";

const ENV_DEFAULTS = {
  RESEND_API_KEY: "re_test_key",
  RESEND_FROM: "Maquina Team <onboarding@resend.dev>",
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  const merged = { ...ENV_DEFAULTS, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("getMailConfigurationStatus", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.RESEND_FROM_NAME;
  });

  it("retorna configured=true quando API key e sender estão definidos", () => {
    setEnv();
    const status = getMailConfigurationStatus();
    expect(status.configured).toBe(true);
    expect(status.apiKeyConfigured).toBe(true);
    expect(status.senderConfigured).toBe(true);
    expect(status.issues).toHaveLength(0);
    expect(status.provider).toBe("resend");
  });

  it("reporta issue quando RESEND_API_KEY está ausente", () => {
    setEnv({ RESEND_API_KEY: undefined });
    const status = getMailConfigurationStatus();
    expect(status.configured).toBe(false);
    expect(status.apiKeyConfigured).toBe(false);
    expect(status.issues.some((i) => i.includes("RESEND_API_KEY"))).toBe(true);
  });

  it("reporta issue quando sender não está configurado", () => {
    setEnv({ RESEND_FROM: undefined });
    const status = getMailConfigurationStatus();
    expect(status.configured).toBe(false);
    expect(status.senderConfigured).toBe(false);
    expect(status.issues.some((i) => i.includes("RESEND_FROM"))).toBe(true);
  });

  it("aceita sender via RESEND_FROM_EMAIL + RESEND_FROM_NAME", () => {
    setEnv({
      RESEND_FROM: undefined,
      RESEND_FROM_EMAIL: "noreply@academia.com",
      RESEND_FROM_NAME: "Academia",
    });
    const status = getMailConfigurationStatus();
    expect(status.configured).toBe(true);
    expect(status.senderConfigured).toBe(true);
  });

  it("aceita sender via RESEND_FROM_EMAIL sem nome", () => {
    setEnv({
      RESEND_FROM: undefined,
      RESEND_FROM_EMAIL: "noreply@academia.com",
    });
    const status = getMailConfigurationStatus();
    expect(status.senderConfigured).toBe(true);
  });
});

describe("sendMail — Resend SDK", () => {
  beforeEach(() => {
    setEnv();
    mocks.emailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });
  });

  it("chama emails.send com os campos corretos", async () => {
    await sendMail({
      to: "dest@example.com",
      subject: "Assunto",
      html: "<b>HTML</b>",
      text: "Texto",
    });

    expect(mocks.emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Maquina Team <onboarding@resend.dev>",
        to: ["dest@example.com"],
        subject: "Assunto",
        html: "<b>HTML</b>",
        text: "Texto",
      }),
    );
  });

  it("usa subject como text fallback quando text não é fornecido", async () => {
    await sendMail({ to: "x@x.com", subject: "Sem texto", html: "<p/>" });

    expect(mocks.emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Sem texto" }),
    );
  });

  it("lança erro quando RESEND_API_KEY está ausente", async () => {
    delete process.env.RESEND_API_KEY;

    await expect(
      sendMail({ to: "x@x.com", subject: "s", html: "" }),
    ).rejects.toThrow("RESEND_API_KEY");
  });

  it("lança erro quando sender não está configurado", async () => {
    delete process.env.RESEND_FROM;
    delete process.env.RESEND_FROM_EMAIL;

    await expect(
      sendMail({ to: "x@x.com", subject: "s", html: "" }),
    ).rejects.toThrow("RESEND_FROM");
  });

  it("lança erro quando a API do Resend retorna error", async () => {
    mocks.emailsSend.mockResolvedValue({
      data: null,
      error: { message: "invalid_api_key", name: "validation_error" },
    });

    await expect(
      sendMail({ to: "x@x.com", subject: "s", html: "<p/>" }),
    ).rejects.toThrow("Resend error: invalid_api_key");
  });
});

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    setEnv();
    mocks.emailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });
  });

  it("envia email de verificação com assunto e URL corretos", async () => {
    await sendVerificationEmail({
      email: "novo@academia.com",
      name: "Carlos",
      verificationUrl: "http://localhost:3000/confirmar-email?token=abc123",
    });

    expect(mocks.emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["novo@academia.com"],
        subject: expect.stringContaining("Confirme seu e-mail"),
        text: expect.stringContaining("confirmar-email?token=abc123"),
        html: expect.stringContaining("abc123"),
      }),
    );
  });

  it("funciona sem nome do usuário", async () => {
    await expect(
      sendVerificationEmail({
        email: "anonimo@academia.com",
        verificationUrl: "http://localhost:3000/confirmar-email?token=xyz",
      }),
    ).resolves.not.toThrow();
  });
});

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    setEnv();
    mocks.emailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });
  });

  it("envia email de redefinição de senha com URL do token", async () => {
    await sendPasswordResetEmail({
      email: "usuario@academia.com",
      name: "Ana",
      resetUrl: "http://localhost:3000/redefinir-senha/token-reset-123",
    });

    expect(mocks.emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["usuario@academia.com"],
        subject: expect.stringContaining("Redefina sua senha"),
        text: expect.stringContaining("redefinir-senha/token-reset-123"),
        html: expect.stringContaining("token-reset-123"),
      }),
    );
  });

  it("funciona sem nome do usuário", async () => {
    await expect(
      sendPasswordResetEmail({
        email: "usuario@academia.com",
        resetUrl: "http://localhost:3000/redefinir-senha/tok",
      }),
    ).resolves.not.toThrow();
  });
});

describe("sendOrderConfirmationEmail", () => {
  beforeEach(() => {
    setEnv();
    mocks.emailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });
  });

  const baseArgs = {
    email: "cliente@academia.com",
    name: "João",
    orderNumber: "ORD-0042",
    totalCents: 15000,
    subtotalCents: 14000,
    discountCents: 0,
    shippingCents: 1000,
    deliveryLabel: "PAC",
    paymentMethod: "Pix",
    items: [
      {
        productName: "Whey Protein 1kg",
        quantity: 1,
        unitPriceCents: 14000,
        lineTotalCents: 14000,
      },
    ],
    trackOrderUrl: "http://localhost:3000/pedidos/ORD-0042",
  };

  it("envia confirmação com número do pedido no assunto", async () => {
    await sendOrderConfirmationEmail(baseArgs);

    expect(mocks.emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["cliente@academia.com"],
        subject: expect.stringContaining("ORD-0042"),
        text: expect.stringContaining("ORD-0042"),
      }),
    );
  });

  it("html contém nome do produto", async () => {
    await sendOrderConfirmationEmail(baseArgs);

    const call = mocks.emailsSend.mock.calls[0][0] as { html: string };
    expect(call.html).toContain("Whey Protein 1kg");
  });
});

describe("sendOrderShippedEmail", () => {
  beforeEach(() => {
    setEnv();
    mocks.emailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });
  });

  it("envia email de envio de pedido com número correto", async () => {
    await sendOrderShippedEmail({
      email: "cliente@academia.com",
      name: "Maria",
      orderNumber: "ORD-0099",
      trackingCode: "BR123456789",
      deliveryLabel: "Sedex",
      trackOrderUrl: "http://localhost:3000/pedidos/ORD-0099",
    });

    expect(mocks.emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["cliente@academia.com"],
        subject: expect.stringContaining("ORD-0099"),
      }),
    );
  });

  it("funciona sem código de rastreio", async () => {
    await expect(
      sendOrderShippedEmail({
        email: "cliente@academia.com",
        orderNumber: "ORD-0100",
        deliveryLabel: "Retirada",
        trackOrderUrl: "http://localhost:3000/pedidos/ORD-0100",
      }),
    ).resolves.not.toThrow();
  });
});

describe("sendOrderDeliveredEmail", () => {
  beforeEach(() => {
    setEnv();
    mocks.emailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });
  });

  it("envia email de entrega com número e URL do pedido", async () => {
    await sendOrderDeliveredEmail({
      email: "cliente@academia.com",
      name: "Pedro",
      orderNumber: "ORD-0200",
      trackOrderUrl: "http://localhost:3000/pedidos/ORD-0200",
    });

    expect(mocks.emailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["cliente@academia.com"],
        subject: expect.stringContaining("ORD-0200"),
        text: expect.stringContaining("ORD-0200"),
      }),
    );
  });
});
