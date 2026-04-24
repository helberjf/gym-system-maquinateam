import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/constants/brand";
import { buildPublicMetadata } from "@/lib/seo";

const acceptanceItems = [
  "cumprir estes Termos, a Politica de Privacidade e demais politicas complementares",
  "fornecer informacoes verdadeiras, completas e atualizadas em cadastros, matriculas, pedidos e pagamentos",
  "respeitar regras de seguranca, higiene e convivencia da academia e de seus parceiros",
  "utilizar login, senha e demais credenciais de forma estritamente pessoal e intransferivel",
] as const;

const userObligations = [
  "apresentar documento de identificacao, atestado medico e demais documentos exigidos pela academia quando aplicavel",
  "seguir orientacoes tecnicas dos professores e equipe, respeitando limites individuais de saude",
  "zelar pelos equipamentos, espacos e materiais da academia e de terceiros",
  "nao praticar atos ilicitos, violentos, abusivos ou contrarios a boa fe no uso dos servicos e sistemas digitais",
  "nao utilizar robos, scripts, scraping ou qualquer tecnica automatizada para acessar, copiar ou manipular o site e APIs",
  "nao tentar burlar autenticacao, controles de acesso, cobrancas, cupons ou mecanismos de seguranca",
] as const;

const paymentRules = [
  "planos, assinaturas e pedidos sao regidos pelos valores, prazos e condicoes exibidos no momento da contratacao",
  "a academia pode reajustar valores, modificar planos e alterar condicoes comerciais, sempre comunicando previamente quando exigido por lei",
  "inadimplencia pode implicar em suspensao do acesso aos treinos, pedidos, planos digitais, area do aluno e benefícios associados",
  "estornos e reembolsos seguem as regras da legislacao brasileira aplicavel e as politicas descritas no checkout",
] as const;

const intellectualProperty = [
  "marcas, nome, logotipos, layouts, textos, imagens, videos, codigo-fonte e bases de dados pertencem a academia ou a seus licenciadores",
  "e proibido reproduzir, distribuir, modificar ou explorar comercialmente qualquer conteudo sem autorizacao previa e por escrito",
  "depoimentos, fotos e videos obtidos em eventos, aulas e midias da academia podem ser utilizados institucionalmente, conforme a legislacao aplicavel",
] as const;

const terminationRules = [
  "o usuario pode encerrar sua conta, matricula ou assinatura conforme procedimentos divulgados pela academia",
  "a academia pode suspender ou encerrar o acesso em caso de violacao destes Termos, da legislacao aplicavel ou de regras internas",
  "a cessacao do vinculo nao prejudica obrigacoes contratuais, financeiras, legais ou regulatorias ja existentes",
] as const;

const liabilityRules = [
  "a academia nao se responsabiliza por danos causados por mau uso dos servicos, descumprimento de orientacoes tecnicas ou informacoes falsas fornecidas pelo usuario",
  "a disponibilidade dos sistemas digitais pode sofrer interrupcoes para manutencao, atualizacoes ou em razao de eventos fora de controle razoavel da academia",
  "na maxima extensao permitida por lei, a responsabilidade da academia limita-se a danos diretos e comprovadamente decorrentes de culpa exclusiva sua",
] as const;

export const metadata = buildPublicMetadata({
  title: "Termos de Uso",
  description:
    "Leia os Termos de Uso da Maquina Team que regem matricula, planos, compras, uso do site, aplicativo e demais servicos digitais da academia.",
  path: "/termos-de-uso",
  keywords: [
    "termos de uso academia",
    "contrato de matricula",
    "regulamento maquina team",
  ],
  type: "article",
});

function TermsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-brand-gray-mid bg-brand-gray-dark/70 p-6 sm:p-8">
      <h2 className="text-2xl font-bold uppercase text-white sm:text-3xl">
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-brand-gray-light sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function TermsOfUsePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <section className="rounded-[2.5rem] border border-brand-gray-mid bg-brand-gray-dark p-6 sm:p-8 lg:p-10">
        <p className="text-xs uppercase tracking-[0.34em] text-brand-gray-light">
          Documento legal
        </p>
        <h1 className="mt-4 text-4xl font-bold uppercase text-white sm:text-5xl">
          Termos de Uso
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-gray-light sm:text-base">
          Estes Termos de Uso regulam a relacao entre a {BRAND.name} e o usuario
          que acessa o website, aplicativo, area do aluno, loja online ou qualquer
          outro servico digital ou presencial da academia.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.75rem] border border-brand-gray-mid bg-brand-black/50 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
              Academia
            </p>
            <p className="mt-3 text-base text-white">
              {BRAND.name} - {BRAND.address.full}.
            </p>
            <p className="mt-3 text-sm leading-7 text-brand-gray-light">
              Ao utilizar qualquer servico da {BRAND.name}, o usuario declara ter
              lido, compreendido e concordado integralmente com estes Termos e com
              a Politica de Privacidade.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-brand-gray-mid bg-white p-5 text-black">
            <p className="text-xs uppercase tracking-[0.24em] text-black/55">
              Ultima atualizacao
            </p>
            <p className="mt-3 text-2xl font-bold uppercase">
              20 de abril de 2026
            </p>
            <p className="mt-3 text-sm leading-7 text-black/70">
              Em caso de duvidas, fale com a academia por{" "}
              {BRAND.contact.email}.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-10 space-y-6">
        <TermsCard title="1. Aceitacao dos termos">
          <p>
            O uso do site, do aplicativo, da area do aluno, da loja online e dos
            servicos presenciais da {BRAND.name} depende da aceitacao destes
            Termos. Ao se cadastrar, contratar um plano, realizar uma compra ou
            navegar nas areas logadas, o usuario compromete-se a:
          </p>
          <ul className="space-y-2">
            {acceptanceItems.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
        </TermsCard>

        <TermsCard title="2. Cadastro e conta do usuario">
          <p>
            A utilizacao de funcionalidades privadas exige cadastro com dados
            validos. O usuario e o unico responsavel pela confidencialidade de
            seu login e senha e por qualquer atividade realizada em sua conta.
          </p>
          <p>
            A academia pode exigir verificacao de identidade, documentos
            complementares e confirmacao de e-mail para ativacao da conta.
          </p>
        </TermsCard>

        <TermsCard title="3. Obrigacoes do usuario">
          <p>No uso dos servicos e sistemas da academia, o usuario concorda em:</p>
          <ul className="space-y-2">
            {userObligations.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
        </TermsCard>

        <TermsCard title="4. Planos, pagamentos e produtos">
          <p>
            Contratacao de planos, assinaturas e pedidos da loja online seguem as
            regras exibidas no momento da compra, alem destes Termos e da
            legislacao aplicavel, inclusive o Codigo de Defesa do Consumidor.
          </p>
          <ul className="space-y-2">
            {paymentRules.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
          <p>
            O direito de arrependimento previsto em lei aplica-se a compras feitas
            fora do estabelecimento, observados os prazos legais. Servicos ja
            usufruidos ou consumidos nao sao passiveis de arrependimento.
          </p>
        </TermsCard>

        <TermsCard title="5. Propriedade intelectual">
          <p>
            Todo o conteudo disponibilizado pela {BRAND.name} e protegido por
            leis de propriedade intelectual:
          </p>
          <ul className="space-y-2">
            {intellectualProperty.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
        </TermsCard>

        <TermsCard title="6. Limitacao de responsabilidade">
          <ul className="space-y-2">
            {liabilityRules.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
        </TermsCard>

        <TermsCard title="7. Suspensao e encerramento">
          <ul className="space-y-2">
            {terminationRules.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
        </TermsCard>

        <TermsCard title="8. Protecao de dados pessoais">
          <p>
            O tratamento de dados pessoais observa a Lei Geral de Protecao de
            Dados (Lei 13.709/2018) e a{" "}
            <Link
              href="/politica-de-privacidade"
              className="text-white underline underline-offset-4"
            >
              Politica de Privacidade
            </Link>{" "}
            da {BRAND.name}, que integra estes Termos para todos os fins.
          </p>
        </TermsCard>

        <TermsCard title="9. Alteracoes destes Termos">
          <p>
            A academia pode atualizar estes Termos a qualquer momento. A versao
            vigente sera sempre publicada nesta pagina com a data de ultima
            atualizacao. O uso continuo dos servicos apos a publicacao de nova
            versao indica concordancia com as alteracoes.
          </p>
        </TermsCard>

        <TermsCard title="10. Lei aplicavel e foro">
          <p>
            Estes Termos sao regidos pelas leis da Republica Federativa do Brasil.
            Fica eleito o foro da Comarca de Juiz de Fora - MG para dirimir
            eventuais controversias, salvo previsao legal em sentido contrario.
          </p>
        </TermsCard>
      </div>

      <section className="mt-10 rounded-[2.5rem] border border-brand-gray-mid bg-white px-6 py-10 text-black shadow-[0_20px_80px_rgba(255,255,255,0.06)] sm:px-10">
        <p className="text-xs uppercase tracking-[0.32em] text-black/55">
          Duvidas sobre estes Termos?
        </p>
        <h2 className="mt-4 text-4xl font-bold uppercase leading-none sm:text-5xl">
          Fale com a academia
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-black/70 sm:text-base">
          Se voce tiver qualquer duvida sobre matricula, planos, produtos ou uso
          dos sistemas digitais, fale diretamente com a equipe pelos canais
          oficiais.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a href={`mailto:${BRAND.contact.email}`}>Enviar e-mail</a>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
            <a
              href={BRAND.contact.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          </Button>
          <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
            <Link href="/">Voltar ao inicio</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
