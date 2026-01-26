import {
  Body,
  Controller,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClientChildService } from './client-child.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { CreateChildRequest, UpdateChildRequest } from './dto/client-child.dto';
import {
  CreateChildResponsetDto,
  UpdateChildResponseDto,
} from '@costumes/shared';

@Controller('children')
export class ChildrenController {
  constructor(private readonly clientChildService: ClientChildService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createChild(
    @Body() dto: CreateChildRequest,
  ): Promise<CreateChildResponsetDto> {
    return await this.clientChildService.createChild(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateChild(
    @Param('id', ParseIntPipe) childId: number,
    @Body() dto: UpdateChildRequest,
  ): Promise<UpdateChildResponseDto> {
    return await this.clientChildService.updateChild(dto, childId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChild(@Param('id', ParseIntPipe) childId: number) {
    await this.clientChildService.deleteChild(childId);
  }
}
