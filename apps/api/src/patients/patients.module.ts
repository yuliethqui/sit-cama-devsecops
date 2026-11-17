import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PatientDataService } from './patient-data.service';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [AuthModule, RealtimeModule], controllers: [PatientsController], providers: [PatientsService, PatientDataService],
})
export class PatientsModule {}
