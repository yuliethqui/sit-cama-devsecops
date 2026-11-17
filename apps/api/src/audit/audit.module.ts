import { Controller, Get, Module, Query, Req, UseGuards } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuditQuery } from './audit.dto';
import { AuditService } from './audit.service';

@Controller('audit/events') @UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get() @Roles('AUDITOR')
  list(@Query() query: AuditQuery, @Req() request: { user: AuthenticatedUser; ip?: string }) {
    return this.service.list(query, request.user.id, request.ip ?? null);
  }
}
@Module({ imports: [AuthModule, RealtimeModule], controllers: [AuditController], providers: [AuditService] })
export class AuditModule {}
