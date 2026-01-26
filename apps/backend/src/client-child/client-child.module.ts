import { Module } from '@nestjs/common';
import { ClientChildService } from './client-child.service';
import { AuthModule } from '../auth/auth.module';
import { ChildrenController } from './children.controller';

@Module({
  imports: [AuthModule],
  controllers: [ChildrenController],
  providers: [ClientChildService],
})
export class ClientChildModule {}
