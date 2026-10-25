import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  CostumeCategoryDto,
  CostumeCategoryNodeDto,
} from '@costumes/shared';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { CostumeCategoriesService } from './costume-categories.service';
import {
  CreateCostumeCategoryRequest,
  UpdateCostumeCategoryRequest,
} from './dto/costume-categories.dto';

@Controller('costume-categories')
export class CostumeCategoriesController {
  constructor(private readonly categories: CostumeCategoriesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(): Promise<CostumeCategoryNodeDto[]> {
    return this.categories.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateCostumeCategoryRequest,
  ): Promise<CostumeCategoryDto> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateCostumeCategoryRequest,
  ): Promise<CostumeCategoryDto> {
    return this.categories.update(categoryId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) categoryId: number): Promise<void> {
    await this.categories.remove(categoryId);
  }
}
