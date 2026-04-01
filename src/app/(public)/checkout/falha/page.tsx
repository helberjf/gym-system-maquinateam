import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata = buildNoIndexMetadata({
  title: "Pagamento nao concluido",
  description: "Falha ou cancelamento no checkout da loja da Maquina Team.",
  path: "/checkout/falha",
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function StoreCheckoutFailurePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const session = await auth();

  const order =
    session?.user?.id && orderId
      ? await prisma.order.findFirst({
          where: {
            id: orderId,
            userId: session.user.id,
          },
          select: {
            id: true,
            orderNumber: true,
            checkoutPayment: {
              select: {
                checkoutUrl: true,
                status: true,
              },
            },
          },
        })
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-[2.5rem] border border-brand-gray-mid bg-brand-gray-dark p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-brand-gray-light">
          Checkout da loja
        </p>
        <h1 className="mt-4 text-4xl font-bold uppercase text-white sm:text-5xl">
          Pagamento nao concluido
        </h1>
        <p className="mt-4 text-sm leading-7 text-brand-gray-light sm:text-base">
          {order
            ? `O pedido ${order.orderNumber} ainda nao teve pagamento confirmado. Voce pode tentar novamente ou revisar o pedido no dashboard.`
            : "O pagamento nao foi concluido desta vez. Voce pode tentar novamente ou voltar para a loja."}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {order?.checkoutPayment?.checkoutUrl ? (
            <Button asChild className="w-full sm:w-auto">
              <a href={order.checkoutPayment.checkoutUrl}>Tentar novamente</a>
            </Button>
          ) : null}
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link href={order ? `/dashboard/pedidos/${order.id}` : "/carrinho"}>
              Revisar pedido
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
