import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata = buildNoIndexMetadata({
  title: "Plano em confirmacao",
  description: "Retorno do checkout de planos da Maquina Team.",
  path: "/planos/sucesso",
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PlanCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const subscriptionId =
    typeof params.subscriptionId === "string" ? params.subscriptionId : "";
  const status = typeof params.status === "string" ? params.status : "";
  const isConfirmed = ["PAID", "APPROVED", "SUCCEEDED", "COMPLETED"].includes(
    status.toUpperCase(),
  );
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
          {isConfirmed ? "Pagamento confirmado" : "Retorno recebido"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-brand-gray-light sm:text-base">
          {subscription
            ? isConfirmed
              ? `Pagamento do plano ${subscription.plan.name} confirmado. Sua assinatura ja esta ativa.`
              : `Recebemos o retorno do pagamento do plano ${subscription.plan.name}. Assim que o gateway confirmar a cobranca, sua assinatura sera ativada automaticamente.`
            : isConfirmed
              ? "Pagamento do plano confirmado. Sua assinatura foi ativada automaticamente."
              : "Recebemos o retorno do pagamento do plano. Assim que o gateway confirmar a cobranca, sua assinatura sera ativada automaticamente."}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link
              href={
                subscription
                  ? `/dashboard/assinaturas/${subscription.id}`
                  : "/dashboard/assinaturas"
              }
            >
              Ver minhas assinaturas
            </Link>
          </Button>
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link href="/planos">Voltar para os planos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
