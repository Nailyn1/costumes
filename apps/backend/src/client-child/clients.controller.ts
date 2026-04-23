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
import { ClientChildService } from './client-child.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import {
  AddClientInBlacklistRequest,
  CreateClientRequest,
  UpdateClientRequest,
} from './dto/client-child.dto';
import {
  CreateClientResponseDto,
  GetDetailedClientResponseDto,
  GetListClientResponseDto,
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

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async getClientList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 2,
  ): Promise<GetListClientResponseDto> {
    return await this.clientChildService.listClients(page, limit);
  }

  @Get('detail/:clientId')
  @UseGuards(JwtAuthGuard)
  async getDetailedClient(
    @Param('clientId', ParseIntPipe) clientId: number,
  ): Promise<GetDetailedClientResponseDto> {
    return await this.clientChildService.detailedClient(clientId);
  }

  @Post(':clientId/blacklist')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async addClientToBlacklist(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() body: AddClientInBlacklistRequest,
  ): Promise<void> {
    await this.clientChildService.addClientToBlacklist(clientId, body);
  }

  @Delete(':clientId/blacklist')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeClientFromBlacklist(
    @Param('clientId', ParseIntPipe) clientId: number,
  ): Promise<void> {
    await this.clientChildService.removeClientFromBlacklist(clientId);
  }
}
