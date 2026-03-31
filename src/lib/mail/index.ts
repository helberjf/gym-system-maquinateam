import FormData from "form-data";
import Mailgun from "mailgun.js";
import { passwordResetEmailTemplate, verificationEmailTemplate } from "@/lib/mail/templates";

type SendMailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function getMailgunClient() {
  const apiKey = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();
  const baseUrl = process.env.MAILGUN_API_BASE_URL?.trim() || "https://api.mailgun.net";

  if (!apiKey) {
    throw new Error("MAILGUN_API_KEY is not configured.");
  }

  if (!domain) {
    throw new Error("MAILGUN_DOMAIN is not configured.");
  }

  const from =
    process.env.MAILGUN_FROM?.trim() ||
    "Maquina Team <no-reply@maquinateam.com.br>";

  const mailgun = new Mailgun(FormData);

  return {
    client: mailgun.client({
      username: "api",
      key: apiKey,
      url: baseUrl,
    }),
    domain,
    from,
  };
}

export async function sendMail({ to, subject, html, text }: SendMailArgs) {
  const { client, domain, from } = getMailgunClient();

  await client.messages.create(domain, {
    from,
    to: [to],
    subject,
    text: text ?? subject,
    html,
  });
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
