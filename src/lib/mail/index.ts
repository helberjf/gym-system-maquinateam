import { Resend } from "resend";
import {
  orderConfirmationEmailTemplate,
  orderDeliveredEmailTemplate,
  orderShippedEmailTemplate,
  passwordResetEmailTemplate,
  verificationEmailTemplate,
} from "@/lib/mail/templates";

type SendMailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type MailConfigurationStatus = {
  provider: "resend";
  configured: boolean;
  apiKeyConfigured: boolean;
  senderConfigured: boolean;
  issues: string[];
};

function getConfiguredSender() {
  const fullSender =
    process.env.RESEND_FROM?.trim() || process.env.MAILGUN_FROM?.trim();

  if (fullSender) {
    return fullSender;
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.MAILGUN_FROM_EMAIL?.trim();
  const fromName =
    process.env.RESEND_FROM_NAME?.trim() ||
    process.env.MAILGUN_FROM_NAME?.trim();

  if (!fromEmail) {
    return null;
  }

  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
}

export function getMailConfigurationStatus(): MailConfigurationStatus {
  const apiKeyConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const senderConfigured = Boolean(getConfiguredSender());
  const issues: string[] = [];

  if (!apiKeyConfigured) {
    issues.push("RESEND_API_KEY is not configured.");
  }

  if (!senderConfigured) {
    issues.push(
      "RESEND_FROM is not configured. Use an address from a verified domain in Resend.",
    );
  }

  return {
    provider: "resend",
    configured: apiKeyConfigured && senderConfigured,
    apiKeyConfigured,
    senderConfigured,
    issues,
  };
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const from = getConfiguredSender();

  if (!from) {
    throw new Error(
      "RESEND_FROM is not configured. Set RESEND_FROM (or RESEND_FROM_EMAIL + RESEND_FROM_NAME) with an address from a verified domain in Resend.",
    );
  }

  return { client: new Resend(apiKey), from };
}

export async function sendMail({ to, subject, html, text }: SendMailArgs) {
  const { client, from } = getResendClient();

  const { error } = await client.emails.send({
    from,
    to: [to],
    subject,
    text: text ?? subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function sendVerificationEmail(args: {
  email: string;
  name?: string | null;
  verificationUrl: string;
}) {
  return sendMail({
    to: args.email,
    subject: "Confirme seu e-mail na Maquina Team",
    text: `Confirme seu e-mail acessando ${args.verificationUrl}`,
    html: verificationEmailTemplate(args),
  });
}

export async function sendPasswordResetEmail(args: {
  email: string;
  name?: string | null;
  resetUrl: string;
}) {
  return sendMail({
    to: args.email,
    subject: "Redefina sua senha na Maquina Team",
    text: `Redefina sua senha acessando ${args.resetUrl}`,
    html: passwordResetEmailTemplate(args),
  });
}

type OrderEmailItem = {
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export async function sendOrderConfirmationEmail(args: {
  email: string;
  name?: string | null;
  orderNumber: string;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  deliveryLabel: string;
  paymentMethod: string;
  items: OrderEmailItem[];
  trackOrderUrl: string;
}) {
  return sendMail({
    to: args.email,
    subject: `Pedido ${args.orderNumber} confirmado - Maquina Team`,
    text: `Seu pedido ${args.orderNumber} foi recebido. Acompanhe em ${args.trackOrderUrl}`,
    html: orderConfirmationEmailTemplate(args),
  });
}

export async function sendOrderShippedEmail(args: {
  email: string;
  name?: string | null;
  orderNumber: string;
  trackingCode?: string | null;
  deliveryLabel: string;
  trackOrderUrl: string;
}) {
  return sendMail({
    to: args.email,
    subject: `Pedido ${args.orderNumber} enviado - Maquina Team`,
    text: `Seu pedido ${args.orderNumber} saiu para entrega. Acompanhe em ${args.trackOrderUrl}`,
    html: orderShippedEmailTemplate(args),
  });
}

export async function sendOrderDeliveredEmail(args: {
  email: string;
  name?: string | null;
  orderNumber: string;
  trackOrderUrl: string;
}) {
  return sendMail({
    to: args.email,
    subject: `Pedido ${args.orderNumber} entregue - Maquina Team`,
    text: `Seu pedido ${args.orderNumber} foi entregue. Acesse ${args.trackOrderUrl}`,
    html: orderDeliveredEmailTemplate(args),
  });
}

export async function safeSendEmail<TArgs>(
  label: string,
  sender: (args: TArgs) => Promise<unknown>,
  args: TArgs,
) {
  try {
    await sender(args);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[mail][warn] ${label} failed: ${message}\n`);
    return { ok: false as const, error: message };
  }
}
