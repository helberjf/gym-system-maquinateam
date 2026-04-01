import { permanentRedirect } from "next/navigation";

type RouteParams = Promise<{ slug: string }>;

export default async function StoreProductDetailRedirectPage({
  params,
}: {
  params: RouteParams;
}) {
  const { slug } = await params;
  permanentRedirect(`/products/${slug}`);
}
