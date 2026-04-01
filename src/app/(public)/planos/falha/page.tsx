import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Pagamento do plano nao concluido",
  description: "Falha ou cancelamento no checkout de planos da academia.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PlanCheckoutFailurePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const subscriptionId =
    typeof params.subscriptionId === "string" ? params.subscriptionId : "";
  const session = await auth();

  const subscription =
    session?.user?.id && subscriptionId
      ? await prisma.subscription.findFirst({
          where: {
            id: subscriptionId,
            studentProfile: {
              userId: session.user.id,
            },
          },
          select: {
            id: true,
            plan: {
              select: {
                name: true,
              },
            },
            checkoutPayment: {
              select: {
                checkoutUrl: true,
              },
            },
          },
        })
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-[2.5rem] border border-brand-gray-mid bg-brand-gray-dark p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-brand-gray-light">
          Checkout de planos
        </p>
        <h1 className="mt-4 text-4xl font-bold uppercase text-white sm:text-5xl">
          Pagamento nao concluido
        </h1>
        <p className="mt-4 text-sm leading-7 text-brand-gray-light sm:text-base">
          {subscription
            ? `A assinatura do plano ${subscription.plan.name} ainda nao foi confirmada. Voce pode gerar uma nova tentativa ou revisar seu dashboard.`
            : "O pagamento do plano nao foi concluido desta vez. Voce pode tentar novamente ou voltar para a tabela publica."}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {subscription?.checkoutPayment?.checkoutUrl ? (
            <Button asChild className="w-full sm:w-auto">
              <a href={subscription.checkoutPayment.checkoutUrl}>Tentar novamente</a>
            </Button>
          ) : null}
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link
              href={
                subscription
                  ? `/dashboard/assinaturas/${subscription.id}`
                  : "/planos"
              }
            >
              Revisar assinatura
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
