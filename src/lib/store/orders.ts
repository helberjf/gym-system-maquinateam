import type { z } from "zod";
import {
  CheckoutPaymentKind,
  DeliveryMethod,
  InventoryMovementType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductStatus,
} from "@prisma/client";
import { auth } from "@/auth";
import { logAuditEvent } from "@/lib/audit";
import { getOptionalSession } from "@/lib/auth/session";
import { BRAND } from "@/lib/constants/brand";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { buildOffsetPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/app-url";
import {
  buildMercadoPagoReturnUrls,
  createMercadoPagoPreference,
  getMercadoPagoWebhookUrl,
  onlyDigits,
  refundMercadoPagoPayment,
} from "@/lib/payments/mercadopago";
import {
  createAbacatePayPixQrCode,
  formatAbacatePayCellphone,
} from "@/lib/payments/abacatepay";
import { resolvePaymentProvider } from "@/lib/payments/provider";
import { getActiveCartId, getCartSnapshot } from "@/lib/store/cart";
import { validateCouponForItems } from "@/lib/store/coupons";
import {
  DELIVERY_METHOD_DESCRIPTIONS,
  DELIVERY_METHOD_LABELS,
} from "@/lib/store/constants";
import type {
  checkoutSchema,
  orderFiltersSchema,
  shippingAddressInputSchema,
  updateOrderStatusSchema,
} from "@/lib/validators/store";

type ShippingAddressInput = z.infer<typeof shippingAddressInputSchema>;
type CheckoutInput = z.infer<typeof checkoutSchema>;
type OrderFilters = z.infer<typeof orderFiltersSchema>;
type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

type MutationContext = {
  userId?: string | null;
  request?: Request;
};

type StoreCheckoutUser = Awaited<ReturnType<typeof getOptionalStoreCheckoutUser>>;

type PreparedCartItem = {
  productId: string;
  name: string;
  slug: string;
  sku: string;
  category: string;
  priceCents: number;
  quantity: number;
  trackInventory: boolean;
  stockQuantity: number;
  status: ProductStatus;
  storeVisible: boolean;
  lowStockThreshold: number;
  imageUrl: string | null;
  weightGrams: number | null;
};

type StoreOrderDbClient = Prisma.TransactionClient | typeof prisma;

function normalizeDigits(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function normalizeOptionalString(value?: string | null) {
  return value?.trim() || null;
}

function buildOrderNumber(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = String(referenceDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(referenceDate.getUTCDate()).padStart(2, "0");
  const randomSuffix = Math.floor(Math.random() * 9000 + 1000);

  return `PED-${year}${month}${day}-${randomSuffix}`;
}

function buildCheckoutExternalReference(prefix: "STORE" | "PLAN") {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `${prefix}-${timestamp}-${randomSuffix}`;
}

function buildMercadoPagoOrderItems(
  orderItems: Array<{
    name: string;
    quantity: number;
    unitPriceCents: number;
  }>,
  discountCents: number,
) {
  const units: Array<{ title: string; priceCents: number }> = [];

  for (const item of orderItems) {
    for (let index = 0; index < item.quantity; index += 1) {
      units.push({
        title: item.name,
        priceCents: item.unitPriceCents,
      });
    }
  }

  const totalBeforeDiscount = units.reduce(
    (total, unit) => total + unit.priceCents,
    0,
  );

  if (units.length === 0 || totalBeforeDiscount <= 0) {
    return [];
  }

  const boundedDiscount = Math.max(
    0,
    Math.min(discountCents, totalBeforeDiscount),
  );

  let allocatedDiscount = 0;
  const adjustedUnits = units.map((unit, index) => {
    const isLast = index === units.length - 1;
    const proportionalDiscount = isLast
      ? boundedDiscount - allocatedDiscount
      : Math.floor((boundedDiscount * unit.priceCents) / totalBeforeDiscount);

    allocatedDiscount += proportionalDiscount;

    return {
      title: unit.title,
      adjustedPriceCents: Math.max(0, unit.priceCents - proportionalDiscount),
    };
  });

  const grouped = new Map<
    string,
    { title: string; quantity: number; unitPriceCents: number }
  >();

  for (const unit of adjustedUnits) {
    const key = `${unit.title}:${unit.adjustedPriceCents}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.quantity += 1;
      continue;
    }

    grouped.set(key, {
      title: unit.title,
      quantity: 1,
      unitPriceCents: unit.adjustedPriceCents,
    });
  }

  return Array.from(grouped.values()).map((item) => ({
    title: item.title,
    quantity: item.quantity,
    unit_price: Number((item.unitPriceCents / 100).toFixed(2)),
    currency_id: "BRL" as const,
  }));
}

function buildMercadoPagoPayer(input: {
  customerName: string;
  customerEmail: string;
  customerDocument?: string | null;
  shippingZipCode?: string | null;
  shippingStreet?: string | null;
  shippingNumber?: string | null;
}) {
  const [firstName, ...remainingName] = input.customerName.trim().split(/\s+/);
  const document = onlyDigits(input.customerDocument);
  const zipCode = onlyDigits(input.shippingZipCode);
  const streetNumberDigits = onlyDigits(input.shippingNumber);
  const streetNumber = Number(streetNumberDigits);

  return {
    name: firstName || input.customerName,
    surname: remainingName.join(" ") || undefined,
    email: input.customerEmail,
    identification:
      document.length >= 11
        ? {
            type: "CPF" as const,
            number: document,
          }
        : undefined,
    address:
      zipCode && input.shippingStreet && Number.isFinite(streetNumber)
        ? {
            zip_code: zipCode,
            street_name: input.shippingStreet,
            street_number: streetNumber,
          }
        : undefined,
  };
}

function buildStorePixDescription(
  orderItems: Array<{ name: string; quantity: number }>,
) {
  const firstItem = orderItems[0];

  if (!firstItem) {
    return "Pedido online";
  }

  const totalUnits = orderItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const remainingUnits = Math.max(0, totalUnits - firstItem.quantity);
  const suffix = remainingUnits > 0 ? ` + ${remainingUnits} item(ns)` : "";

  return `Pedido ${firstItem.name}${suffix}`.slice(0, 140);
}

function buildStorePixCustomer(input: {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerDocument?: string | null;
}) {
  const document = onlyDigits(input.customerDocument);
  const phone = onlyDigits(input.customerPhone);

  if (!document || !phone) {
    return undefined;
  }

  return {
    name: input.customerName.trim(),
    cellphone: formatAbacatePayCellphone(phone),
    email: input.customerEmail.trim(),
    taxId: document,
  };
}

function isLocalDeliveryAddress(address: ShippingAddressInput) {
  const normalizedCity = address.city.trim().toLowerCase();
  const normalizedState = address.state.trim().toUpperCase();
  const zipCode = normalizeDigits(address.zipCode);

  return (
    normalizedState === "MG" &&
    (normalizedCity.includes("juiz de fora") ||
      zipCode.startsWith("360") ||
      zipCode.startsWith("361"))
  );
}

function getRegionMultiplier(state: string) {
  const normalizedState = state.trim().toUpperCase();

  if (["MG", "SP", "RJ", "ES"].includes(normalizedState)) {
    return { multiplier: 1, days: 4 };
  }

  if (["PR", "SC", "RS", "GO", "DF", "MS", "MT"].includes(normalizedState)) {
    return { multiplier: 1.3, days: 6 };
  }

  return { multiplier: 1.6, days: 8 };
}

function calculateShippingOptions(input: {
  items: PreparedCartItem[];
  address?: ShippingAddressInput | null;
  subtotalCents: number;
}) {
  const totalWeightGrams = input.items.reduce(
    (total, item) => total + (item.weightGrams ?? 450) * item.quantity,
    0,
  );
  const totalUnits = input.items.reduce((total, item) => total + item.quantity, 0);
  const options: Array<{
    method: DeliveryMethod;
    label: string;
    description: string;
    priceCents: number;
    estimatedDays: number;
  }> = [
    {
      method: DeliveryMethod.PICKUP,
      label: DELIVERY_METHOD_LABELS[DeliveryMethod.PICKUP],
      description: DELIVERY_METHOD_DESCRIPTIONS[DeliveryMethod.PICKUP],
      priceCents: 0,
      estimatedDays: 0,
    },
  ];

  if (input.address && isLocalDeliveryAddress(input.address)) {
    const localBase = input.subtotalCents >= 25000 ? 0 : 1490;
    const localExtra = Math.max(0, totalUnits - 1) * 200;

    options.push({
      method: DeliveryMethod.LOCAL_DELIVERY,
      label: DELIVERY_METHOD_LABELS[DeliveryMethod.LOCAL_DELIVERY],
      description: DELIVERY_METHOD_DESCRIPTIONS[DeliveryMethod.LOCAL_DELIVERY],
      priceCents: localBase + localExtra,
      estimatedDays: input.subtotalCents >= 25000 ? 1 : 2,
    });
  }

  if (input.address) {
    const weightFactor = Math.max(0, Math.ceil(Math.max(totalWeightGrams, 1) / 500) - 1);
    const region = getRegionMultiplier(input.address.state);
    const basePrice = 1890 + weightFactor * 550;
    const standardPrice = Math.round(basePrice * region.multiplier);

    options.push({
      method: DeliveryMethod.STANDARD_SHIPPING,
      label: DELIVERY_METHOD_LABELS[DeliveryMethod.STANDARD_SHIPPING],
      description: DELIVERY_METHOD_DESCRIPTIONS[DeliveryMethod.STANDARD_SHIPPING],
      priceCents: input.subtotalCents >= 39900 ? 0 : standardPrice,
      estimatedDays: region.days,
    });
  }

  return options;
}

async function generateUniqueOrderNumber(tx: Prisma.TransactionClient, referenceDate: Date) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const orderNumber = buildOrderNumber(referenceDate);
    const existing = await tx.order.findUnique({
      where: {
        orderNumber,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return orderNumber;
    }
  }

  throw new ConflictError("Nao foi possivel gerar um numero unico para o pedido.");
}

async function getOptionalStoreCheckoutUser() {
  const session = await getOptionalSession();

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      studentProfile: {
        select: {
          cpf: true,
          addressLine: true,
          city: true,
          state: true,
          zipCode: true,
        },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError("Sua conta nao foi encontrada.");
  }

  return user;
}

function resolveCheckoutCustomer(input: {
  user: StoreCheckoutUser;
  guest: CheckoutInput["guest"];
}) {
  if (input.user) {
    return {
      userId: input.user.id,
      authenticated: true,
      name: input.user.name,
      email: input.user.email,
      phone: input.user.phone ?? "",
      document: input.user.studentProfile?.cpf ?? null,
    };
  }

  if (!input.guest) {
    throw new ConflictError(
      "Informe nome, e-mail, telefone e CPF para finalizar sem login.",
    );
  }

  return {
    userId: null,
    authenticated: false,
    name: input.guest.name,
    email: input.guest.email,
    phone: input.guest.phone,
    document: input.guest.document,
  };
}

async function resolveCheckoutAddress(userId: string | null, input: CheckoutInput) {
  if (input.deliveryMethod === DeliveryMethod.PICKUP) {
    return null;
  }

  if (input.shippingAddressId) {
    if (!userId) {
      throw new ConflictError(
        "Entre na sua conta para usar um endereco salvo.",
      );
    }

    const savedAddress = await prisma.shippingAddress.findFirst({
      where: {
        id: input.shippingAddressId,
        userId,
      },
    });

    if (!savedAddress) {
      throw new NotFoundError("Endereco de entrega nao encontrado.");
    }

    return savedAddress;
  }

  if (!input.address) {
    throw new ConflictError("Informe um endereco para concluir a entrega.");
  }

  return input.address;
}

async function saveAddressForUser(userId: string, address: ShippingAddressInput) {
  const existing = await prisma.shippingAddress.findFirst({
    where: {
      userId,
      zipCode: address.zipCode,
      street: address.street,
      number: address.number,
      recipientName: address.recipientName,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return existing.id;
  }

  const addressCount = await prisma.shippingAddress.count({
    where: {
      userId,
    },
  });

  const created = await prisma.shippingAddress.create({
    data: {
      userId,
      label: normalizeOptionalString(address.label),
      recipientName: address.recipientName,
      recipientPhone: address.recipientPhone,
      zipCode: address.zipCode,
      state: address.state,
      city: address.city,
      district: address.district,
      street: address.street,
      number: address.number,
      complement: normalizeOptionalString(address.complement),
      reference: normalizeOptionalString(address.reference),
      isDefault: addressCount === 0,
    },
    select: {
      id: true,
    },
  });

  return created.id;
}

async function getPreparedCartItemsForCart(
  db: StoreOrderDbClient,
  cartId: string,
) {
  const items = await db.cartItem.findMany({
    where: {
      cartId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      quantity: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          category: true,
          priceCents: true,
          trackInventory: true,
          stockQuantity: true,
          status: true,
          storeVisible: true,
          lowStockThreshold: true,
          weightGrams: true,
          images: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 1,
            select: {
              url: true,
            },
          },
        },
      },
    },
  });

  if (items.length === 0) {
    throw new ConflictError("Seu carrinho esta vazio.");
  }

  return {
    cartId,
    items: items.map((item) => {
      if (!item.product.storeVisible || item.product.status === ProductStatus.ARCHIVED) {
        throw new ConflictError(`O produto ${item.product.name} nao esta mais disponivel.`);
      }

      if (item.product.trackInventory && item.product.stockQuantity < item.quantity) {
        throw new ConflictError(`Estoque insuficiente para ${item.product.name}.`);
      }

      return {
        productId: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        category: item.product.category,
        priceCents: item.product.priceCents,
        quantity: item.quantity,
        trackInventory: item.product.trackInventory,
        stockQuantity: item.product.stockQuantity,
        status: item.product.status,
        storeVisible: item.product.storeVisible,
        lowStockThreshold: item.product.lowStockThreshold,
        imageUrl: item.product.images[0]?.url ?? null,
        weightGrams: item.product.weightGrams ?? null,
      } satisfies PreparedCartItem;
    }),
  };
}

export async function getCheckoutPageData() {
  const [user, cart] = await Promise.all([
    getOptionalStoreCheckoutUser(),
    getCartSnapshot(),
  ]);
  const addresses = user
    ? await prisma.shippingAddress.findMany({
        where: {
          userId: user.id,
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      })
    : [];
  const customerOrderCount = user
    ? await prisma.order.count({
        where: {
          userId: user.id,
        },
      })
    : 0;

  return {
    user,
    customer: user
      ? {
          authenticated: true,
          name: user.name,
          email: user.email,
          phone: user.phone ?? "",
          document: user.studentProfile?.cpf ?? "",
        }
      : {
          authenticated: false,
          name: "",
          email: "",
          phone: "",
          document: "",
    },
    addresses,
    cart,
    customerOrderCount,
    suggestedAddress:
      user?.studentProfile?.addressLine &&
      user.studentProfile.city &&
      user.studentProfile.state
        ? {
            label: "Endereco do cadastro",
            recipientName: user.name,
            recipientPhone: user.phone ?? "",
            zipCode: user.studentProfile.zipCode ?? "",
            state: user.studentProfile.state,
            city: user.studentProfile.city,
            district: "Centro",
            street: user.studentProfile.addressLine,
            number: "s/n",
            complement: "",
            reference: "",
          }
        : null,
  };
}

export async function getShippingQuoteForActiveCart(input: {
  address: ShippingAddressInput;
}) {
  const cartId = await getActiveCartId();

  if (!cartId) {
    throw new ConflictError("Seu carrinho esta vazio.");
  }

  const preparedCart = await getPreparedCartItemsForCart(prisma, cartId);
  const subtotalCents = preparedCart.items.reduce(
    (total, item) => total + item.priceCents * item.quantity,
    0,
  );

  return calculateShippingOptions({
    items: preparedCart.items,
    address: input.address,
    subtotalCents,
  });
}

async function rollbackFailedStoreCheckout(input: {
  orderId: string;
  checkoutPaymentId: string;
  userId?: string | null;
  failureReason: string;
}) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: {
        id: input.orderId,
      },
      include: {
        items: true,
        couponRedemption: true,
      },
    });

    if (!order) {
      return;
    }

    for (const item of order.items) {
      const product = await tx.product.findUnique({
        where: {
          id: item.productId,
        },
        select: {
          stockQuantity: true,
          status: true,
        },
      });

      await tx.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stockQuantity: {
            increment: item.quantity,
          },
          status:
            product && product.status === ProductStatus.OUT_OF_STOCK
              ? ProductStatus.ACTIVE
              : undefined,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          orderId: order.id,
          type: InventoryMovementType.ORDER_RESTORE,
          quantityDelta: item.quantity,
          reason: "Estoque devolvido apos falha ao iniciar o pagamento online",
          note: input.failureReason,
          performedByUserId: input.userId ?? null,
        },
      });
    }

    if (order.couponId && order.couponRedemption) {
      await tx.coupon.update({
        where: {
          id: order.couponId,
        },
        data: {
          usageCount: {
            decrement: 1,
          },
        },
      });

      await tx.couponRedemption.delete({
        where: {
          id: order.couponRedemption.id,
        },
      });
    }

    await tx.checkoutPayment.update({
      where: {
        id: input.checkoutPaymentId,
      },
      data: {
        status: PaymentStatus.FAILED,
        failureReason: input.failureReason,
      },
    });

    await tx.order.update({
      where: {
        id: order.id,
      },
      data: {
        status: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.FAILED,
        cancelledAt: new Date(),
        inventoryRestoredAt: new Date(),
        statusHistory: {
          create: {
            status: OrderStatus.CANCELLED,
            note: "Pedido cancelado porque o checkout online nao conseguiu ser iniciado.",
            changedByUserId: input.userId ?? null,
          },
        },
      },
    });
  });
}

export async function createStoreCheckoutSession(
  input: CheckoutInput,
  context: MutationContext,
) {
  const user = await getOptionalStoreCheckoutUser();
  const customer = resolveCheckoutCustomer({
    user,
    guest: input.guest,
  });
  const paymentProvider = resolvePaymentProvider(input.paymentMethod);

  if (context.userId && user?.id && user.id !== context.userId) {
    throw new ForbiddenError("A conta autenticada nao corresponde ao checkout.");
  }

  const resolvedAddress = await resolveCheckoutAddress(customer.userId, input);
  const origin = context.request ? new URL(context.request.url).origin : undefined;
  const baseUrl = getAppUrl(origin);
  const returnUrls = buildMercadoPagoReturnUrls({
    successPath: "/checkout/sucesso",
    failurePath: "/checkout/falha",
    origin,
  });
  const cartId = await getActiveCartId();

  if (!cartId) {
    throw new ConflictError("Seu carrinho esta vazio.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const { items } = await getPreparedCartItemsForCart(tx, cartId);
    const subtotalCents = items.reduce(
      (total, item) => total + item.priceCents * item.quantity,
      0,
    );
    const shippingOptions = calculateShippingOptions({
      items,
      address: resolvedAddress as ShippingAddressInput | null,
      subtotalCents,
    });
    const selectedShipping = shippingOptions.find(
      (option) => option.method === input.deliveryMethod,
    );

    if (!selectedShipping) {
      throw new ConflictError("A opcao de entrega escolhida nao esta disponivel.");
    }

    const couponValidation = input.couponCode
      ? await validateCouponForItems({
          db: tx,
          code: input.couponCode,
          userId: customer.userId,
          items: items.map((item) => ({
            productId: item.productId,
            category: item.category,
            quantity: item.quantity,
            unitPriceCents: item.priceCents,
          })),
        })
      : null;

    if (couponValidation && !couponValidation.ok) {
      throw new ConflictError(couponValidation.message);
    }

    const discountCents = couponValidation?.ok ? couponValidation.discountCents : 0;
    const orderNumber = await generateUniqueOrderNumber(tx, new Date());
    const totalCents = Math.max(
      0,
      subtotalCents - discountCents + selectedShipping.priceCents,
    );
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: customer.userId,
        couponId: couponValidation?.ok ? couponValidation.coupon.id : null,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: input.paymentMethod as PaymentMethod,
        deliveryMethod: selectedShipping.method,
        deliveryLabel: selectedShipping.label,
        shippingEstimatedDays: selectedShipping.estimatedDays,
        notes: normalizeOptionalString(input.notes),
        subtotalCents,
        discountCents,
        shippingCents: selectedShipping.priceCents,
        totalCents,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerDocument: customer.document,
        shippingAddressLabel:
          input.deliveryMethod === DeliveryMethod.PICKUP
            ? "Retirada na academia"
            : normalizeOptionalString(
                (resolvedAddress as ShippingAddressInput | null)?.label,
              ),
        shippingRecipientName:
          input.deliveryMethod === DeliveryMethod.PICKUP
            ? customer.name
            : (resolvedAddress as ShippingAddressInput | null)?.recipientName ?? null,
        shippingRecipientPhone:
          input.deliveryMethod === DeliveryMethod.PICKUP
            ? customer.phone || null
            : (resolvedAddress as ShippingAddressInput | null)?.recipientPhone ?? null,
        shippingZipCode:
          input.deliveryMethod === DeliveryMethod.PICKUP
            ? BRAND.address.cep
            : (resolvedAddress as ShippingAddressInput | null)?.zipCode ?? null,
        shippingState:
          input.deliveryMethod === DeliveryMethod.PICKUP
            ? "MG"
            : (resolvedAddress as ShippingAddressInput | null)?.state ?? null,
        shippingCity:
          input.deliveryMethod === DeliveryMethod.PICKUP
            ? "Juiz de Fora"
            : (resolvedAddress as ShippingAddressInput | null)?.city ?? null,
        shippingDistrict:
          input.deliveryMethod === DeliveryMethod.PICKUP
            ? "Centro"
            : (resolvedAddress as ShippingAddressInput | null)?.district ?? null,
        shippingStreet:
          input.deliveryMethod === DeliveryMethod.PICKUP
            ? BRAND.address.street
            : (resolvedAddress as ShippingAddressInput | null)?.street ?? null,
        shippingNumber:
          input.deliveryMethod === DeliveryMethod.PICKUP
            ? "5"
            : (resolvedAddress as ShippingAddressInput | null)?.number ?? null,
        shippingComplement:
          input.deliveryMethod === DeliveryMethod.PICKUP
            ? null
            : normalizeOptionalString(
                (resolvedAddress as ShippingAddressInput | null)?.complement,
              ),
        shippingReference:
          input.deliveryMethod === DeliveryMethod.PICKUP
            ? BRAND.hours.label
            : normalizeOptionalString(
                (resolvedAddress as ShippingAddressInput | null)?.reference,
              ),
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productName: item.name,
            productSlug: item.slug,
            productSku: item.sku,
            productCategory: item.category,
            productImageUrl: item.imageUrl,
            quantity: item.quantity,
            unitPriceCents: item.priceCents,
            lineTotalCents: item.priceCents * item.quantity,
          })),
        },
        statusHistory: {
          create: {
            status: OrderStatus.PENDING,
            note: "Pedido criado e aguardando pagamento online.",
            changedByUserId: customer.userId,
          },
        },
      },
      select: {
        id: true,
        orderNumber: true,
        totalCents: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        customerDocument: true,
        shippingZipCode: true,
        shippingStreet: true,
        shippingNumber: true,
      },
    });

    if (couponValidation?.ok) {
      await tx.coupon.update({
        where: {
          id: couponValidation.coupon.id,
        },
        data: {
          usageCount: {
            increment: 1,
          },
        },
      });

      await tx.couponRedemption.create({
        data: {
          couponId: couponValidation.coupon.id,
          orderId: order.id,
          userId: customer.userId,
          discountCents,
        },
      });
    }

    for (const item of items) {
      if (!item.trackInventory) {
        continue;
      }

      const nextStock = item.stockQuantity - item.quantity;

      await tx.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stockQuantity: {
            decrement: item.quantity,
          },
          status: nextStock <= 0 ? ProductStatus.OUT_OF_STOCK : ProductStatus.ACTIVE,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          orderId: order.id,
          type: InventoryMovementType.ORDER_RESERVE,
          quantityDelta: item.quantity * -1,
          reason: "Reserva automatica de estoque no checkout online",
          performedByUserId: customer.userId,
        },
      });
    }

    const checkoutPayment = await tx.checkoutPayment.create({
      data: {
        kind: CheckoutPaymentKind.STORE_ORDER,
        provider: paymentProvider,
        userId: customer.userId,
        orderId: order.id,
        amountCents: totalCents,
        status: PaymentStatus.PENDING,
        method: input.paymentMethod,
        externalReference: buildCheckoutExternalReference("STORE"),
      },
      select: {
        id: true,
        externalReference: true,
      },
    });

    return {
      cartId,
      items,
      subtotalCents,
      discountCents,
      selectedShipping,
      couponCode: couponValidation?.ok ? couponValidation.coupon.code : null,
      resolvedAddress,
      order,
      checkoutPayment,
    };
  });

  try {
    let redirectUrl = "";
    let providerPreferenceId: string | null = null;
    let providerPaymentId: string | null = null;
    let rawPayload: Prisma.InputJsonValue = {};

    if (paymentProvider === "ABACATEPAY") {
      const pixData = await createAbacatePayPixQrCode({
        amountCents: created.order.totalCents,
        description: buildStorePixDescription(
          created.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
          })),
        ),
        customer: buildStorePixCustomer({
          customerName: created.order.customerName,
          customerEmail: created.order.customerEmail,
          customerPhone: created.order.customerPhone,
          customerDocument: created.order.customerDocument,
        }),
        metadata: {
          checkoutPaymentId: created.checkoutPayment.id,
          orderId: created.order.id,
          orderNumber: created.order.orderNumber,
          externalReference: created.checkoutPayment.externalReference,
        },
      });

      if (!pixData.id) {
        throw new ConflictError(
          "A AbacatePay nao retornou um identificador de Pix valido.",
        );
      }

      providerPaymentId = pixData.id;
      redirectUrl = `${baseUrl}/checkout/pix?payment=${created.checkoutPayment.id}`;
      rawPayload = pixData as Prisma.InputJsonValue;
    } else {
      const mpItems = buildMercadoPagoOrderItems(
        created.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.priceCents,
        })),
        created.discountCents,
      );

      if (created.selectedShipping.priceCents > 0) {
        mpItems.push({
          title: created.selectedShipping.label,
          quantity: 1,
          unit_price: Number((created.selectedShipping.priceCents / 100).toFixed(2)),
          currency_id: "BRL",
        });
      }

      const preference = await createMercadoPagoPreference({
        items: mpItems,
        externalReference: created.checkoutPayment.externalReference,
        notificationUrl: getMercadoPagoWebhookUrl(origin),
        successUrl: `${returnUrls.successUrl}?orderId=${created.order.id}`,
        pendingUrl: `${returnUrls.pendingUrl}?orderId=${created.order.id}`,
        failureUrl: `${returnUrls.failureUrl}?orderId=${created.order.id}`,
        statementDescriptor:
          process.env.MP_STORE_STATEMENT_DESCRIPTOR ?? "MAQUINATEAM",
        payer: buildMercadoPagoPayer({
          customerName: created.order.customerName,
          customerEmail: created.order.customerEmail,
          customerDocument: created.order.customerDocument,
          shippingZipCode: created.order.shippingZipCode,
          shippingStreet: created.order.shippingStreet,
          shippingNumber: created.order.shippingNumber,
        }),
        metadata: {
          checkoutPaymentId: created.checkoutPayment.id,
          orderId: created.order.id,
          orderNumber: created.order.orderNumber,
          appUrl: baseUrl,
        },
      });

      providerPreferenceId = preference.preferenceId;
      redirectUrl = preference.checkoutUrl;
      rawPayload = preference.rawPayload;
    }

    await prisma.$transaction(async (tx) => {
      await tx.checkoutPayment.update({
        where: {
          id: created.checkoutPayment.id,
        },
        data: {
          providerPreferenceId,
          providerPaymentId,
          checkoutUrl: redirectUrl,
          rawPayload,
        },
      });

      await tx.cartItem.deleteMany({
        where: {
          cartId: created.cartId,
        },
      });

      if (
        created.resolvedAddress &&
        customer.userId &&
        input.saveAddress &&
        !input.shippingAddressId &&
        input.deliveryMethod !== DeliveryMethod.PICKUP
      ) {
        await saveAddressForUser(
          customer.userId,
          created.resolvedAddress as ShippingAddressInput,
        );
      }
    });

    await logAuditEvent({
      request: context.request,
      actorId: customer.userId,
      action: "STORE_ORDER_CHECKOUT_CREATED",
      entityType: "Order",
      entityId: created.order.id,
      summary: `Checkout online iniciado para o pedido ${created.order.orderNumber}.`,
      afterData: {
        orderNumber: created.order.orderNumber,
        totalCents: created.order.totalCents,
        deliveryMethod: input.deliveryMethod,
        paymentMethod: input.paymentMethod,
        provider: paymentProvider,
        couponCode: created.couponCode,
      },
    });

    return {
      orderId: created.order.id,
      orderNumber: created.order.orderNumber,
      totalCents: created.order.totalCents,
      redirectUrl,
      customerEmail: created.order.customerEmail,
      customerName: created.order.customerName,
      subtotalCents: created.subtotalCents,
      discountCents: created.discountCents,
      shippingCents: created.selectedShipping.priceCents,
      deliveryLabel: created.selectedShipping.label,
      paymentMethod: input.paymentMethod,
      emailItems: created.items.map((item) => ({
        productName: item.name,
        quantity: item.quantity,
        unitPriceCents: item.priceCents,
        lineTotalCents: item.priceCents * item.quantity,
      })),
    };
  } catch (error) {
    await rollbackFailedStoreCheckout({
      orderId: created.order.id,
      checkoutPaymentId: created.checkoutPayment.id,
      userId: customer.userId,
      failureReason:
        error instanceof Error
          ? error.message
          : "Falha ao criar checkout no gateway de pagamento.",
    });

    throw error;
  }
}

export async function getMyOrdersData(userId: string, filters?: OrderFilters) {
  const where: Prisma.OrderWhereInput = {
    userId,
    ...(filters?.q
      ? {
          OR: [
            {
              orderNumber: {
                contains: filters.q,
                mode: "insensitive",
              },
            },
            {
              items: {
                some: {
                  productName: {
                    contains: filters.q,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
    ...(filters?.status && filters.status !== "all"
      ? {
          status: filters.status,
        }
      : {}),
  };

  const totalOrders = await prisma.order.count({
    where,
  });
  const pagination = buildOffsetPagination({
    page: filters?.page,
    totalItems: totalOrders,
  });
  const orders = await prisma.order.findMany({
    where,
    orderBy: {
      placedAt: "desc",
    },
    skip: pagination.skip,
    take: pagination.limit,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      deliveryMethod: true,
      deliveryLabel: true,
      shippingEstimatedDays: true,
      subtotalCents: true,
      discountCents: true,
      shippingCents: true,
      totalCents: true,
      placedAt: true,
      paidAt: true,
      deliveredAt: true,
      items: {
        orderBy: {
          productName: "asc",
        },
        select: {
          id: true,
          productName: true,
          productSlug: true,
          productImageUrl: true,
          quantity: true,
          unitPriceCents: true,
          lineTotalCents: true,
        },
      },
    },
  });

  return {
    orders,
    pagination,
  };
}

export async function getOrderDetailForUser(input: {
  orderId: string;
  userId: string;
  canManage: boolean;
}) {
  const order = await prisma.order.findFirst({
    where: input.canManage
      ? {
          id: input.orderId,
        }
      : {
          id: input.orderId,
          userId: input.userId,
        },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      deliveryMethod: true,
      deliveryLabel: true,
      shippingEstimatedDays: true,
      trackingCode: true,
      notes: true,
      subtotalCents: true,
      discountCents: true,
      shippingCents: true,
      totalCents: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      shippingRecipientName: true,
      shippingRecipientPhone: true,
      shippingZipCode: true,
      shippingState: true,
      shippingCity: true,
      shippingDistrict: true,
      shippingStreet: true,
      shippingNumber: true,
      shippingComplement: true,
      shippingReference: true,
      placedAt: true,
      paidAt: true,
      deliveredAt: true,
      cancelledAt: true,
      checkoutPayment: {
        select: {
          checkoutUrl: true,
          status: true,
        },
      },
      coupon: {
        select: {
          code: true,
          description: true,
        },
      },
      items: {
        orderBy: {
          productName: "asc",
        },
        select: {
          id: true,
          productName: true,
          productSlug: true,
          productSku: true,
          productCategory: true,
          productImageUrl: true,
          quantity: true,
          unitPriceCents: true,
          lineTotalCents: true,
        },
      },
      statusHistory: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          status: true,
          note: true,
          createdAt: true,
          changedByUser: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError("Pedido nao encontrado.");
  }

  return order;
}

export async function getAdminOrdersData(filters: OrderFilters) {
  const where: Prisma.OrderWhereInput = {
    ...(filters.q
      ? {
          OR: [
            {
              orderNumber: {
                contains: filters.q,
                mode: "insensitive",
              },
            },
            {
              customerName: {
                contains: filters.q,
                mode: "insensitive",
              },
            },
            {
              customerEmail: {
                contains: filters.q,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
    ...(filters.status !== "all"
      ? {
          status: filters.status,
        }
      : {}),
  };

  const [totalOrders, summary] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true,
      },
    }),
  ]);
  const pagination = buildOffsetPagination({
    page: filters.page,
    totalItems: totalOrders,
  });
  const orders = await prisma.order.findMany({
    where,
    orderBy: {
      placedAt: "desc",
    },
    skip: pagination.skip,
    take: pagination.limit,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      deliveryMethod: true,
      deliveryLabel: true,
      totalCents: true,
      placedAt: true,
      customerName: true,
      items: {
        take: 2,
        orderBy: {
          productName: "asc",
        },
        select: {
          id: true,
          productName: true,
          quantity: true,
        },
      },
    },
  });

  return {
    orders,
    pagination,
    summary,
  };
}

export async function updateOrderStatus(
  orderId: string,
  input: UpdateOrderStatusInput,
  context: MutationContext,
) {
  const session = await auth();

  if (!session?.user?.role || !hasPermission(session.user.role, "manageStoreOrders")) {
    throw new ForbiddenError("Acesso negado.");
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        items: true,
      },
    });

    if (!current) {
      throw new NotFoundError("Pedido nao encontrado.");
    }

    if (current.status === OrderStatus.CANCELLED && input.status !== OrderStatus.CANCELLED) {
      throw new ConflictError("Pedidos cancelados nao podem ser reativados por esta acao.");
    }

    if (
      input.status === OrderStatus.CANCELLED &&
      current.inventoryRestoredAt === null
    ) {
      for (const item of current.items) {
        await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            stockQuantity: {
              increment: item.quantity,
            },
            status: ProductStatus.ACTIVE,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            orderId: current.id,
            type: InventoryMovementType.ORDER_RESTORE,
            quantityDelta: item.quantity,
            reason: "Reposicao automatica apos cancelamento do pedido",
            note: normalizeOptionalString(input.note),
            performedByUserId: context.userId,
          },
        });
      }
    }

    const order = await tx.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: input.status,
        paymentStatus: input.paymentStatus
          ? (input.paymentStatus as PaymentStatus)
          : input.status === OrderStatus.PAID
            ? PaymentStatus.PAID
            : input.status === OrderStatus.CANCELLED
              ? PaymentStatus.CANCELLED
              : undefined,
        trackingCode: normalizeOptionalString(input.trackingCode),
        paidAt:
          input.status === OrderStatus.PAID && current.paidAt === null
            ? new Date()
            : current.paidAt,
        cancelledAt:
          input.status === OrderStatus.CANCELLED && current.cancelledAt === null
            ? new Date()
            : current.cancelledAt,
        deliveredAt:
          input.status === OrderStatus.DELIVERED && current.deliveredAt === null
            ? new Date()
            : current.deliveredAt,
        inventoryRestoredAt:
          input.status === OrderStatus.CANCELLED && current.inventoryRestoredAt === null
            ? new Date()
            : current.inventoryRestoredAt,
        statusHistory: {
          create: {
            status: input.status,
            note: normalizeOptionalString(input.note),
            changedByUserId: context.userId,
          },
        },
      },
    });

    await logAuditEvent({
      request: context.request,
      actorId: context.userId,
      action: "STORE_ORDER_STATUS_UPDATED",
      entityType: "Order",
      entityId: order.id,
      summary: `Pedido ${order.orderNumber} atualizado para ${input.status}.`,
      beforeData: {
        status: current.status,
        paymentStatus: current.paymentStatus,
      },
      afterData: {
        status: order.status,
        paymentStatus: order.paymentStatus,
        trackingCode: order.trackingCode,
      },
    });

    return order;
  });
}

export async function refundStoreOrder(
  orderId: string,
  context: MutationContext,
) {
  const session = await auth();

  if (!session?.user?.role || !hasPermission(session.user.role, "manageStoreOrders")) {
    throw new ForbiddenError("Acesso negado.");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      checkoutPayment: true,
    },
  });

  if (!order) {
    throw new NotFoundError("Pedido nao encontrado.");
  }

  if (order.paymentStatus !== PaymentStatus.PAID) {
    throw new ConflictError("Apenas pedidos pagos podem ser estornados.");
  }

  const checkoutPayment = order.checkoutPayment;

  if (!checkoutPayment?.providerPaymentId) {
    throw new ConflictError(
      "Este pedido nao possui um identificador de pagamento no gateway para estorno.",
    );
  }

  await refundMercadoPagoPayment(checkoutPayment.providerPaymentId);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.REFUNDED,
        statusHistory: {
          create: {
            status: order.status,
            note: "Estorno processado pelo administrador.",
            changedByUserId: context.userId,
          },
        },
      },
    });

    await tx.checkoutPayment.update({
      where: { id: checkoutPayment.id },
      data: { status: PaymentStatus.REFUNDED },
    });
  });

  await logAuditEvent({
    request: context.request,
    actorId: context.userId,
    action: "STORE_ORDER_REFUNDED",
    entityType: "Order",
    entityId: orderId,
    summary: `Estorno processado para o pedido ${order.orderNumber}.`,
    afterData: {
      orderNumber: order.orderNumber,
      paymentStatus: PaymentStatus.REFUNDED,
      providerPaymentId: checkoutPayment.providerPaymentId,
    },
  });

  return { orderId, orderNumber: order.orderNumber };
}
