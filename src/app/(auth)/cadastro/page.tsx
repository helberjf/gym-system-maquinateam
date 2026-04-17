import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Criar conta",
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
    <AuthCard
      title="Criar conta"
      description="Preencha seus dados para comecar a treinar com a gente."
      size="lg"
    >
      <RegisterForm />
    </AuthCard>
  );
}
