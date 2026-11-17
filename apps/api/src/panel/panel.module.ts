import { Controller, Get, Module, Query, Req, UseGuards } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';
import { PanelQuery } from './panel.dto';
import { PanelService } from './panel.service';

@Controller('triage/panel') @UseGuards(JwtAuthGuard, RolesGuard)
export class PanelController {
  constructor(private readonly service: PanelService) {}
  @Get() @Roles('MEDICO')
  list(@Query() query: PanelQuery, @Req() request: { user: AuthenticatedUser; ip?: string }) {
    return this.service.list(query, request.user.id, request.ip ?? null);
  }
}
@Module({ imports: [AuthModule, RealtimeModule], controllers: [PanelController], providers: [PanelService] })
export class PanelModule {}
