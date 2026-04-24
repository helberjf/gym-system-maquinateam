import type { Metadata } from "next";
import QRCode from "qrcode";
import { UserRole } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RefreshQrButton } from "@/components/dashboard/RefreshQrButton";
import { getViewerContextFromSession } from "@/lib/academy/access";
import { createStudentCheckinToken } from "@/lib/academy/qr-token";
import { requireAuthenticatedSession } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Meu QR de check-in",
  description: "Apresente esse codigo na recepcao para registrar check-in.",
};

export const dynamic = "force-dynamic";

export default async function MyQrPage() {
  const session = await requireAuthenticatedSession("/dashboard/meu-qr");
  const viewer = await getViewerContextFromSession(session);

  if (viewer.role !== UserRole.ALUNO || !viewer.studentProfileId) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="QR de check-in"
          title="Recurso disponivel apenas para alunos"
          description="Entre com uma conta de aluno para gerar o seu codigo pessoal."
        />
      </div>
    );
  }

  const ttlSeconds = 60;
  const token = createStudentCheckinToken(viewer.studentProfileId, ttlSeconds);
  const dataUrl = await QRCode.toDataURL(token, {
    margin: 1,
    width: 320,
    color: { dark: "#ffffff", light: "#0a0a0a" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Check-in"
        title="Meu QR code"
        description="Apresente na recepcao para registrar a aula. O codigo expira em 60 segundos."
      />

      <section className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-6 text-center">
        <img
          src={dataUrl}
          alt="QR code pessoal para check-in"
          className="mx-auto h-80 w-80 rounded-2xl border border-brand-gray-mid bg-brand-black p-4"
        />
        <p className="mt-4 text-sm text-brand-gray-light">
          Valido por 60 segundos. Se expirar, atualize para gerar um novo codigo.
        </p>
        <div className="mt-4 flex justify-center">
          <RefreshQrButton />
        </div>
      </section>
    </div>
  );
}
