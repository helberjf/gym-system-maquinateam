type VerificationEmailTemplateArgs = {
  name?: string | null;
  verificationUrl: string;
};

type PasswordResetEmailTemplateArgs = {
  name?: string | null;
  resetUrl: string;
};

function greeting(name?: string | null) {
  if (!name) {
    return "Ola!";
  }

  const firstName = name.trim().split(/\s+/)[0];
  return `Ola, ${firstName}!`;
}

export function verificationEmailTemplate({
  name,
  verificationUrl,
}: VerificationEmailTemplateArgs) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h1 style="color: #991b1b;">Confirme seu e-mail</h1>
      <p>${greeting(name)}</p>
      <p>Seu cadastro foi criado na Maquina Team. Para ativar sua conta, confirme seu e-mail pelo botao abaixo.</p>
      <p style="margin: 24px 0;">
        <a href="${verificationUrl}" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700;">
          Confirmar e-mail
        </a>
      </p>
      <p>Se o botao nao funcionar, copie e cole este link no navegador:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p>Este link expira em 24 horas.</p>
    </div>
  `;
}

export function passwordResetEmailTemplate({
  name,
  resetUrl,
}: PasswordResetEmailTemplateArgs) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h1 style="color: #991b1b;">Redefinicao de senha</h1>
      <p>${greeting(name)}</p>
      <p>Recebemos um pedido para redefinir sua senha. Se foi voce, use o botao abaixo.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700;">
          Redefinir senha
        </a>
      </p>
      <p>Se o botao nao funcionar, copie e cole este link no navegador:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Este link expira em 1 hora.</p>
      <p>Se voce nao pediu a redefinicao, ignore este e-mail.</p>
    </div>
  `;
}
