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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientChildService } from './client-child.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import {
  CreateClientRequest,
  UpdateClientRequest,
} from './dto/client-child.dto';
import {
  CreateClientResponseDto,
  UpdateClientResponseDto,
} from '@costumes/shared';
import { SearchSchemaDto } from '../common/dto/seacrh.dto';

@Controller('clients')
export class ClientController {
  constructor(private readonly clientChildService: ClientChildService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createClient(
    @Body() dto: CreateClientRequest,
  ): Promise<CreateClientResponseDto> {
    return await this.clientChildService.createClient(dto);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchClients(@Query() query: SearchSchemaDto) {
    return await this.clientChildService.searchClients(query.q);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateClient(
    @Param('id', ParseIntPipe) clientId: number,
    @Body() dto: UpdateClientRequest,
  ): Promise<UpdateClientResponseDto> {
    return await this.clientChildService.updateClient(dto, clientId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClient(@Param('id', ParseIntPipe) clientId: number) {
    await this.clientChildService.deleteClient(clientId);
  }
}
