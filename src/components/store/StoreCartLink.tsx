import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getCartSnapshot } from "@/lib/store/cart";

type StoreCartLinkProps = {
  mobile?: boolean;
};

export async function StoreCartLink({ mobile = false }: StoreCartLinkProps) {
  const cart = await getCartSnapshot();
  const count = cart.summary.itemCount;

  if (mobile) {
    return (
      <Link
        href="/carrinho"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-gray-mid bg-brand-gray-dark text-brand-gray-light transition hover:text-white"
        aria-label={`Carrinho${count > 0 ? ` (${count} itens)` : ""}`}
      >
        <ShoppingCart className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      href="/carrinho"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-gray-light transition hover:text-white"
      aria-label={`Carrinho${count > 0 ? ` (${count} itens)` : ""}`}
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
