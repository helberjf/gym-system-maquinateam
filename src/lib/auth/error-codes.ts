export const AUTH_ERROR_CODES = {
  invalidCredentials: "invalid_credentials",
  emailNotVerified: "email_not_verified",
  accountDisabled: "account_disabled",
  googleAccountOnly: "google_account_only",
  rateLimited: "rate_limited",
} as const;

export function getAuthErrorMessage(code?: string | null) {
  switch (code) {
    case AUTH_ERROR_CODES.rateLimited:
      return "Muitas tentativas de login. Aguarde alguns minutos para tentar novamente.";
    case AUTH_ERROR_CODES.emailNotVerified:
      return "Seu e-mail ainda nao foi confirmado.";
    case AUTH_ERROR_CODES.accountDisabled:
      return "Sua conta esta desativada. Fale com a academia.";
    case AUTH_ERROR_CODES.googleAccountOnly:
      return "Esta conta foi criada com Google. Entre com Google para continuar.";
    case AUTH_ERROR_CODES.invalidCredentials:
    case "CredentialsSignin":
      return "E-mail ou senha invalidos.";
    default:
      return null;
  }
}
