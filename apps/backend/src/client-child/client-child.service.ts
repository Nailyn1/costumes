import {
  BadRequestException,
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

@Injectable()
export class ClientChildService {
  constructor(private readonly prisma: PrismaService) {}

  async createChild(
    data: CreateChildRequestDto,
  ): Promise<CreateChildResponsetDto> {
    const client = await this.prisma.client.findUnique({
      where: { id: data.clientId },
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
        where: { id: childId },
        data: {
          name: data.name,
        },
      })
      .catch((err) => {
        if (err.code === 'P2025') {
          throw new NotFoundException(`Ребенок с этим ID ${childId} не найден`);
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
        where: { id: childId },
        data: { deletedAt: new Date() },
      })
      .catch(() => {
        throw new NotFoundException(`Ребенок с этим ID ${childId} не найден`);
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
      throw new BadRequestException('Client with this phone already exists');
    }
    const client = await this.prisma.client.create({
      data: { name: data.name, phone: data.phone },
    });

    const { id: clientId, name, phone, isBlacklisted } = client;
    return {
      clientId,
      name,
      phone,
      children: [],
      isBlacklisted,
    };
  }

  async updateClient(
    data: UpdateClientRequestDto,
    clientId: number,
  ): Promise<UpdateClientResponseDto> {
    const client = await this.prisma.client
      .update({
        where: { id: clientId },
        data: {
          name: data.name,
          phone: data.phone,
        },
      })
      .catch((err) => {
        if (err.code === 'P2025') {
          throw new NotFoundException(`Client with id ${clientId} not found`);
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
    };
  }

  async deleteClient(clientId: number): Promise<void> {
    await this.prisma.client
      .update({
        where: { id: clientId },
        data: { deletedAt: new Date() },
      })
      .catch(() => {
        throw new NotFoundException(`Client with ID ${clientId} not found`);
      });
  }

  async searchClients(query: string): Promise<CreateClientResponseDto[]> {
    if (!query || query.length < 2) return [];

    let normalizedQuery = query;
    if (query.startsWith(' ') && /^\d/.test(query.trim())) {
      normalizedQuery = '+' + query.trim();
    } else {
      normalizedQuery = query.trim();
    }

    const onlyDigits = normalizedQuery.replace(/\D/g, '');

    const clients = await this.prisma.client.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: normalizedQuery, mode: 'insensitive' } },

          { phone: { contains: normalizedQuery } },

          ...(onlyDigits.length >= 2
            ? [{ phone: { contains: onlyDigits } }]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        children: {
          select: { name: true, id: true },
        },
        isBlacklisted: true,
      },
      take: 10,
    });

    return clients.map((client) => ({
      clientId: client.id,
      name: client.name,
      phone: client.phone,
      children: client.children?.map((child) => ({
        childId: child.id,
        name: child.name,
      })),
      isBlacklisted: client.isBlacklisted,
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
        where: { id: clientId },
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
        where: { id: clientId },
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
