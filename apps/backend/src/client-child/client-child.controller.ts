import { Controller } from '@nestjs/common';
import { ClientChildService } from './client-child.service';

@Controller('client-child')
export class ClientChildController {
  constructor(private readonly clientChildService: ClientChildService) {}
}
