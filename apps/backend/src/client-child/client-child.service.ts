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

    const { id: clientId, name, phone } = client;
    return {
      clientId,
      name,
      phone,
      children: [],
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

    const { name, phone } = client;
    return {
      clientId,
      name,
      phone,
      children: [],
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
    }));
  }
}
