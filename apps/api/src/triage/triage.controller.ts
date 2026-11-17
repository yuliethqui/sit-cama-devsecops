import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TriageDto } from './triage.dto';
import { classifyTriage } from './triage.engine';

@Controller('triage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TriageController {
  @Post('preview')
  @Roles('ENFERMERO', 'MEDICO')
  preview(@Body() input: TriageDto) {
    return classifyTriage(input);
  }
}
