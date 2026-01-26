import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Child } from '../prisma/generated/client';
import {
  CreateChildRequestDto,
  UpdateChildRequestDto,
  CreateChildResponsetDto,
  UpdateChildResponseDto,
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
}
