import { Module } from '@nestjs/common';
import { ClientChildService } from './client-child.service';
import { AuthModule } from '../auth/auth.module';
import { ChildrenController } from './children.controller';
import { ClientController } from './clients.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [ChildrenController, ClientController],
  providers: [ClientChildService],
})
export class ClientChildModule {}
