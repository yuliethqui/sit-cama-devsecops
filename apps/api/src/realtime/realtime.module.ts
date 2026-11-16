import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessService } from './access.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({ imports: [AuthModule], providers: [AccessService, RealtimeGateway], exports: [AccessService, RealtimeGateway] })
export class RealtimeModule {}
