import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/constants/brand";
import { buildPublicMetadata } from "@/lib/seo";

const collectedData = [
  "nome completo",
  "CPF, documento de identidade ou dados cadastrais equivalentes, quando necessarios",
  "data de nascimento",
  "genero, quando informado pelo usuario",
  "endereco de e-mail",
  "endereco residencial ou comercial",
  "numeros de telefone e WhatsApp",
  "dados de pagamento e cobranca, inclusive informacoes necessarias para processar planos, produtos e pedidos",
  "dados de saude e atestado medico, quando necessarios para a prestacao segura dos servicos da academia",
  "imagem, fotografia, video, voz e depoimentos, quando houver gravacao ou consentimento para uso institucional",
  "dados de compra, carrinho, pedidos, assinaturas, pagamentos, presenca e interacoes com os servicos digitais da academia",
  "dados tecnicos e identificadores digitais, como endereco IP, cookies, session id, logs de acesso, navegador, dispositivo e paginas acessadas",
] as const;

const purposes = [
  "prestar os servicos contratados pelo usuario, incluindo matricula, planos, agenda, acompanhamento e atendimento nas unidades ou canais digitais",
  "processar pagamentos de planos e produtos, emitir cobrancas, validar transacoes e registrar pedidos",
  "entrar em contato por e-mail, telefone, SMS ou WhatsApp para tratar de cadastro, pagamentos, rotina da academia, funcionamento das unidades, suporte, avisos e comunicacoes de interesse do usuario",
  "enviar informacoes sobre promocoes, novidades, eventos, conteudos, produtos e servicos da Maquina Team, quando permitido pela legislacao aplicavel",
  "cumprir obrigacoes legais, regulatorias e contratuais",
  "prevenir fraudes, tratar incidentes de seguranca, proteger sistemas e realizar controles de acesso fisico e digital",
  "utilizar imagem, voz e depoimentos em materiais institucionais e promocionais, conforme autorizacao ou base legal aplicavel",
] as const;

const sharingItems = [
  "entre areas, unidades, operadores e parceiros que atuem em nome da Maquina Team na prestacao dos servicos",
  "com fornecedores de hospedagem, autenticacao, banco de dados, mensageria, e-mail, armazenamento em nuvem, analise, monitoramento e suporte tecnico",
  "com prestadores de servicos de pagamento, cobranca, checkout, Pix e conciliacao financeira",
  "com fornecedores de marketing, comunicacao e atendimento, quando necessario para campanhas e relacionamento",
  "com autoridades administrativas, judiciais ou reguladoras, quando houver obrigacao legal ou ordem valida",
  "com terceiros envolvidos em reorganizacao societaria, fusao, incorporacao, cessao ou outra operacao empresarial, se aplicavel",
] as const;

const retentionItems = [
  "pelo tempo necessario para cumprir a finalidade que justificou a coleta",
  "pelo periodo necessario para atendimento de obrigacoes legais, fiscais, regulatorias e contratuais",
  "pelo prazo necessario para exercicio regular de direitos em processos judiciais, administrativos ou arbitrais",
] as const;

const cookieItems = [
  {
    title: "Cookies essenciais e de sessao",
    description:
      "utilizados para login, autenticacao, seguranca, navegacao, persistencia de sessao e funcionamento do carrinho, checkout e painel do usuario.",
  },
  {
    title: "Cookies funcionais e de preferencia",
    description:
      "utilizados para lembrar configuracoes, melhorar a experiencia de navegacao e manter funcionalidades disponiveis nos sistemas digitais.",
  },
  {
    title: "Cookies analiticos e de desempenho",
    description:
      "podem ser utilizados para medir uso do website, desempenho das paginas, navegacao e aperfeicoamento da experiencia, quando essas ferramentas estiverem habilitadas.",
  },
  {
    title: "Tecnologias de marketing e remarketing",
    description:
      "podem ser utilizadas em campanhas de divulgacao e comunicacao da academia, sempre de acordo com a legislacao aplicavel e com as configuracoes adotadas no ambiente.",
  },
] as const;

const rights = [
  "confirmar a existencia de tratamento de dados pessoais",
  "acessar os dados pessoais tratados pela Maquina Team",
  "corrigir dados incompletos, inexatos ou desatualizados",
  "solicitar anonimização, bloqueio ou eliminacao de dados desnecessarios, excessivos ou tratados em desconformidade com a lei",
  "solicitar portabilidade, quando aplicavel",
  "solicitar informacoes sobre compartilhamento com entidades publicas e privadas",
  "revogar consentimento, quando o tratamento estiver baseado nele",
  "solicitar a eliminacao de dados tratados com base em consentimento, observadas as hipoteses legais de retencao",
] as const;

export const metadata = buildPublicMetadata({
  title: "Politica de Privacidade",
  description:
    "Entenda como a Maquina Team trata dados pessoais, cookies e direitos dos usuarios em seus servicos digitais e presenciais.",
  path: "/politica-de-privacidade",
  keywords: [
    "politica de privacidade",
    "lgpd academia",
    "dados pessoais academia",
  ],
  type: "article",
});

function PolicyCard({
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

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <section className="rounded-[2.5rem] border border-brand-gray-mid bg-brand-gray-dark p-6 sm:p-8 lg:p-10">
        <p className="text-xs uppercase tracking-[0.34em] text-brand-gray-light">
          Documento legal
        </p>
        <h1 className="mt-4 text-4xl font-bold uppercase text-white sm:text-5xl">
          Politica de Privacidade
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-gray-light sm:text-base">
          Esta Politica de Privacidade descreve como a {BRAND.name} trata dados
          pessoais de alunos, visitantes, interessados em contratar planos,
          compradores de produtos e usuarios dos sistemas digitais da academia.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.75rem] border border-brand-gray-mid bg-brand-black/50 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-brand-gray-light">
              Controladora
            </p>
            <p className="mt-3 text-base text-white">
              {BRAND.name}, academia de luta localizada em {BRAND.address.full}.
            </p>
            <p className="mt-3 text-sm leading-7 text-brand-gray-light">
              Caso a academia utilize unidades, operadores, parceiros, franqueados ou
              sistemas terceiros para prestar servicos relacionados as suas atividades,
              o tratamento dos dados ocorrera dentro das finalidades descritas nesta
              politica e de acordo com a legislacao aplicavel.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-brand-gray-mid bg-white p-5 text-black">
            <p className="text-xs uppercase tracking-[0.24em] text-black/55">
              Ultima atualizacao
            </p>
            <p className="mt-3 text-2xl font-bold uppercase">1 de abril de 2026</p>
            <p className="mt-3 text-sm leading-7 text-black/70">
              Em caso de duvidas ou exercicio de direitos de privacidade, entre em
              contato pelo e-mail {BRAND.contact.email}.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-10 space-y-6">
        <PolicyCard title="1. Dados pessoais que podem ser coletados">
          <p>
            Dados pessoais sao informacoes fornecidas diretamente pelo usuario,
            coletadas durante atendimentos, cadastros, compras, contratacoes de
            planos, interacoes com o website ou uso dos sistemas da {BRAND.name}.
          </p>
          <ul className="space-y-2">
            {collectedData.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
        </PolicyCard>

        <PolicyCard title="2. Finalidade da utilizacao dos dados pessoais">
          <p>A {BRAND.name} utiliza os dados pessoais para:</p>
          <ul className="space-y-2">
            {purposes.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
          <p>
            O usuario pode solicitar a revisao de determinados tratamentos, mas a
            ausencia de alguns dados pode impedir a prestacao segura de servicos, o
            funcionamento de recursos digitais ou a conclusao de matriculas, compras e
            pagamentos.
          </p>
          <p>
            Dados pessoais nao sao vendidos ou alugados pela {BRAND.name}. A academia
            adota medidas tecnicas e administrativas razoaveis para proteger os dados
            tratados.
          </p>
        </PolicyCard>

        <PolicyCard title="3. Compartilhamento e transferencia internacional">
          <p>Os dados pessoais podem ser compartilhados:</p>
          <ul className="space-y-2">
            {sharingItems.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
          <p>
            Parte da infraestrutura tecnologica da academia pode envolver armazenamento
            em nuvem ou fornecedores localizados fora do Brasil. Nesses casos, a
            transferencia internacional sera realizada conforme a legislacao de
            protecao de dados aplicavel.
          </p>
        </PolicyCard>

        <PolicyCard title="4. Retencao dos dados pessoais">
          <p>A {BRAND.name} podera manter dados pessoais:</p>
          <ul className="space-y-2">
            {retentionItems.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
          <p>
            Quando o tratamento depender de consentimento, sua revogacao impedira novos
            tratamentos baseados nessa autorizacao, sem prejuizo da guarda dos dados
            nos prazos exigidos por lei ou para exercicio regular de direitos.
          </p>
        </PolicyCard>

        <PolicyCard title="5. Utilizacao de cookies e tecnologias semelhantes">
          <p>
            Cookies e tecnologias semelhantes sao utilizados para viabilizar o
            funcionamento do website, autenticacao, seguranca, continuidade da sessao
            e aperfeicoamento da experiencia digital.
          </p>
          <div className="space-y-4">
            {cookieItems.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.5rem] border border-brand-gray-mid bg-brand-black/40 p-4"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-7 text-brand-gray-light">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
          <p>
            O usuario pode gerenciar cookies no navegador, observando que a desativacao
            de determinados recursos pode afetar o funcionamento correto do site,
            login, carrinho, checkout e outras areas do sistema.
          </p>
        </PolicyCard>

        <PolicyCard title="6. Direitos dos usuarios">
          <p>Nos termos da legislacao aplicavel, o usuario pode solicitar:</p>
          <ul className="space-y-2">
            {rights.map((item) => (
              <li key={item}>- {item};</li>
            ))}
          </ul>
          <p>
            Para exercer esses direitos, a solicitacao pode ser enviada para{" "}
            <a
              href={`mailto:${BRAND.contact.email}`}
              className="text-white underline underline-offset-4"
            >
              {BRAND.contact.email}
            </a>
            .
          </p>
        </PolicyCard>

        <PolicyCard title="7. Contato">
          <p>
            Em caso de duvidas, comentarios ou reclamacoes sobre esta Politica de
            Privacidade ou sobre o tratamento de dados pessoais pela {BRAND.name}, o
            usuario pode entrar em contato pelos canais abaixo:
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-brand-gray-mid bg-brand-black/40 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-brand-gray-light">
                E-mail
              </p>
              <p className="mt-2 text-lg font-bold text-white">{BRAND.contact.email}</p>
            </div>
            <div className="rounded-[1.5rem] border border-brand-gray-mid bg-brand-black/40 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-brand-gray-light">
                WhatsApp
              </p>
              <p className="mt-2 text-lg font-bold text-white">{BRAND.contact.phone}</p>
            </div>
          </div>
        </PolicyCard>

        <PolicyCard title="8. Atualizacoes desta politica">
          <p>
            A {BRAND.name} pode revisar e alterar esta Politica de Privacidade a
            qualquer momento, sempre que entender necessario para refletir mudancas
            operacionais, legais, contratuais ou tecnologicas.
          </p>
          <p>
            As versoes atualizadas serao publicadas neste website. Recomendamos que o
            usuario consulte esta pagina periodicamente.
          </p>
        </PolicyCard>
      </div>

      <section className="mt-10 rounded-[2.5rem] border border-brand-gray-mid bg-white px-6 py-10 text-black shadow-[0_20px_80px_rgba(255,255,255,0.06)] sm:px-10">
        <p className="text-xs uppercase tracking-[0.32em] text-black/55">
          Precisa falar com a academia?
        </p>
        <h2 className="mt-4 text-4xl font-bold uppercase leading-none sm:text-5xl">
          Atendimento rapido e direto
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-black/70 sm:text-base">
          Se voce quiser tratar de privacidade, cadastro, planos, produtos, pedidos ou
          dados pessoais, a equipe da {BRAND.name} atende pelos canais oficiais da
          academia.
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
