import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TriageController } from './triage.controller';
@Module({ imports: [AuthModule], controllers: [TriageController] })
export class TriageModule {}
