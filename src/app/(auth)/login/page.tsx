import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Entrar",
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
    <AuthCard
      title="Entrar"
      description="Acesse sua conta para acompanhar treinos, planos e pagamentos."
    >
      <LoginForm googleEnabled={googleEnabled} />
    </AuthCard>
  );
}
