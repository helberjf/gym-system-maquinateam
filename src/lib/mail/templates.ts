type OrderItem = {
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

type OrderConfirmationEmailArgs = {
  name?: string | null;
  orderNumber: string;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  deliveryLabel: string;
  paymentMethod: string;
  items: OrderItem[];
  trackOrderUrl: string;
};

type OrderShippedEmailArgs = {
  name?: string | null;
  orderNumber: string;
  trackingCode?: string | null;
  deliveryLabel: string;
  trackOrderUrl: string;
};

type OrderDeliveredEmailArgs = {
  name?: string | null;
  orderNumber: string;
  trackOrderUrl: string;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function orderConfirmationEmailTemplate({
  name,
  orderNumber,
  totalCents,
  discountCents,
  shippingCents,
  deliveryLabel,
  paymentMethod,
  items,
  trackOrderUrl,
}: OrderConfirmationEmailArgs) {
  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
            ${item.productName} × ${item.quantity}
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right; white-space: nowrap;">
            ${formatCurrency(item.lineTotalCents)}
          </td>
        </tr>`,
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h1 style="color: #991b1b;">Pedido confirmado!</h1>
      <p>${greeting(name)}</p>
      <p>Recebemos seu pedido e estamos processando o pagamento.</p>
      <p style="font-size: 18px; font-weight: 700;">Pedido ${orderNumber}</p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        ${itemRows}
        ${discountCents > 0 ? `
        <tr>
          <td style="padding: 8px 0;">Desconto</td>
          <td style="padding: 8px 0; text-align: right; color: #16a34a;">- ${formatCurrency(discountCents)}</td>
        </tr>` : ""}
        ${shippingCents > 0 ? `
        <tr>
          <td style="padding: 8px 0;">${deliveryLabel}</td>
          <td style="padding: 8px 0; text-align: right;">${formatCurrency(shippingCents)}</td>
        </tr>` : ""}
        <tr>
          <td style="padding: 12px 0; font-weight: 700; font-size: 16px;">Total</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 16px;">${formatCurrency(totalCents)}</td>
        </tr>
      </table>

      <p><strong>Entrega:</strong> ${deliveryLabel}</p>
      <p><strong>Pagamento:</strong> ${paymentMethod}</p>

      <p style="margin: 24px 0;">
        <a href="${trackOrderUrl}" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700;">
          Acompanhar pedido
        </a>
      </p>
      <p>Qualquer duvida, entre em contato conosco.</p>
    </div>
  `;
}

export function orderShippedEmailTemplate({
  name,
  orderNumber,
  trackingCode,
  deliveryLabel,
  trackOrderUrl,
}: OrderShippedEmailArgs) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h1 style="color: #991b1b;">Seu pedido foi enviado!</h1>
      <p>${greeting(name)}</p>
      <p>Seu pedido <strong>${orderNumber}</strong> saiu para entrega.</p>
      <p><strong>Modalidade:</strong> ${deliveryLabel}</p>
      ${trackingCode ? `<p><strong>Codigo de rastreio:</strong> ${trackingCode}</p>` : ""}
      <p style="margin: 24px 0;">
        <a href="${trackOrderUrl}" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700;">
          Ver detalhes do pedido
        </a>
      </p>
    </div>
  `;
}

export function orderDeliveredEmailTemplate({
  name,
  orderNumber,
  trackOrderUrl,
}: OrderDeliveredEmailArgs) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h1 style="color: #991b1b;">Pedido entregue!</h1>
      <p>${greeting(name)}</p>
      <p>Seu pedido <strong>${orderNumber}</strong> foi entregue. Esperamos que voce curta!</p>
      <p style="margin: 24px 0;">
        <a href="${trackOrderUrl}" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700;">
          Ver detalhes do pedido
        </a>
      </p>
      <p>Obrigado por comprar na Maquina Team!</p>
    </div>
  `;
}

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
