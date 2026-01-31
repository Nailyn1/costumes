import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CostumesService } from './costumes.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import {
  CreateCostumesRequest,
  UpdateCostumesRequest,
} from './dto/costumes.dto';
import { CreateUpdateCostumesResponseDto } from '@costumes/shared';

@Controller('costumes')
export class CostumesController {
  constructor(private readonly costumesService: CostumesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async costumeCreate(
    @Body() dto: CreateCostumesRequest,
  ): Promise<CreateUpdateCostumesResponseDto> {
    return this.costumesService.createCostume(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateCostume(
    @Param('id', ParseIntPipe) costumeId: number,
    @Body() dto: UpdateCostumesRequest,
  ): Promise<CreateUpdateCostumesResponseDto> {
    return await this.costumesService.updateCostume(dto, costumeId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClient(@Param('id', ParseIntPipe) costumeId: number) {
    await this.costumesService.deleteCostume(costumeId);
  }
}
