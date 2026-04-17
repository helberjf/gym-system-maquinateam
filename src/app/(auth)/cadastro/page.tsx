import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShowcaseShell } from "@/components/auth/AuthShowcaseShell";

export const metadata: Metadata = {
  title: "Cadastro",
  description: "Crie sua conta, confirme seu e-mail e acesse a area privada.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CadastroPage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <AuthShowcaseShell
      eyebrow="Novo acesso"
      title="Crie sua conta e entre no sistema"
      description="Cadastro pensado para funcionar bem no celular, com identidade visual mais forte e um fluxo claro para liberar planos, pagamentos e comunicados."
      supportTitle="Comece com a conta pronta para a rotina da academia"
      supportDescription="Depois do cadastro, o aluno ja pode confirmar o e-mail, entrar no painel e seguir para planos, checkout e acompanhamento da evolucao."
      highlights={[
        "Formulario mais organizado para preencher no mobile sem aperto.",
        "Campos agrupados por contexto para reduzir friccao no cadastro.",
        "Visual alinhado ao restante do projeto, sem bordas fracas nem CTA apagado.",
      ]}
    >
      <div className="mx-auto max-w-2xl">
        <RegisterForm />
      </div>
    </AuthShowcaseShell>
  );
}
