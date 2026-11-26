import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CostumesService } from './costumes.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import {
  CreateCostumeCategoryRequest,
  CreateCostumesRequest,
  UpdateCostumeCategoryRequest,
  UpdateCostumesRequest,
} from './dto/costumes.dto';
import { CostumeFiltersQuery } from './dto/costume-filters.dto';
import {
  CostumeCategoryDto,
  CostumeCategoryNodeDto,
  CostumesListResponseDto,
  CostumesSearchAvailableResponseDto,
  CostumesSearchResponseDto,
  CreateUpdateCostumesResponseDto,
} from '@costumes/shared';

@Controller()
export class CostumesController {
  constructor(private readonly costumesService: CostumesService) {}

  @Post('costumes')
  @UseGuards(JwtAuthGuard)
  async costumeCreate(
    @Body() dto: CreateCostumesRequest,
  ): Promise<CreateUpdateCostumesResponseDto> {
    return this.costumesService.createCostume(dto);
  }

  @Patch('costumes/:id')
  @UseGuards(JwtAuthGuard)
  async updateCostume(
    @Param('id', ParseIntPipe) costumeId: number,
    @Body() dto: UpdateCostumesRequest,
  ): Promise<CreateUpdateCostumesResponseDto> {
    return await this.costumesService.updateCostume(dto, costumeId);
  }

  @Get('costumes/search')
  @UseGuards(JwtAuthGuard)
  async searchCostume(
    @Query('q') q: string,
    @Query() filters: CostumeFiltersQuery,
  ): Promise<CostumesSearchResponseDto[]> {
    if (!q || q.length < 2) return [];
    return await this.costumesService.searchCostume(q, filters);
  }

  @Get('costumes/search-available')
  @UseGuards(JwtAuthGuard)
  async searchCostumeAvailable(
    @Query('q') q: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('excludeVisitId') excludeVisitId: string | undefined,
    @Query() filters: CostumeFiltersQuery,
  ): Promise<CostumesSearchAvailableResponseDto[]> {
    return await this.costumesService.searchCostumeAvailable(
      q,
      startDate,
      endDate,
      excludeVisitId,
      filters,
    );
  }

  @Delete('costumes/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClient(@Param('id', ParseIntPipe) costumeId: number) {
    await this.costumesService.deleteCostume(costumeId);
  }

  @Get('costumes/:costumeId/availability')
  @UseGuards(JwtAuthGuard)
  async costumesAvailability(
    @Param('costumeId', ParseIntPipe) costumeId: number,
  ) {
    return await this.costumesService.costumesAvailability(costumeId);
  }

  @Get('costumes/list')
  @UseGuards(JwtAuthGuard)
  async costumesList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
    @Query() filters: CostumeFiltersQuery,
  ): Promise<CostumesListResponseDto> {
    return await this.costumesService.getCostumesList(page, limit, filters);
  }

  @Get('costume-categories')
  @UseGuards(JwtAuthGuard)
  async listCategories(): Promise<CostumeCategoryNodeDto[]> {
    return this.costumesService.listCategories();
  }

  @Post('costume-categories')
  @UseGuards(JwtAuthGuard)
  async createCategory(
    @Body() dto: CreateCostumeCategoryRequest,
  ): Promise<CostumeCategoryDto> {
    return this.costumesService.createCategory(dto);
  }

  @Patch('costume-categories/:id')
  @UseGuards(JwtAuthGuard)
  async updateCategory(
    @Param('id', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateCostumeCategoryRequest,
  ): Promise<CostumeCategoryDto> {
    return this.costumesService.updateCategory(categoryId, dto);
  }

  @Delete('costume-categories/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(
    @Param('id', ParseIntPipe) categoryId: number,
  ): Promise<void> {
    await this.costumesService.deleteCategory(categoryId);
  }
}
