import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CostumesSearchAvailableResponseDto,
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

  async searchCostumeAvailable(
    q: string,
    startStr: string,
    endStr: string,
  ): Promise<CostumesSearchAvailableResponseDto[]> {
    const requestedStart = new Date(startStr);
    const requestedEnd = new Date(endStr);

    if (isNaN(requestedStart.getTime()) || isNaN(requestedEnd.getTime())) {
      throw new BadRequestException(
        `Некорректный формат даты. Ожидался ISO 8601 (гггг-мм-ддTчч:мм). Получено: start=${startStr}, end=${endStr}`,
      );
    }

    if (requestedEnd <= requestedStart) {
      throw new BadRequestException(
        'Дата возврата должна быть строго позже даты выдачи',
      );
    }

    const costumes = await this.prisma.costume.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { inventoryCode: { contains: q, mode: 'insensitive' } },
        ],
        deletedAt: null,
      },
      include: {
        orders: {
          where: {
            status: { in: ['reserved', 'issued'] },
            visit: {
              status: { not: 'cancelled' },
              AND: [
                { startDateTime: { lt: requestedEnd } },
                { endDateTime: { gt: requestedStart } },
              ],
            },
          },
          include: {
            visit: true,
          },
        },
      },
      take: 30,
    });

    return costumes.map((c) => ({
      costumeId: c.id,
      name: c.name,
      inventoryCode: c.inventoryCode,
      status: c.orders.length > 0 ? 'issued' : 'available',
    }));
  }
}
