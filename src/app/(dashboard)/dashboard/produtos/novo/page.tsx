import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ProductForm } from "@/components/dashboard/ProductForm";
import { requirePermission } from "@/lib/auth/guards";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { getProductsIndexData } from "@/lib/commerce/service";

export const metadata: Metadata = {
  title: "Novo produto",
  description: "Cadastre um produto com estoque, categoria e imagens no R2.",
};

export default async function NewProductPage() {
  const session = await requirePermission("manageProducts", "/dashboard/produtos/novo");
  const viewer = await getViewerContextFromSession(session);
  const data = await getProductsIndexData(viewer, { page: 1 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercio"
        title="Novo produto"
        description="Cadastre um item com estoque, imagem principal e galeria de apoio para o time de recepcao vender com mais agilidade."
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard/produtos">Voltar para produtos</Link>
          </Button>
        }
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6">
        <ProductForm
          mode="create"
          endpoint="/api/products"
          initialValues={{
            name: "",
            slug: "",
            sku: "",
            category: "",
            shortDescription: "",
            description: "",
            price: "",
            stockQuantity: "0",
            lowStockThreshold: "3",
            trackInventory: true,
            storeVisible: true,
            featured: false,
            weightGrams: "",
            heightCm: "",
            widthCm: "",
            lengthCm: "",
            active: true,
            images: [],
          }}
          options={{
            categories: data.options.categories,
          }}
        />
      </section>
    </div>
  );
}
