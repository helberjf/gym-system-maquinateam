import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/constants/brand";
import { buildPublicMetadata } from "@/lib/seo";

const serviceItems = [
  "matricula, adesao, renovacao e cancelamento de planos presenciais e digitais",
  "compra de produtos, acessorios e mercadorias comercializadas pela academia",
  "processamento de pagamentos por cartao, Pix e demais meios oferecidos",
  "agendamento, registro de presenca, acompanhamento de rotina e comunicacoes de suporte",
  "acesso ao painel de aluno, area administrativa autorizada e canais digitais oficiais",
] as const;

const userResponsibilities = [
  "fornecer informacoes verdadeiras, completas e atualizadas em cadastros, matriculas e pagamentos",
  "manter em sigilo senhas, codigos de acesso e tokens pessoais, assumindo responsabilidade pelo uso da conta",
  "utilizar os servicos de boa-fe e em conformidade com a legislacao aplicavel",
  "respeitar colaboradores, professores, alunos e visitantes durante atividades presenciais e comunicacoes digitais",
  "seguir orientacoes tecnicas, regras de seguranca e de higiene das unidades da academia",
  "observar as recomendacoes medicas pessoais antes de iniciar ou retomar atividades fisicas",
] as const;

const paymentTerms = [
  "planos recorrentes sao renovados automaticamente, conforme a periodicidade contratada, ate que o aluno solicite o cancelamento pelos canais oficiais",
  "valores, condicoes comerciais e promocoes podem ser revistos a qualquer momento, respeitados os contratos ja vigentes",
  "pagamentos inadimplentes podem resultar em suspensao do acesso aos servicos, cobranca administrativa e, quando aplicavel, negativacao conforme a legislacao em vigor",
  "reembolsos seguem a legislacao consumerista aplicavel, considerando o inicio de uso do servico e o periodo de arrependimento quando cabivel",
  "todos os pagamentos sao processados por operadores financeiros homologados, que aplicam suas proprias regras de seguranca e antifraude",
] as const;

const prohibitedItems = [
  "utilizar os servicos para finalidades ilicitas, fraudulentas ou que violem direitos de terceiros",
  "tentar acessar contas, paineis, sistemas, dados ou recursos nao autorizados",
  "inserir, transmitir ou propagar virus, malware, scripts automatizados nao autorizados, ataques de forca bruta ou qualquer tecnica de intrusao",
  "revender, sublicenciar, comercializar ou reproduzir os conteudos da academia sem autorizacao expressa e por escrito",
  "utilizar dados de pagamento, identidade ou contato de terceiros sem autorizacao",
  "praticar condutas que perturbem o ambiente de treino, desrespeitem regras internas ou exponham alunos, visitantes e colaboradores a risco",
] as const;

const ipItems = [
  "a marca, o nome, o logotipo, os conteudos editoriais, fotografias, videos, textos, layouts, codigo-fonte e demais elementos de identidade visual sao de titularidade da academia ou de seus licenciantes",
  "a utilizacao dos servicos nao confere ao usuario qualquer direito de propriedade intelectual sobre esses elementos",
  "eventual uso de marca, imagem, voz ou depoimento do aluno em materiais institucionais ocorrera conforme autorizacao especifica ou base legal aplicavel",
] as const;

const liabilityItems = [
  "problemas decorrentes do uso dos servicos em desacordo com estes Termos, com as orientacoes tecnicas da academia ou com recomendacoes medicas do aluno",
  "indisponibilidades, falhas ou interrupcoes causadas por terceiros, provedores de infraestrutura, operadores de pagamento, servicos externos ou caso fortuito e forca maior",
  "danos indiretos, lucros cessantes, perdas de oportunidade ou danos morais decorrentes de uso inadequado dos servicos",
  "conteudos, links ou servicos de terceiros que possam ser acessados a partir do website ou dos canais da academia",
] as const;

export const metadata = buildPublicMetadata({
  title: "Termos de Uso",
  description:
    "Conheca os Termos de Uso dos servicos, planos e sistemas digitais da Maquina Team.",
  path: "/termos",
  keywords: ["termos de uso", "termos e condicoes", "contrato academia"],
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
      <h2 className="text-2xl font-bold uppercase text-white sm:text-3xl">{title}</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-brand-gray-light sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
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
          Estes Termos de Uso regulam a relacao entre a {BRAND.name} e qualquer
          pessoa que utilize os servicos digitais, realize matriculas, contrate
          planos, adquira produtos ou interaja com os canais oficiais da academia.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.75rem] border border-brand-gray-mid bg-brand-black/50 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
              Prestadora
            </p>
            <p className="mt-3 text-base text-white">
              {BRAND.name}, academia de luta localizada em {BRAND.address.full}.
            </p>
            <p className="mt-3 text-sm leading-7 text-brand-gray-light">
              Ao utilizar o website, painel do aluno, canais de atendimento ou
              efetuar qualquer contratacao, o usuario declara ter lido, compreendido
              e aceitado integralmente estes Termos e a{" "}
              <Link
                href="/politica-de-privacidade"
                className="text-white underline underline-offset-4"
              >
                Politica de Privacidade
              </Link>
              .
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-brand-gray-mid bg-white p-5 text-black">
            <p className="text-xs uppercase tracking-[0.24em] text-black/55">
              Ultima atualizacao
            </p>
            <p className="mt-3 text-2xl font-bold uppercase">1 de abril de 2026</p>
            <p className="mt-3 text-sm leading-7 text-black/70">
              Em caso de duvidas sobre contratacoes, pagamentos ou uso dos sistemas,
              entre em contato pelo e-mail {BRAND.contact.email}.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-10 space-y-6">
        <TermsCard title="1. Objeto e servicos oferecidos">
          <p>
            A {BRAND.name} disponibiliza servicos presenciais de treino, planos
            recorrentes, venda de produtos e ferramentas digitais de suporte a
            relacao com alunos, interessados e clientes.
          </p>
          <ul className="space-y-2">
            {serviceItems.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
          <p>
            A academia pode, a seu exclusivo criterio, alterar, acrescentar,
            suspender ou descontinuar modalidades, funcionalidades digitais e
            recursos, comunicando tais alteracoes quando necessario.
          </p>
        </TermsCard>

        <TermsCard title="2. Cadastro, conta e acesso">
          <p>
            Alguns servicos exigem cadastro previo. O usuario e responsavel por
            manter dados cadastrais verdadeiros, atualizados e por zelar pela
            confidencialidade de suas credenciais.
          </p>
          <ul className="space-y-2">
            {userResponsibilities.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
          <p>
            Qualquer atividade realizada com as credenciais do usuario sera
            considerada de sua responsabilidade. Em caso de perda, suspeita de
            acesso indevido ou incidente de seguranca, o usuario deve comunicar
            imediatamente a academia pelos canais oficiais.
          </p>
        </TermsCard>

        <TermsCard title="3. Planos, pagamentos e cobrancas">
          <p>
            A contratacao de planos e produtos e regulada pelas condicoes
            comerciais apresentadas no momento da compra, que integram estes
            Termos como parte indissociavel.
          </p>
          <ul className="space-y-2">
            {paymentTerms.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
          <p>
            O cancelamento de planos recorrentes pode ser solicitado pelos canais
            oficiais, observando o prazo informado no momento da contratacao e as
            regras aplicaveis ao direito de arrependimento.
          </p>
        </TermsCard>

        <TermsCard title="4. Uso permitido e condutas proibidas">
          <p>
            O usuario compromete-se a utilizar os servicos de forma etica,
            responsavel e em conformidade com a legislacao aplicavel. Sao
            expressamente vedadas, entre outras condutas:
          </p>
          <ul className="space-y-2">
            {prohibitedItems.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
          <p>
            O descumprimento destes Termos podera resultar em advertencia, suspensao
            ou encerramento do acesso, sem prejuizo das medidas administrativas,
            civis e criminais aplicaveis.
          </p>
        </TermsCard>

        <TermsCard title="5. Propriedade intelectual">
          <p>
            Todos os direitos de propriedade intelectual relacionados a academia sao
            protegidos pela legislacao vigente. Em especial:
          </p>
          <ul className="space-y-2">
            {ipItems.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
          <p>
            A reproducao, distribuicao, modificacao ou utilizacao nao autorizada de
            qualquer conteudo da academia e expressamente proibida.
          </p>
        </TermsCard>

        <TermsCard title="6. Disponibilidade e limitacoes de responsabilidade">
          <p>
            A academia envida esforcos razoaveis para manter seus servicos digitais
            disponiveis, seguros e estaveis, mas nao garante disponibilidade
            ininterrupta ou livre de falhas. A academia nao se responsabiliza por:
          </p>
          <ul className="space-y-2">
            {liabilityItems.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
          <p>
            As responsabilidades aqui limitadas nao excluem direitos assegurados ao
            consumidor pela legislacao aplicavel, em especial pelo Codigo de Defesa
            do Consumidor e pela Lei Geral de Protecao de Dados.
          </p>
        </TermsCard>

        <TermsCard title="7. Dados pessoais e privacidade">
          <p>
            O tratamento de dados pessoais realizado pela academia esta descrito na{" "}
            <Link
              href="/politica-de-privacidade"
              className="text-white underline underline-offset-4"
            >
              Politica de Privacidade
            </Link>
            , que integra estes Termos e estabelece as finalidades, bases legais,
            direitos do titular e medidas de seguranca adotadas.
          </p>
          <p>
            Ao utilizar os servicos, o usuario declara estar ciente das praticas de
            privacidade descritas naquele documento.
          </p>
        </TermsCard>

        <TermsCard title="8. Alteracoes destes Termos">
          <p>
            A {BRAND.name} pode revisar e alterar estes Termos de Uso a qualquer
            momento, sempre que entender necessario para refletir mudancas
            operacionais, legais, contratuais ou tecnologicas.
          </p>
          <p>
            As versoes atualizadas serao publicadas neste website e passarao a
            valer a partir da sua divulgacao. A continuidade de uso dos servicos
            apos a publicacao caracteriza aceitacao das novas condicoes.
          </p>
        </TermsCard>

        <TermsCard title="9. Legislacao aplicavel e foro">
          <p>
            Estes Termos sao regidos pelas leis da Republica Federativa do Brasil.
            Eventuais controversias decorrentes de sua interpretacao ou execucao
            serao dirimidas no foro da comarca de {BRAND.address.city.split(" - ")[0]}, com
            renuncia a qualquer outro, por mais privilegiado que seja.
          </p>
        </TermsCard>
      </div>

      <section className="mt-10 rounded-[2.5rem] border border-brand-gray-mid bg-white px-6 py-10 text-black shadow-[0_20px_80px_rgba(255,255,255,0.06)] sm:px-10">
        <p className="text-xs uppercase tracking-[0.32em] text-black/55">
          Alguma duvida sobre estes Termos?
        </p>
        <h2 className="mt-4 text-4xl font-bold uppercase leading-none sm:text-5xl">
          A equipe esta pronta para ajudar
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-black/70 sm:text-base">
          Se voce quiser esclarecer pontos contratuais, pagamentos, planos ou uso
          dos sistemas, fale com a {BRAND.name} pelos canais oficiais.
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
