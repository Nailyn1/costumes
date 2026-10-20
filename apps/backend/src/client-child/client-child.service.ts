import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateChildRequestDto,
  UpdateChildRequestDto,
  CreateChildResponsetDto,
  UpdateChildResponseDto,
  CreateClientRequestDto,
  CreateClientResponseDto,
  UpdateClientRequestDto,
  UpdateClientResponseDto,
  GetListClientResponseDto,
  GetDetailedClientResponseDto,
  AddClientInBlackListRequestDto,
} from '@costumes/shared';
import { Prisma } from '../prisma/generated/client';
import { NotificationRepository } from '../notification/notification.repository';
import {
  buildPhoneFilters,
  buildWordStartFilters,
  isSearchQueryReady,
  maxScore,
  normalizeSearchQuery,
  scorePhoneMatch,
  scoreTextMatch,
  sortBySearchScore,
} from '../common/utils/search.utils';

function isPhoneUniqueConstraintViolation(error: unknown): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  if (!('meta' in error) || typeof error.meta !== 'object' || !error.meta) {
    return true;
  }

  if (!('target' in error.meta)) return true;
  const target = error.meta.target;
  const targets = Array.isArray(target) ? target : [target];
  return targets.some(
    (field) =>
      field === 'phone' ||
      (typeof field === 'string' && field.includes('clients_phone_key')),
  );
}

const DUPLICATE_CLIENT_PHONE_MESSAGE =
  'Клиент с таким телефоном уже существует';

@Injectable()
export class ClientChildService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async getActiveClientPhone(clientId: number): Promise<string> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { phone: true },
    });
    if (!client)
      throw new NotFoundException(`Клиент с ID ${clientId} не найден`);
    return client.phone;
  }

  async createChild(
    data: CreateChildRequestDto,
  ): Promise<CreateChildResponsetDto> {
    const client = await this.prisma.client.findUnique({
      where: { id: data.clientId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException(`Клиент с ID ${data.clientId} не найден`);
    }

    const child = await this.prisma.child.create({
      data: { name: data.name, clientId: data.clientId },
    });

    const response = {
      childId: child.id,
      name: child.name,
      clientId: child.clientId,
    };
    return response;
  }

  async updateChild(
    data: UpdateChildRequestDto,
    childId: number,
  ): Promise<UpdateChildResponseDto> {
    const child = await this.prisma.child
      .update({
        where: { id: childId, deletedAt: null },
        data: {
          name: data.name,
        },
      })
      .catch((err) => {
        if (err.code === 'P2025') {
          throw new NotFoundException(`Ребенок с ID ${childId} не найден`);
        }
        throw err;
      });

    const response = {
      childId: child.id,
      name: child.name,
    };
    return response;
  }

  async deleteChild(childId: number): Promise<void> {
    await this.prisma.child
      .update({
        where: { id: childId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      .catch(() => {
        throw new NotFoundException(`Ребенок с ID ${childId} не найден`);
      });
  }

  async createClient(
    data: CreateClientRequestDto,
  ): Promise<CreateClientResponseDto> {
    const existingClient = await this.prisma.client.findFirst({
      where: {
        phone: data.phone,
        deletedAt: null,
      },
    });
    if (existingClient) {
      throw new ConflictException(DUPLICATE_CLIENT_PHONE_MESSAGE);
    }
    const client = await this.prisma.client
      .create({ data: { name: data.name, phone: data.phone } })
      .catch((error: unknown) => {
        if (isPhoneUniqueConstraintViolation(error)) {
          throw new ConflictException(DUPLICATE_CLIENT_PHONE_MESSAGE);
        }
        throw error;
      });

    const { id: clientId, name, phone, isBlacklisted } = client;
    return {
      clientId,
      name,
      phone,
      children: [],
      isBlacklisted,
      whatsappConfirmed: false,
    };
  }

  async updateClient(
    data: UpdateClientRequestDto,
    clientId: number,
  ): Promise<UpdateClientResponseDto> {
    if (data.phone) {
      const existingClient = await this.prisma.client.findFirst({
        where: {
          phone: data.phone,
          deletedAt: null,
          id: { not: clientId },
        },
      });
      if (existingClient) {
        throw new ConflictException(DUPLICATE_CLIENT_PHONE_MESSAGE);
      }
    }

    const client = await this.prisma.client
      .update({
        where: { id: clientId, deletedAt: null },
        data: {
          name: data.name,
          phone: data.phone,
        },
      })
      .catch((err) => {
        if (err.code === 'P2025') {
          throw new NotFoundException(`Клиент с ID ${clientId} не найден`);
        }
        if (isPhoneUniqueConstraintViolation(err)) {
          throw new ConflictException(DUPLICATE_CLIENT_PHONE_MESSAGE);
        }
        throw err;
      });

    const { name, phone, isBlacklisted } = client;
    return {
      clientId,
      name,
      phone,
      children: [],
      isBlacklisted,
      whatsappConfirmed: false,
    };
  }

  async deleteClient(clientId: number): Promise<void> {
    await this.prisma.client
      .update({
        where: { id: clientId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      .catch(() => {
        throw new NotFoundException(`Клиент с ID ${clientId} не найден`);
      });
  }

  async searchClients(query: string): Promise<CreateClientResponseDto[]> {
    const search = normalizeSearchQuery(query);
    if (!isSearchQueryReady(search)) return [];

    const nameFilters = buildWordStartFilters(search);
    const phoneFilters = buildPhoneFilters(search);

    const searchFilters: Prisma.ClientWhereInput[] = [
      ...nameFilters.map((filter) => ({ name: filter })),
      ...phoneFilters.map((filter) => ({ phone: filter })),
      ...nameFilters.map((filter) => ({
        children: {
          some: {
            deletedAt: null,
            name: filter,
          },
        },
      })),
    ];

    const clients = await this.prisma.client.findMany({
      where: {
        deletedAt: null,
        OR: searchFilters,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        children: {
          where: { deletedAt: null },
          select: { name: true, id: true },
        },
        isBlacklisted: true,
      },
      take: 30,
    });

    const matches = sortBySearchScore(clients, (client) =>
      maxScore([
        scoreTextMatch(client.name, search),
        scorePhoneMatch(client.phone, search),
        ...client.children.map((child) => scoreTextMatch(child.name, search)),
      ]),
    ).slice(0, 10);
    const confirmedIds =
      await this.notificationRepository.findClientIdsWithConfirmedWhatsapp(
        matches.map((client) => client.id),
      );
    return matches.map((client) => ({
      clientId: client.id,
      name: client.name,
      phone: client.phone,
      children: client.children?.map((child) => ({
        childId: child.id,
        name: child.name,
      })),
      isBlacklisted: client.isBlacklisted,
      whatsappConfirmed: confirmedIds.has(client.id),
    }));
  }

  async listClients(
    page: number = 1,
    limit: number = 20,
  ): Promise<GetListClientResponseDto> {
    const skip = (page - 1) * limit;

    const [rawClients, total, totalOrders] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          isBlacklisted: true,
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.client.count({
        where: { deletedAt: null },
      }),
      this.prisma.order.count({
        where: { deletedAt: null },
      }),
    ]);

    const items = rawClients.map((client) => ({
      clientId: client.id,
      name: client.name,
      phone: client.phone,
      isBlacklisted: client.isBlacklisted,
    }));

    return {
      items,
      totalOrders,
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    };
  }

  async detailedClient(
    clientId: number,
  ): Promise<GetDetailedClientResponseDto> {
    const clientData = await this.prisma.client.findUnique({
      where: {
        id: clientId,
        deletedAt: null,
      },
      include: {
        children: {
          where: { deletedAt: null },
        },
        visits: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            orders: {
              where: { deletedAt: null },
              include: {
                costume: true,
                child: true,
              },
            },
          },
        },
      },
    });

    if (!clientData) {
      throw new NotFoundException(`Клиент с ID ${clientId} не найден`);
    }

    const confirmedIds =
      await this.notificationRepository.findClientIdsWithConfirmedWhatsapp([
        clientId,
      ]);

    const visits = clientData.visits.map((visit) => {
      return {
        visitId: visit.id,
        visitCode: visit.visitCode,
        visitStatus: visit.status,
        createdAt: visit.createdAt.toISOString(),
        startDateTime: visit.startDateTime.toISOString().split('T')[0],
        endDateTime: visit.endDateTime.toISOString().split('T')[0],
        issueTimeFrom: visit.issueTimeFrom,
        returnTimeUntil: visit.returnTimeUntil,
        visitNote: visit.notes || undefined,
        orders: visit.orders.map((order) => ({
          orderId: order.id,
          costumeName: order.costume.name,
          inventoryCode: order.costume.inventoryCode,
          childName: order.child.name,
          orderStatus: order.status,
          rentPrice: order.rentPrice,
          prepaymentAmount: order.prepaymentAmount,
          finalPayment: order.finalPayment || undefined,
        })),
      };
    });

    return {
      client: {
        clientId: clientData.id,
        name: clientData.name,
        phone: clientData.phone,
        isBlacklisted: clientData.isBlacklisted,
        whatsappConfirmed: confirmedIds.has(clientId),
        blacklistReason: clientData.blacklistReason || undefined,
        children: clientData.children.map((child) => ({
          childId: child.id,
          name: child.name,
        })),
      },
      visits,
    };
  }
  async addClientToBlacklist(
    clientId: number,
    body: AddClientInBlackListRequestDto,
  ): Promise<void> {
    await this.prisma.client
      .update({
        where: { id: clientId, deletedAt: null },
        data: {
          isBlacklisted: true,
          blacklistReason: body.blacklistReason,
        },
      })
      .catch(() => {
        throw new NotFoundException(`Клиент с ID ${clientId} не найден`);
      });
  }

  async removeClientFromBlacklist(clientId: number): Promise<void> {
    await this.prisma.client
      .update({
        where: { id: clientId, deletedAt: null },
        data: {
          isBlacklisted: false,
          blacklistReason: null,
        },
      })
      .catch(() => {
        throw new NotFoundException(`Клиент с ID ${clientId} не найден`);
      });
  }
}
