import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Pagamento em confirmacao",
  description: "Retorno do checkout da loja da academia.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function StoreCheckoutSuccessPage({
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
            paymentStatus: true,
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
          Retorno recebido
        </h1>
        <p className="mt-4 text-sm leading-7 text-brand-gray-light sm:text-base">
          {order
            ? `Pedido ${order.orderNumber} voltou do gateway. Estamos confirmando o pagamento e atualizando o status automaticamente.`
            : "Recebemos o retorno do gateway. Assim que o pagamento for confirmado, o pedido aparecera atualizado no seu dashboard."}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link href={order ? `/dashboard/pedidos/${order.id}` : "/dashboard/pedidos"}>
              Ver meus pedidos
            </Link>
          </Button>
          <Button asChild variant="secondary" className="w-full sm:w-auto">
            <Link href="/products">Voltar para a loja</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

