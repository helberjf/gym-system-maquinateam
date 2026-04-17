import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const baseDay = startOfDay(new Date());

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, amount: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function addMonths(date: Date, amount: number): Date {
  const value = new Date(date);
  value.setMonth(value.getMonth() + amount);
  return value;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type SaleItemInput = {
  productId: string;
  quantity: number;
  unitPriceCents: number;
};

async function createPaidProductSale(input: {
  saleNumber: string;
  soldByUserId: string;
  paymentMethod: "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "CASH" | "BANK_TRANSFER" | "BOLETO";
  studentProfileId?: string;
  customerName?: string;
  customerDocument?: string;
  discountCents?: number;
  notes?: string;
  soldAt?: Date;
  items: SaleItemInput[];
}) {
  return prisma.$transaction(async (tx) => {
    let subtotalCents = 0;

    for (const item of input.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, stockQuantity: true, trackInventory: true },
      });

      if (!product) {
        throw new Error(`Produto não encontrado para a venda ${input.saleNumber}.`);
      }

      if (product.trackInventory && product.stockQuantity < item.quantity) {
        throw new Error(`Estoque insuficiente para a venda ${input.saleNumber}.`);
      }

      subtotalCents += item.quantity * item.unitPriceCents;
    }

    const discountCents = input.discountCents ?? 0;
    const totalCents = subtotalCents - discountCents;

    const sale = await tx.productSale.create({
      data: {
        saleNumber: input.saleNumber,
        soldByUserId: input.soldByUserId,
        paymentMethod: input.paymentMethod,
        studentProfileId: input.studentProfileId,
        customerName: input.customerName,
        customerDocument: input.customerDocument,
        status: "PAID",
        subtotalCents,
        discountCents,
        totalCents,
        notes: input.notes,
        soldAt: input.soldAt ?? new Date(),
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.quantity * item.unitPriceCents,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    for (const item of input.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stockQuantity: true, trackInventory: true },
      });

      if (!product?.trackInventory) {
        continue;
      }

      const remainingStock = product.stockQuantity - item.quantity;
      const productUpdate: Prisma.ProductUpdateInput = {
        stockQuantity: {
          decrement: item.quantity,
        },
      };

      if (remainingStock <= 0) {
        productUpdate.status = "OUT_OF_STOCK";
      }

      await tx.product.update({
        where: { id: item.productId },
        data: productUpdate,
      });
    }

    return sale;
  });
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123";
  const defaultStaffPassword = process.env.SEED_STAFF_PASSWORD ?? "Equipe@123";
  const defaultStudentPassword = process.env.SEED_STUDENT_PASSWORD ?? "Aluno@123";

  const [adminHash, staffHash, studentHash] = await Promise.all([
    bcrypt.hash(adminPassword, 10),
    bcrypt.hash(defaultStaffPassword, 10),
    bcrypt.hash(defaultStudentPassword, 10),
  ]);

  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.trainingAssignment.deleteMany(),
    prisma.trainingTemplate.deleteMany(),
    prisma.wishlistItem.deleteMany(),
    prisma.wishlist.deleteMany(),
    prisma.inventoryMovement.deleteMany(),
    prisma.orderStatusHistory.deleteMany(),
    prisma.couponRedemption.deleteMany(),
    prisma.order.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.shippingAddress.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.classEnrollment.deleteMany(),
    prisma.classSchedule.deleteMany(),
    prisma.productSaleItem.deleteMany(),
    prisma.productSale.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.product.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.studentProfile.deleteMany(),
    prisma.teacherProfile.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.modality.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const adminUser = await prisma.user.create({
    data: {
      name: "Administrador Maquina Team",
      email: "maquinateam.adm@gmail.com",
      passwordHash: adminHash,
      emailVerified: new Date(),
      role: "ADMIN",
      phone: "(32) 99150-7900",
    },
  });

  const receptionUser = await prisma.user.create({
    data: {
      name: "Juliana Recepção",
      email: "recepcao@maquinateam.com.br",
      passwordHash: staffHash,
      emailVerified: new Date(),
      role: "RECEPCAO",
      phone: "(32) 99150-7901",
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      name: "Ricardo Alves",
      email: "ricardo.alves@maquinateam.com.br",
      passwordHash: staffHash,
      emailVerified: new Date(),
      role: "PROFESSOR",
      phone: "(32) 99150-7902",
      teacherProfile: {
        create: {
          registrationNumber: "PROF-001",
          cpf: "12345678901",
          bio: "Professor de trocação com foco em boxe, kickboxing e condicionamento para atletas amadores.",
          specialties: "Boxe, Muay Thai, Kickboxing, preparação funcional",
          experienceYears: 11,
          hireDate: new Date("2024-01-10T00:00:00.000Z"),
          hourlyRateCents: 8500,
          beltLevel: "Graduado",
          notes: "Responsavel tecnico pela grade noturna e por alunos em evolucao competitiva.",
        },
      },
    },
    include: {
      teacherProfile: true,
    },
  });

  const aliceUser = await prisma.user.create({
    data: {
      name: "Alice Nogueira",
      email: "alice.nogueira@maquinateam.com.br",
      passwordHash: studentHash,
      emailVerified: new Date(),
      role: "ALUNO",
      phone: "(32) 99150-7910",
      studentProfile: {
        create: {
          registrationNumber: "ALU-001",
          status: "ACTIVE",
          birthDate: new Date("2000-03-15T00:00:00.000Z"),
          cpf: "11111111111",
          addressLine: "Rua Fonseca Hermes, 45",
          city: "Juiz de Fora",
          state: "MG",
          zipCode: "36015000",
          emergencyContactName: "Mariana Nogueira",
          emergencyContactPhone: "(32) 99150-7990",
          medicalNotes: "Sem restrições médicas registradas.",
          goals: "Melhorar base de boxe, condicionamento e postura de combate.",
          joinedAt: addMonths(baseDay, -5),
          beltLevel: "Iniciante",
          weightKg: 63.4,
          heightCm: 167,
        },
      },
    },
    include: {
      studentProfile: true,
    },
  });

  const brunoUser = await prisma.user.create({
    data: {
      name: "Bruno Tavares",
      email: "bruno.tavares@maquinateam.com.br",
      passwordHash: studentHash,
      emailVerified: new Date(),
      role: "ALUNO",
      phone: "(32) 99150-7911",
      studentProfile: {
        create: {
          registrationNumber: "ALU-002",
          status: "ACTIVE",
          birthDate: new Date("1998-11-22T00:00:00.000Z"),
          cpf: "22222222222",
          addressLine: "Av. Barão do Rio Branco, 1200",
          city: "Juiz de Fora",
          state: "MG",
          zipCode: "36013010",
          emergencyContactName: "Paulo Tavares",
          emergencyContactPhone: "(32) 99150-7991",
          medicalNotes: "Monitorar lombar em sessões de alto volume.",
          goals: "Evoluir no Muay Thai e ganhar resistência para rounds longos.",
          joinedAt: addMonths(baseDay, -3),
          beltLevel: "Intermediário",
          weightKg: 78.2,
          heightCm: 182,
        },
      },
    },
    include: {
      studentProfile: true,
    },
  });

  const camilaUser = await prisma.user.create({
    data: {
      name: "Camila Rocha",
      email: "camila.rocha@maquinateam.com.br",
      passwordHash: studentHash,
      emailVerified: new Date(),
      role: "ALUNO",
      phone: "(32) 99150-7912",
      studentProfile: {
        create: {
          registrationNumber: "ALU-003",
          status: "TRIAL",
          birthDate: new Date("2003-07-05T00:00:00.000Z"),
          cpf: "33333333333",
          addressLine: "Rua Halfeld, 220",
          city: "Juiz de Fora",
          state: "MG",
          zipCode: "36010001",
          emergencyContactName: "Luciana Rocha",
          emergencyContactPhone: "(32) 99150-7992",
          medicalNotes: "Iniciando adaptação cardiorrespiratória.",
          goals: "Entrar em rotina, melhorar condicionamento e aprender kickboxing.",
          joinedAt: addMonths(baseDay, -1),
          beltLevel: "Sem graduação",
          weightKg: 58.1,
          heightCm: 164,
        },
      },
    },
    include: {
      studentProfile: true,
    },
  });

  const modalities = await Promise.all([
    prisma.modality.create({
      data: {
        name: "Boxe",
        slug: "boxe",
        description: "Aulas focadas em técnica de mãos, esquivas, guarda e ritmo de combate.",
        colorHex: "#B02E2E",
        sortOrder: 1,
      },
    }),
    prisma.modality.create({
      data: {
        name: "Muay Thai",
        slug: "muay-thai",
        description: "Turmas com ênfase em trocação completa, joelhadas, cotoveladas e clinch.",
        colorHex: "#C96A19",
        sortOrder: 2,
      },
    }),
    prisma.modality.create({
      data: {
        name: "Kickboxing",
        slug: "kickboxing",
        description: "Treinamento híbrido com foco em combinações, defesa e deslocamento explosivo.",
        colorHex: "#1E5FAF",
        sortOrder: 3,
      },
    }),
    prisma.modality.create({
      data: {
        name: "Funcional",
        slug: "funcional",
        description: "Condicionamento físico aplicado à luta com circuitos de força e resistência.",
        colorHex: "#268451",
        sortOrder: 4,
      },
    }),
  ]);

  const modalityMap = Object.fromEntries(modalities.map((modality) => [modality.slug, modality]));

  await Promise.all([
    prisma.studentProfile.update({
      where: { id: aliceUser.studentProfile!.id },
      data: {
        primaryModalityId: modalityMap["boxe"].id,
        responsibleTeacherId: teacherUser.teacherProfile!.id,
        notes: "Aluna com boa disciplina de rotina e foco em fundamentos tecnicos.",
      },
    }),
    prisma.studentProfile.update({
      where: { id: brunoUser.studentProfile!.id },
      data: {
        primaryModalityId: modalityMap["muay-thai"].id,
        responsibleTeacherId: teacherUser.teacherProfile!.id,
        notes: "Aluno experiente, acompanha turma avancada e treino complementar.",
      },
    }),
    prisma.studentProfile.update({
      where: { id: camilaUser.studentProfile!.id },
      data: {
        primaryModalityId: modalityMap["kickboxing"].id,
        responsibleTeacherId: teacherUser.teacherProfile!.id,
        notes: "Perfil em fase de adaptacao ao volume de treinos semanais.",
      },
    }),
  ]);

  await prisma.teacherProfile.update({
    where: { id: teacherUser.teacherProfile!.id },
    data: {
      modalities: {
        connect: modalities.map((modality) => ({ id: modality.id })),
      },
    },
  });

  const classSchedules = await Promise.all([
    prisma.classSchedule.create({
      data: {
        modalityId: modalityMap["boxe"].id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        title: "Boxe Adulto - Segunda",
        description: "Turma técnica para iniciantes e intermediários com foco em fundamentos.",
        dayOfWeek: 1,
        daysOfWeek: [1],
        startTime: "19:00",
        endTime: "20:00",
        room: "Tatame 1",
        capacity: 20,
      },
    }),
    prisma.classSchedule.create({
      data: {
        modalityId: modalityMap["muay-thai"].id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        title: "Muay Thai Noite - Terça",
        description: "Aula com rounds de técnica, aparador e condicionamento específico.",
        dayOfWeek: 2,
        daysOfWeek: [2],
        startTime: "20:00",
        endTime: "21:10",
        room: "Tatame 2",
        capacity: 22,
      },
    }),
    prisma.classSchedule.create({
      data: {
        modalityId: modalityMap["kickboxing"].id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        title: "Kickboxing Intermediário - Quinta",
        description: "Turma de combinações, defesa ativa e trabalho de distância.",
        dayOfWeek: 4,
        daysOfWeek: [4],
        startTime: "19:30",
        endTime: "20:40",
        room: "Tatame 1",
        capacity: 18,
      },
    }),
    prisma.classSchedule.create({
      data: {
        modalityId: modalityMap["funcional"].id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        title: "Funcional Fighter - Sábado",
        description: "Circuito de força, cardio e resistência para atletas de luta.",
        dayOfWeek: 6,
        daysOfWeek: [6],
        startTime: "09:00",
        endTime: "10:00",
        room: "Sala Funcional",
        capacity: 25,
      },
    }),
  ]);

  const classScheduleMap = Object.fromEntries(classSchedules.map((schedule) => [schedule.title, schedule]));

  await Promise.all([
    prisma.classEnrollment.create({
      data: {
        studentProfileId: aliceUser.studentProfile!.id,
        classScheduleId: classScheduleMap["Boxe Adulto - Segunda"].id,
        modalityId: modalityMap["boxe"].id,
        startsAt: addMonths(baseDay, -5),
        createdByUserId: receptionUser.id,
        notes: "Aluno com boa frequência e foco em técnica de base.",
      },
    }),
    prisma.classEnrollment.create({
      data: {
        studentProfileId: aliceUser.studentProfile!.id,
        classScheduleId: classScheduleMap["Funcional Fighter - Sábado"].id,
        modalityId: modalityMap["funcional"].id,
        startsAt: addMonths(baseDay, -4),
        createdByUserId: receptionUser.id,
      },
    }),
    prisma.classEnrollment.create({
      data: {
        studentProfileId: brunoUser.studentProfile!.id,
        classScheduleId: classScheduleMap["Muay Thai Noite - Terça"].id,
        modalityId: modalityMap["muay-thai"].id,
        startsAt: addMonths(baseDay, -3),
        createdByUserId: receptionUser.id,
        notes: "Aluno liberado para aumentar volume de rounds em abril.",
      },
    }),
    prisma.classEnrollment.create({
      data: {
        studentProfileId: camilaUser.studentProfile!.id,
        classScheduleId: classScheduleMap["Kickboxing Intermediário - Quinta"].id,
        modalityId: modalityMap["kickboxing"].id,
        startsAt: addMonths(baseDay, -1),
        createdByUserId: receptionUser.id,
        notes: "Matrícula de experiência com possibilidade de conversão em plano trimestral.",
      },
    }),
  ]);

  const plans = await Promise.all([
    prisma.plan.create({
      data: {
        name: "Mensal 1x na Semana",
        slug: "mensal-1x-na-semana",
        description: "Plano mensal para manter constancia com uma aula por semana.",
        benefits: [
          "1 treino por semana",
          "Acesso ao app do aluno",
          "Acompanhamento basico da equipe",
        ],
        modalityId: null,
        priceCents: 12900,
        billingIntervalMonths: 1,
        durationMonths: 1,
        sessionsPerWeek: 1,
      },
    }),
    prisma.plan.create({
      data: {
        name: "Mensal 2x na Semana",
        slug: "mensal-2x-na-semana",
        description: "Plano mensal para evoluir tecnica e condicionamento com duas aulas por semana.",
        benefits: [
          "2 treinos por semana",
          "App com historico e pagamentos",
          "Rotina forte de evolucao",
        ],
        modalityId: null,
        priceCents: 15900,
        billingIntervalMonths: 1,
        durationMonths: 1,
        sessionsPerWeek: 2,
      },
    }),
    prisma.plan.create({
      data: {
        name: "Mensal 3x na Semana",
        slug: "mensal-3x-na-semana",
        description: "Plano mensal para acelerar a evolucao com tres aulas por semana.",
        benefits: [
          "3 treinos por semana",
          "Melhor custo-beneficio do mensal",
          "Mais intensidade na rotina",
        ],
        modalityId: null,
        priceCents: 17900,
        billingIntervalMonths: 1,
        durationMonths: 1,
        sessionsPerWeek: 3,
      },
    }),
    prisma.plan.create({
      data: {
        name: "Semestral 1x na Semana",
        slug: "semestral-1x-na-semana",
        description: "Plano de 6 meses para manter constancia com economia mensal.",
        benefits: [
          "1 treino por semana",
          "Total de R$ 714,00 no periodo",
          "Melhor valor que o mensal",
        ],
        modalityId: null,
        priceCents: 71400,
        billingIntervalMonths: 6,
        durationMonths: 6,
        sessionsPerWeek: 1,
      },
    }),
    prisma.plan.create({
      data: {
        name: "Semestral 2x na Semana",
        slug: "semestral-2x-na-semana",
        description: "Plano de 6 meses para manter ritmo forte e previsibilidade.",
        benefits: [
          "2 treinos por semana",
          "Total de R$ 858,00 no periodo",
          "Compromisso de medio prazo",
        ],
        modalityId: null,
        priceCents: 85800,
        billingIntervalMonths: 6,
        durationMonths: 6,
        sessionsPerWeek: 2,
      },
    }),
    prisma.plan.create({
      data: {
        name: "Semestral 3x na Semana",
        slug: "semestral-3x-na-semana",
        description: "Plano de 6 meses para quem quer treinar serio e colher resultado.",
        benefits: [
          "3 treinos por semana",
          "Total de R$ 978,00 no periodo",
          "Ritmo forte de evolucao",
        ],
        modalityId: null,
        priceCents: 97800,
        billingIntervalMonths: 6,
        durationMonths: 6,
        sessionsPerWeek: 3,
      },
    }),
    prisma.plan.create({
      data: {
        name: "Anual 1x na Semana",
        slug: "anual-1x-na-semana",
        description: "Plano anual com a menor mensalidade da grade para manter constancia.",
        benefits: [
          "1 treino por semana",
          "Total de R$ 1.308,00 no periodo",
          "Maior economia no longo prazo",
        ],
        modalityId: null,
        priceCents: 130800,
        billingIntervalMonths: 12,
        durationMonths: 12,
        sessionsPerWeek: 1,
      },
    }),
    prisma.plan.create({
      data: {
        name: "Anual 2x na Semana",
        slug: "anual-2x-na-semana",
        description: "Plano anual equilibrado para tecnica, cardio e consistencia.",
        benefits: [
          "2 treinos por semana",
          "Total de R$ 1.428,00 no periodo",
          "Valor mensal mais competitivo",
        ],
        modalityId: null,
        priceCents: 142800,
        billingIntervalMonths: 12,
        durationMonths: 12,
        sessionsPerWeek: 2,
      },
    }),
    prisma.plan.create({
      data: {
        name: "Anual 3x na Semana",
        slug: "anual-3x-na-semana",
        description: "Plano anual premium para acelerar evolucao com a melhor relacao custo-frequencia.",
        benefits: [
          "3 treinos por semana",
          "Total de R$ 1.788,00 no periodo",
          "Plano premium da grade publica",
        ],
        modalityId: null,
        priceCents: 178800,
        billingIntervalMonths: 12,
        durationMonths: 12,
        sessionsPerWeek: 3,
      },
    }),
    prisma.plan.create({
      data: {
        name: "Plano Full",
        slug: "plano-full",
        description: "Qualquer dia e qualquer horario para quem quer viver a rotina completa da academia.",
        benefits: [
          "Treinos ilimitados",
          "Qualquer dia e qualquer horario",
          "Acesso completo a uma arte marcial",
        ],
        modalityId: null,
        priceCents: 25000,
        billingIntervalMonths: 1,
        durationMonths: 1,
        isUnlimited: true,
      },
    }),
    prisma.plan.create({
      data: {
        name: "Plano Full Desconto Social",
        slug: "plano-full-desconto-social",
        description: "Siga nossos perfis, avalie a academia e consulte a equipe antes de contratar essa condicao especial.",
        benefits: [
          "Treinos ilimitados",
          "Condicao social especial",
          "Consulte a equipe antes de contratar",
        ],
        modalityId: null,
        priceCents: 18500,
        billingIntervalMonths: 1,
        durationMonths: 1,
        isUnlimited: true,
      },
    }),
  ]);

  const planMap = Object.fromEntries(plans.map((plan) => [plan.slug, plan]));

  const subscriptions = await Promise.all([
    prisma.subscription.create({
      data: {
        studentProfileId: aliceUser.studentProfile!.id,
        planId: planMap["mensal-3x-na-semana"].id,
        status: "ACTIVE",
        startDate: addMonths(baseDay, -1),
        endDate: addDays(baseDay, 5),
        renewalDay: 5,
        autoRenew: true,
        priceCents: 17900,
        createdByUserId: receptionUser.id,
        notes: "Assinatura mensal mais escolhida renovada via PIX.",
      },
    }),
    prisma.subscription.create({
      data: {
        studentProfileId: brunoUser.studentProfile!.id,
        planId: planMap["semestral-2x-na-semana"].id,
        status: "ACTIVE",
        startDate: addMonths(baseDay, -1),
        endDate: addMonths(baseDay, 5),
        renewalDay: null,
        autoRenew: false,
        priceCents: 85800,
        createdByUserId: receptionUser.id,
      },
    }),
    prisma.subscription.create({
      data: {
        studentProfileId: camilaUser.studentProfile!.id,
        planId: planMap["plano-full-desconto-social"].id,
        status: "PAST_DUE",
        startDate: addMonths(baseDay, -1),
        endDate: baseDay,
        autoRenew: false,
        priceCents: 18500,
        discountCents: 0,
        createdByUserId: receptionUser.id,
        notes: "Plano convertido do período trial e aguardando regularização.",
      },
    }),
  ]);

  const subscriptionMap = Object.fromEntries(
    subscriptions.map((subscription) => [subscription.studentProfileId, subscription]),
  );

  await Promise.all([
    prisma.payment.create({
      data: {
        studentProfileId: aliceUser.studentProfile!.id,
        subscriptionId: subscriptionMap[aliceUser.studentProfile!.id].id,
        amountCents: 17900,
        status: "PAID",
        method: "PIX",
        dueDate: addMonths(baseDay, -1),
        paidAt: addDays(baseDay, -24),
        externalReference: "SUB-ALICE-2026-03",
        gatewayTransactionId: "MP-ALICE-202603",
        description: "Mensalidade Mensal 3x na Semana",
        createdByUserId: receptionUser.id,
        processedByUserId: receptionUser.id,
      },
    }),
    prisma.payment.create({
      data: {
        studentProfileId: aliceUser.studentProfile!.id,
        subscriptionId: subscriptionMap[aliceUser.studentProfile!.id].id,
        amountCents: 17900,
        status: "PENDING",
        method: "PIX",
        dueDate: addDays(baseDay, 5),
        externalReference: "SUB-ALICE-2026-04",
        description: "Próxima mensalidade Boxe 2x por semana",
        createdByUserId: receptionUser.id,
      },
    }),
    prisma.payment.create({
      data: {
        studentProfileId: brunoUser.studentProfile!.id,
        subscriptionId: subscriptionMap[brunoUser.studentProfile!.id].id,
        amountCents: 85800,
        status: "PAID",
        method: "CREDIT_CARD",
        dueDate: addMonths(baseDay, -1),
        paidAt: addDays(baseDay, -18),
        externalReference: "SUB-BRUNO-2026-03",
        gatewayTransactionId: "MP-BRUNO-202603",
        description: "Plano Semestral 2x na Semana",
        createdByUserId: receptionUser.id,
        processedByUserId: adminUser.id,
      },
    }),
    prisma.payment.create({
      data: {
        studentProfileId: camilaUser.studentProfile!.id,
        subscriptionId: subscriptionMap[camilaUser.studentProfile!.id].id,
        amountCents: 18500,
        status: "PENDING",
        method: "PIX",
        dueDate: addDays(baseDay, -3),
        externalReference: "SUB-CAMILA-2026-04",
        description: "Plano Full Desconto Social",
        notes: "Boleto venceu sem compensação bancária.",
        createdByUserId: receptionUser.id,
      },
    }),
  ]);

  const trainingTemplates = await Promise.all([
    prisma.trainingTemplate.create({
      data: {
        name: "Boxe Iniciante",
        slug: slugify("Boxe Iniciante"),
        modalityId: modalityMap["boxe"].id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        level: "Iniciante",
        description: "Treino introdutório para postura, deslocamento, jab e cruzado.",
        objective: "Criar base técnica, ritmo e consciência de guarda.",
        durationMinutes: 60,
        content: {
          aquecimento: ["3 rounds de corda de 2 minutos", "mobilidade de ombro e quadril"],
          tecnica: ["guarda base", "jab no alvo", "jab + cruzado com retorno"],
          condicionamento: ["3 rounds de saco de 2 minutos", "3 séries de prancha de 40 segundos"],
          desaquecimento: ["respiração nasal", "alongamento de peitoral e panturrilha"],
        },
      },
    }),
    prisma.trainingTemplate.create({
      data: {
        name: "Boxe Intermediário",
        slug: slugify("Boxe Intermediário"),
        modalityId: modalityMap["boxe"].id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        level: "Intermediário",
        description: "Treino com entradas, saídas laterais, defesa e contragolpe.",
        objective: "Melhorar leitura de distância e volume técnico por round.",
        durationMinutes: 70,
        content: {
          aquecimento: ["shadowboxing 3x3", "escada de agilidade"],
          tecnica: ["jab + cruzado + slip", "duplo jab + direto no corpo", "saída lateral após combinação"],
          condicionamento: ["4 rounds de manopla de 3 minutos", "abdominal com medicine ball 4x20"],
          desaquecimento: ["alongamento de lombar e dorsal"],
        },
      },
    }),
    prisma.trainingTemplate.create({
      data: {
        name: "Muay Thai Iniciante",
        slug: slugify("Muay Thai Iniciante"),
        modalityId: modalityMap["muay-thai"].id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        level: "Iniciante",
        description: "Treino inicial com base, teep, joelhada simples e chutes médios.",
        objective: "Construir coordenação e equilíbrio nos golpes básicos.",
        durationMinutes: 70,
        content: {
          aquecimento: ["corrida leve 8 minutos", "mobilidade de quadril e tornozelo"],
          tecnica: ["base de Muay Thai", "teep frontal", "joelhada reta", "chute médio com retorno"],
          condicionamento: ["3 rounds de aparador", "circuito com burpee e joelhada no saco"],
          desaquecimento: ["alongamento de adutores e quadríceps"],
        },
      },
    }),
    prisma.trainingTemplate.create({
      data: {
        name: "Kickboxing Intermediário",
        slug: slugify("Kickboxing Intermediário"),
        modalityId: modalityMap["kickboxing"].id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        level: "Intermediário",
        description: "Treino voltado para combinações mistas e entradas explosivas.",
        objective: "Ganhar velocidade de transição entre golpes de mão e perna.",
        durationMinutes: 75,
        content: {
          aquecimento: ["shadowboxing com elástico 3x2", "deslocamento com cones"],
          tecnica: ["jab + direto + low kick", "cruzado + gancho + chute alto", "contra-ataque com passo lateral"],
          condicionamento: ["rounds intervalados no saco 5x3", "air bike 6 tiros de 30 segundos"],
          desaquecimento: ["respiração guiada e mobilidade de quadril"],
        },
      },
    }),
    prisma.trainingTemplate.create({
      data: {
        name: "Funcional de Condicionamento para Luta",
        slug: slugify("Funcional de Condicionamento para Luta"),
        modalityId: modalityMap["funcional"].id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        level: "Todos os níveis",
        description: "Circuito metabólico para explosão, resistência e recuperação entre rounds.",
        objective: "Desenvolver potência e fôlego aplicados à trocação.",
        durationMinutes: 50,
        content: {
          aquecimento: ["remo ergométrico 5 minutos", "mobilidade global dinâmica"],
          circuito: [
            "battle rope 40 segundos",
            "agachamento com salto 15 repetições",
            "sled push 20 metros",
            "medicine ball slam 20 repetições",
          ],
          finalizacao: ["farmer walk 3 voltas", "core anti-rotação 3x12"],
          desaquecimento: ["alongamento ativo de membros inferiores"],
        },
      },
    }),
  ]);

  const trainingTemplateMap = Object.fromEntries(
    trainingTemplates.map((template) => [template.slug, template]),
  );

  await Promise.all([
    prisma.trainingAssignment.create({
      data: {
        studentProfileId: aliceUser.studentProfile!.id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        trainingTemplateId: trainingTemplateMap[slugify("Boxe Iniciante")].id,
        status: "IN_PROGRESS",
        title: "Microciclo técnico de Boxe - Alice",
        instructions: "Executar 2 vezes na semana e registrar percepção de fadiga após os rounds.",
        content: {
          focoDaSemana: "Jab, cruzado e base estável",
          roundsExtras: ["2 rounds de shadowboxing com espelho", "2 rounds de saco leve focando precisão"],
        },
        assignedAt: addDays(baseDay, -7),
        startAt: addDays(baseDay, -7),
        dueAt: addDays(baseDay, 7),
      },
    }),
    prisma.trainingAssignment.create({
      data: {
        studentProfileId: brunoUser.studentProfile!.id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        trainingTemplateId: trainingTemplateMap[slugify("Muay Thai Iniciante")].id,
        status: "COMPLETED",
        title: "Base e volume de Muay Thai - Bruno",
        instructions: "Treino complementar de técnica antes das turmas de terça e quinta.",
        content: {
          observacaoProfessor: "Reduzir impacto em dias de lombar sensível.",
        },
        assignedAt: addDays(baseDay, -20),
        startAt: addDays(baseDay, -19),
        dueAt: addDays(baseDay, -5),
        completedAt: addDays(baseDay, -6),
        feedback: "Boa evolução em teep e ritmo de guarda. Próximo passo é lapidar clinch.",
      },
    }),
    prisma.trainingAssignment.create({
      data: {
        studentProfileId: camilaUser.studentProfile!.id,
        teacherProfileId: teacherUser.teacherProfile!.id,
        trainingTemplateId: trainingTemplateMap[slugify("Funcional de Condicionamento para Luta")].id,
        status: "ASSIGNED",
        title: "Adaptação cardiorrespiratória - Camila",
        instructions: "Executar o circuito em intensidade moderada e pausar se perder técnica.",
        content: {
          meta: "Completar 3 voltas do circuito sem quebra técnica.",
        },
        assignedAt: addDays(baseDay, -2),
        dueAt: addDays(baseDay, 10),
      },
    }),
  ]);

  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Luva de Boxe Maquina Team 12oz",
        slug: "luva-boxe-maquina-team-12oz",
        sku: "MT-LUVA-12OZ",
        category: "Luvas e protecao",
        shortDescription: "Luva premium para manopla, saco e sparring leve.",
        description: "Luva para treino técnico e sparring leve com fechamento em velcro.",
        status: "ACTIVE",
        priceCents: 19900,
        stockQuantity: 12,
        lowStockThreshold: 3,
        featured: true,
        weightGrams: 620,
        heightCm: 16,
        widthCm: 22,
        lengthCm: 34,
      },
    }),
    prisma.product.create({
      data: {
        name: "Bandagem Elástica Profissional 4m",
        slug: "bandagem-elastica-profissional-4m",
        sku: "MT-BAND-4M",
        category: "Acessorios",
        shortDescription: "Bandagem essencial para protecao de punhos e encaixe da luva.",
        description: "Bandagem elástica para proteção de punhos e metacarpos.",
        status: "ACTIVE",
        priceCents: 3900,
        stockQuantity: 40,
        featured: true,
        weightGrams: 110,
        heightCm: 6,
        widthCm: 10,
        lengthCm: 14,
      },
    }),
    prisma.product.create({
      data: {
        name: "Caneleira Muay Thai Pro",
        slug: "caneleira-muay-thai-pro",
        sku: "MT-CAN-001",
        category: "Protecao",
        shortDescription: "Caneleira de alto impacto para treino tecnico e rounds de clinch.",
        description: "Caneleira de treino com espuma de alta densidade para absorção de impacto.",
        status: "ACTIVE",
        priceCents: 24900,
        stockQuantity: 8,
        weightGrams: 950,
        heightCm: 18,
        widthCm: 20,
        lengthCm: 38,
      },
    }),
    prisma.product.create({
      data: {
        name: "Camiseta Dry Fit Maquina Team",
        slug: "camiseta-dry-fit-maquina-team",
        sku: "MT-CAM-DRY",
        category: "Vestuario",
        shortDescription: "Camiseta oficial da academia com secagem rapida e visual clean.",
        description: "Camiseta oficial para treinos com tecido leve e secagem rápida.",
        status: "ACTIVE",
        priceCents: 7900,
        stockQuantity: 25,
        featured: true,
        weightGrams: 210,
        heightCm: 3,
        widthCm: 28,
        lengthCm: 32,
      },
    }),
    prisma.product.create({
      data: {
        name: "Short Muay Thai Maquina Team",
        slug: "short-muay-thai-maquina-team",
        sku: "MT-SHORT-MT",
        category: "Vestuario",
        shortDescription: "Short oficial para treino tecnico, sparring e aulas intensas.",
        description: "Short leve com recorte lateral para mobilidade em joelhadas, chutes e deslocamentos rapidos.",
        status: "ACTIVE",
        priceCents: 11900,
        stockQuantity: 18,
        featured: true,
        weightGrams: 180,
        heightCm: 3,
        widthCm: 24,
        lengthCm: 28,
      },
    }),
    prisma.product.create({
      data: {
        name: "Protetor Bucal Premium",
        slug: "protetor-bucal-premium",
        sku: "MT-BUCAL-PRM",
        category: "Protecao",
        shortDescription: "Protecao firme para sparring e treino de contato com encaixe confortavel.",
        description: "Protetor bucal de dupla densidade com estojo, pronto para rounds tecnicos e sparring.",
        status: "ACTIVE",
        priceCents: 5900,
        stockQuantity: 30,
        weightGrams: 90,
        heightCm: 4,
        widthCm: 9,
        lengthCm: 12,
      },
    }),
    prisma.product.create({
      data: {
        name: "Corda Speed Pro",
        slug: "corda-speed-pro",
        sku: "MT-CORDA-SPD",
        category: "Acessorios",
        shortDescription: "Corda ajustavel para aquecimento, cardio e condicionamento de luta.",
        description: "Corda de velocidade com cabo leve e giro rapido para rounds de aquecimento e explosao.",
        status: "ACTIVE",
        priceCents: 4900,
        stockQuantity: 22,
        featured: true,
        weightGrams: 140,
        heightCm: 5,
        widthCm: 14,
        lengthCm: 18,
      },
    }),
    prisma.product.create({
      data: {
        name: "Squeeze Aluminio Maquina Team",
        slug: "squeeze-aluminio-maquina-team",
        sku: "MT-SQZ-ALU",
        category: "Hidratacao",
        shortDescription: "Squeeze oficial da academia para treino, aula e rotina diaria.",
        description: "Garrafa squeeze em aluminio com tampa rosqueavel, leve e resistente para treinos e deslocamento.",
        status: "ACTIVE",
        priceCents: 6900,
        stockQuantity: 16,
        weightGrams: 210,
        heightCm: 7,
        widthCm: 7,
        lengthCm: 24,
      },
    }),
    prisma.product.create({
      data: {
        name: "Camiseta Casual Maquina Team",
        slug: "camiseta-casual-maquina-team",
        sku: "MT-CAM-CAS",
        category: "Vestuario",
        shortDescription: "Camiseta casual preta para uso fora do treino com identidade da academia.",
        description: "Camiseta casual em algodao premium para quem quer vestir a marca da academia no dia a dia.",
        status: "ACTIVE",
        priceCents: 8900,
        stockQuantity: 14,
        weightGrams: 230,
        heightCm: 3,
        widthCm: 28,
        lengthCm: 32,
      },
    }),
  ]);

  const productMap = Object.fromEntries(products.map((product) => [product.slug, product]));

  await prisma.productImage.createMany({
    data: [
      {
        productId: productMap["luva-boxe-maquina-team-12oz"].id,
        url: "/images/instrutor.jpg",
        altText: "Luva de boxe Maquina Team",
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: productMap["luva-boxe-maquina-team-12oz"].id,
        url: "/images/mulher_lutando.jpg",
        altText: "Treino com luvas Maquina Team",
        sortOrder: 1,
      },
      {
        productId: productMap["bandagem-elastica-profissional-4m"].id,
        url: "/images/mulher_lutando.jpg",
        altText: "Bandagem elástica para treino",
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: productMap["caneleira-muay-thai-pro"].id,
        url: "/images/interior.webp",
        altText: "Caneleira para Muay Thai",
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: productMap["camiseta-dry-fit-maquina-team"].id,
        url: "/images/logo.jpg",
        altText: "Camiseta oficial Maquina Team",
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: productMap["camiseta-dry-fit-maquina-team"].id,
        url: "/images/fachada.webp",
        altText: "Marca Maquina Team",
        sortOrder: 1,
      },
      {
        productId: productMap["short-muay-thai-maquina-team"].id,
        url: "/images/mulher_lutando.jpg",
        altText: "Short Maquina Team para treino",
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: productMap["protetor-bucal-premium"].id,
        url: "/images/instrutor.jpg",
        altText: "Protetor bucal premium",
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: productMap["corda-speed-pro"].id,
        url: "/images/interior.webp",
        altText: "Corda speed para condicionamento",
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: productMap["squeeze-aluminio-maquina-team"].id,
        url: "/images/logo.jpg",
        altText: "Squeeze Maquina Team",
        sortOrder: 0,
        isPrimary: true,
      },
      {
        productId: productMap["camiseta-casual-maquina-team"].id,
        url: "/images/fachada.webp",
        altText: "Camiseta casual Maquina Team",
        sortOrder: 0,
        isPrimary: true,
      },
    ],
  });

  await prisma.wishlist.create({
    data: {
      userId: aliceUser.id,
      items: {
        create: [
          {
            productId: productMap["camiseta-dry-fit-maquina-team"].id,
          },
          {
            productId: productMap["luva-boxe-maquina-team-12oz"].id,
          },
          {
            productId: productMap["corda-speed-pro"].id,
          },
        ],
      },
    },
  });

  const saleOne = await createPaidProductSale({
    saleNumber: "VEN-20260331-001",
    soldByUserId: receptionUser.id,
    studentProfileId: aliceUser.studentProfile!.id,
    paymentMethod: "PIX",
    soldAt: addDays(baseDay, -2),
    notes: "Venda realizada no balcão após treino de segunda-feira.",
    items: [
      {
        productId: productMap["luva-boxe-maquina-team-12oz"].id,
        quantity: 1,
        unitPriceCents: productMap["luva-boxe-maquina-team-12oz"].priceCents,
      },
      {
        productId: productMap["bandagem-elastica-profissional-4m"].id,
        quantity: 2,
        unitPriceCents: productMap["bandagem-elastica-profissional-4m"].priceCents,
      },
    ],
  });

  const saleTwo = await createPaidProductSale({
    saleNumber: "VEN-20260331-002",
    soldByUserId: adminUser.id,
    customerName: "Visitante Walk-in",
    customerDocument: "000.000.000-00",
    paymentMethod: "DEBIT_CARD",
    soldAt: addDays(baseDay, -1),
    discountCents: 1000,
    notes: "Venda promocional de uniforme para visitante.",
    items: [
      {
        productId: productMap["camiseta-dry-fit-maquina-team"].id,
        quantity: 2,
        unitPriceCents: productMap["camiseta-dry-fit-maquina-team"].priceCents,
      },
      {
        productId: productMap["bandagem-elastica-profissional-4m"].id,
        quantity: 1,
        unitPriceCents: productMap["bandagem-elastica-profissional-4m"].priceCents,
      },
    ],
  });

  const [aliceShippingAddress, , welcomeCoupon] = await Promise.all([
    prisma.shippingAddress.create({
      data: {
        userId: aliceUser.id,
        label: "Casa",
        recipientName: "Alice Nogueira",
        recipientPhone: aliceUser.phone ?? "(32) 99150-7910",
        zipCode: "36015000",
        state: "MG",
        city: "Juiz de Fora",
        district: "Centro",
        street: "Rua Fonseca Hermes",
        number: "45",
        complement: "Apto 201",
        reference: "Proximo ao centro",
        isDefault: true,
      },
    }),
    prisma.shippingAddress.create({
      data: {
        userId: brunoUser.id,
        label: "Retirada e apoio",
        recipientName: "Bruno Tavares",
        recipientPhone: brunoUser.phone ?? "(32) 99150-7911",
        zipCode: "36013010",
        state: "MG",
        city: "Juiz de Fora",
        district: "Centro",
        street: "Av. Barao do Rio Branco",
        number: "1200",
        reference: "Sala comercial",
        isDefault: true,
      },
    }),
    prisma.coupon.create({
      data: {
        code: "BEMVINDO10",
        description: "Desconto de boas-vindas para a primeira compra online da loja.",
        discountType: "PERCENTAGE",
        discountValue: 10,
        active: true,
        usageLimit: 50,
        perUserLimit: 1,
        minOrderValueCents: 12000,
        eligibleCategories: ["Vestuario", "Acessorios"],
      },
    }),
  ]);

  const onlineOrder = await prisma.$transaction(async (tx) => {
    const orderItems = [
      {
        productId: productMap["bandagem-elastica-profissional-4m"].id,
        quantity: 3,
        unitPriceCents: productMap["bandagem-elastica-profissional-4m"].priceCents,
        productName: productMap["bandagem-elastica-profissional-4m"].name,
        productSlug: productMap["bandagem-elastica-profissional-4m"].slug,
        productSku: productMap["bandagem-elastica-profissional-4m"].sku,
        productCategory: productMap["bandagem-elastica-profissional-4m"].category,
        productImageUrl: "/images/mulher_lutando.jpg",
      },
      {
        productId: productMap["camiseta-dry-fit-maquina-team"].id,
        quantity: 1,
        unitPriceCents: productMap["camiseta-dry-fit-maquina-team"].priceCents,
        productName: productMap["camiseta-dry-fit-maquina-team"].name,
        productSlug: productMap["camiseta-dry-fit-maquina-team"].slug,
        productSku: productMap["camiseta-dry-fit-maquina-team"].sku,
        productCategory: productMap["camiseta-dry-fit-maquina-team"].category,
        productImageUrl: "/images/logo.jpg",
      },
    ];
    const subtotalCents = orderItems.reduce(
      (total, item) => total + item.quantity * item.unitPriceCents,
      0,
    );
    const discountCents = Math.round(subtotalCents * 0.1);
    const shippingCents = 1490;
    const totalCents = subtotalCents - discountCents + shippingCents;

    const order = await tx.order.create({
      data: {
        orderNumber: "PED-20260331-1001",
        userId: aliceUser.id,
        couponId: welcomeCoupon.id,
        status: "PROCESSING",
        paymentStatus: "PAID",
        paymentMethod: "PIX",
        deliveryMethod: "LOCAL_DELIVERY",
        deliveryLabel: "Entrega local",
        shippingEstimatedDays: 2,
        subtotalCents,
        discountCents,
        shippingCents,
        totalCents,
        customerName: aliceUser.name,
        customerEmail: aliceUser.email,
        customerPhone: aliceUser.phone ?? "(32) 99150-7910",
        customerDocument: "11111111111",
        shippingAddressLabel: aliceShippingAddress.label,
        shippingRecipientName: aliceShippingAddress.recipientName,
        shippingRecipientPhone: aliceShippingAddress.recipientPhone,
        shippingZipCode: aliceShippingAddress.zipCode,
        shippingState: aliceShippingAddress.state,
        shippingCity: aliceShippingAddress.city,
        shippingDistrict: aliceShippingAddress.district,
        shippingStreet: aliceShippingAddress.street,
        shippingNumber: aliceShippingAddress.number,
        shippingComplement: aliceShippingAddress.complement,
        shippingReference: aliceShippingAddress.reference,
        paidAt: addDays(baseDay, -1),
        items: {
          create: orderItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productSlug: item.productSlug,
            productSku: item.productSku,
            productCategory: item.productCategory,
            productImageUrl: item.productImageUrl,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.quantity * item.unitPriceCents,
          })),
        },
        statusHistory: {
          create: [
            {
              status: "CONFIRMED",
              note: "Pedido confirmado automaticamente no seed da loja.",
              changedByUserId: adminUser.id,
            },
            {
              status: "PROCESSING",
              note: "Pedido em separacao pela equipe da recepcao.",
              changedByUserId: receptionUser.id,
            },
          ],
        },
      },
      select: {
        id: true,
        orderNumber: true,
        totalCents: true,
      },
    });

    await tx.coupon.update({
      where: {
        id: welcomeCoupon.id,
      },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });

    await tx.couponRedemption.create({
      data: {
        couponId: welcomeCoupon.id,
        orderId: order.id,
        userId: aliceUser.id,
        discountCents,
      },
    });

    for (const item of orderItems) {
      await tx.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stockQuantity: {
            decrement: item.quantity,
          },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          orderId: order.id,
          type: "ORDER_RESERVE",
          quantityDelta: item.quantity * -1,
          reason: "Reserva de estoque do pedido online seed",
          performedByUserId: adminUser.id,
        },
      });
    }

    return order;
  });

  const announcements = await Promise.all([
    prisma.announcement.create({
      data: {
        title: "Aulão técnico de Boxe neste sábado",
        slug: "aulao-tecnico-boxe-sabado",
        excerpt: "Treino especial com foco em combinação, esquiva e leitura de distância.",
        content:
          "Neste sábado teremos um aulão aberto para alunos ativos de boxe e kickboxing. Chegue com 15 minutos de antecedência para aquecimento dirigido.",
        targetRole: "ALUNO",
        isPinned: true,
        isPublished: true,
        publishedAt: addDays(baseDay, -1),
        createdByUserId: adminUser.id,
      },
    }),
    prisma.announcement.create({
      data: {
        title: "Fechamento de caixa da recepção às 21h30",
        slug: "fechamento-caixa-recepcao-21h30",
        excerpt: "Rotina operacional da recepção para encerramento diário.",
        content:
          "A equipe de recepção deve concluir conferência de pagamentos, vendas de produtos e presença de alunos até 21h30 em dias úteis.",
        targetRole: "RECEPCAO",
        isPublished: true,
        publishedAt: addDays(baseDay, -3),
        createdByUserId: adminUser.id,
      },
    }),
    prisma.announcement.create({
      data: {
        title: "Atualização do quadro de treinos individuais",
        slug: "atualizacao-quadro-treinos-individuais",
        excerpt: "Os professores devem revisar atribuições pendentes no painel.",
        content:
          "Treinos individuais de abril já estão disponíveis no painel. Revise alunos com status PAST_DUE antes de liberar novos blocos de treino.",
        targetRole: "PROFESSOR",
        isPublished: true,
        publishedAt: baseDay,
        createdByUserId: adminUser.id,
      },
    }),
  ]);

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: receptionUser.id,
        action: "SUBSCRIPTION_CREATED",
        entityType: "Subscription",
        entityId: subscriptionMap[aliceUser.studentProfile!.id].id,
        summary: "Assinatura mensal de Alice Nogueira criada pela recepção.",
        afterData: {
          studentRegistration: "ALU-001",
          plan: "Mensal 3x na Semana",
          status: "ACTIVE",
        },
      },
      {
        actorId: adminUser.id,
        action: "ANNOUNCEMENT_PUBLISHED",
        entityType: "Announcement",
        entityId: announcements[0].id,
        summary: "Admin publicou aviso fixado sobre o aulão técnico de boxe.",
        afterData: {
          slug: announcements[0].slug,
          targetRole: announcements[0].targetRole,
        },
      },
      {
        actorId: receptionUser.id,
        action: "PAYMENT_MARKED_AS_PAID",
        entityType: "Payment",
        entityId: "SUB-ALICE-2026-03",
        summary: "Pagamento mensal de Alice confirmado via PIX.",
        afterData: {
          amountCents: 17900,
          method: "PIX",
          status: "PAID",
        },
      },
      {
        actorId: adminUser.id,
        action: "PRODUCT_SALE_CREATED",
        entityType: "ProductSale",
        entityId: saleTwo.id,
        summary: "Venda de uniforme registrada no balcão com desconto promocional.",
        afterData: {
          saleNumber: saleTwo.saleNumber,
          totalCents: saleTwo.totalCents,
        },
      },
      {
        actorId: receptionUser.id,
        action: "PRODUCT_SALE_CREATED",
        entityType: "ProductSale",
        entityId: saleOne.id,
        summary: "Venda de luva e bandagem registrada para aluna Alice.",
        afterData: {
          saleNumber: saleOne.saleNumber,
          totalCents: saleOne.totalCents,
        },
      },
      {
        actorId: adminUser.id,
        action: "STORE_ORDER_CREATED",
        entityType: "Order",
        entityId: onlineOrder.id,
        summary: "Pedido online da loja criado para Alice com cupom de boas-vindas.",
        afterData: {
          orderNumber: onlineOrder.orderNumber,
          totalCents: onlineOrder.totalCents,
        },
      },
    ],
  });

  const summary = {
    users: await prisma.user.count(),
    studentProfiles: await prisma.studentProfile.count(),
    teacherProfiles: await prisma.teacherProfile.count(),
    modalities: await prisma.modality.count(),
    classSchedules: await prisma.classSchedule.count(),
    enrollments: await prisma.classEnrollment.count(),
    subscriptions: await prisma.subscription.count(),
    payments: await prisma.payment.count(),
    products: await prisma.product.count(),
    sales: await prisma.productSale.count(),
    shippingAddresses: await prisma.shippingAddress.count(),
    coupons: await prisma.coupon.count(),
    orders: await prisma.order.count(),
    trainingTemplates: await prisma.trainingTemplate.count(),
    trainingAssignments: await prisma.trainingAssignment.count(),
    announcements: await prisma.announcement.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.log("\nSeed concluído com sucesso.\n");
  console.table(summary);
  console.log("Credenciais de demonstração:");
  console.log(`Admin: Maquinateam.adm@gmail.com / ${adminPassword}`);
  console.log(`Recepção: recepcao@maquinateam.com.br / ${defaultStaffPassword}`);
  console.log(`Professor: ricardo.alves@maquinateam.com.br / ${defaultStaffPassword}`);
  console.log(`Aluno: alice.nogueira@maquinateam.com.br / ${defaultStudentPassword}`);
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
