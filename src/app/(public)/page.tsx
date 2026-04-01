import type { Metadata } from "next";
import { auth } from "@/auth";
import { HomeLandingPage } from "@/components/public/HomeLandingPage";
import { getFeaturedPublicPlans } from "@/lib/billing/public";

export const metadata: Metadata = {
  title: "Home",
  description: "Site oficial da Maquina Team com planos, contato, FAQ e acesso ao sistema.",
};

export const dynamic = "force-dynamic";

export default async function PublicHomePage() {
  const [session, featuredPlans] = await Promise.all([
    auth(),
    getFeaturedPublicPlans().catch(() => []),
  ]);

  return (
    <HomeLandingPage
      featuredPlans={featuredPlans}
      isAuthenticated={Boolean(session?.user?.id)}
    />
  );
}
