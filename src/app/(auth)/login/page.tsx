import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShowcaseShell } from "@/components/auth/AuthShowcaseShell";

export const metadata: Metadata = {
  title: "Login",
  description: "Acesse sua conta para acompanhar planos, pagamentos e treinos.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <AuthShowcaseShell
      eyebrow="Acesso seguro"
      title="Entre para acompanhar sua evolucao"
      description="Use seu e-mail e senha para acessar pagamentos, treinos atribuidos, comunicados da academia e o fluxo completo do aluno."
      supportTitle="Painel, planos e atendimento em um so lugar"
      supportDescription="A experiencia foi pensada para o aluno entrar rapido, acompanhar a rotina e fechar o que precisar sem perder o clima premium da Maquina Team."
      highlights={[
        "Pagamentos e renovacoes no mesmo painel do aluno.",
        "Treinos, avisos e suporte comercial sempre por perto.",
        "Fluxo alinhado ao visual do projeto de referencia e ao tema da academia.",
      ]}
    >
      <div className="mx-auto max-w-xl">
        <LoginForm googleEnabled={googleEnabled} />
      </div>
    </AuthShowcaseShell>
  );
}
