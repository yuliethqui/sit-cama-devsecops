import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './auth/auth.module';
import { BedsModule } from './beds/beds.module';
import { TriageModule } from './triage/triage.module';
import { PatientsModule } from './patients/patients.module';
import { PanelModule } from './panel/panel.module';
import { AuditModule } from './audit/audit.module';

@Controller('health')
class HealthController {
  @Get()
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'sit-cama-api' };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, AuthModule, BedsModule, TriageModule, PatientsModule, PanelModule, AuditModule],
  controllers: [HealthController],
})
export class AppModule {}
