import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Child } from '../prisma/generated/client';
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
import { CreateClientResponse } from './dto/client-child.dto';
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
      throw new NotFoundException(`Client with ID ${data.clientId} nod found`);
    }

    const child = (await this.prisma.child.create({
      data: { name: data.name, clientId: data.clientId },
    })) as Child;

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
    const child = await this.prisma.child.update({
      where: { id: childId },
      data: {
        name: data.name,
      },
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
        data: { deleteAt: new Date() },
      })
      .catch(() => {
        throw new NotFoundException(`Child with ID ${childId} not found`);
      });
  }

  async createClient(
    data: CreateClientRequestDto,
  ): Promise<CreateClientResponseDto> {
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
        data: { deleteAt: new Date() },
      })
      .catch(() => {
        throw new NotFoundException(`Client with ID ${clientId} not found`);
      });
  }

  async searchClients(query: string): Promise<CreateClientResponse[]> {
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
        deleteAt: null,
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
          select: { name: true },
        },
      },
      take: 10,
    });

    return clients.map((client) => ({
      clientId: client.id,
      name: client.name,
      phone: client.phone,
      children: client.children.map((child) => child.name),
    }));
  }
}
