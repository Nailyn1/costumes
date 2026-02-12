import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CostumesSearchResponseDto,
  CreateCostumesRequestDto,
  CreateUpdateCostumesResponseDto,
  UpdateCostumesRequestDto,
} from '@costumes/shared';

@Injectable()
export class CostumesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCostume(
    data: CreateCostumesRequestDto,
  ): Promise<CreateUpdateCostumesResponseDto> {
    const costume = await this.prisma.costume.create({ data });
    const response = {
      costumeId: costume.id,
      name: costume.name,
      inventoryCode: costume.inventoryCode,
    };
    return response;
  }

  async updateCostume(
    data: UpdateCostumesRequestDto,
    costumeId: number,
  ): Promise<CreateUpdateCostumesResponseDto> {
    const costume = await this.prisma.costume
      .update({
        where: { id: costumeId },
        data: {
          name: data.name,
        },
      })
      .catch((err) => {
        if (err.code === 'P2025') {
          throw new NotFoundException(`Costume with id ${costumeId} not found`);
        }
        throw err;
      });

    const { name, inventoryCode } = costume;
    return {
      costumeId,
      name,
      inventoryCode,
    };
  }

  async deleteCostume(costumeId: number): Promise<void> {
    await this.prisma.costume
      .update({
        where: { id: costumeId },
        data: { deletedAt: new Date() },
      })
      .catch(() => {
        throw new NotFoundException(`Costume with ID ${costumeId} not found`);
      });
  }

  async searchCostume(q: string): Promise<CostumesSearchResponseDto[]> {
    const costumes = await this.prisma.costume.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { inventoryCode: { contains: q, mode: 'insensitive' } },
          {
            orders: {
              some: {
                OR: [
                  { child: { name: { contains: q, mode: 'insensitive' } } },
                  {
                    visit: { visitCode: { contains: q, mode: 'insensitive' } },
                  },
                ],
              },
            },
          },
        ],
      },
      take: 20,
    });

    return costumes.map((c) => ({
      costumeId: c.id,
      name: c.name,
      inventoryCode: c.inventoryCode,
      display: `${c.name} (${c.inventoryCode})`,
    }));
  }
}
