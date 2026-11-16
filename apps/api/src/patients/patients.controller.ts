import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, HttpCode, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PatientSearchDto, RecordTriageDto, RegisterPatientDto } from './patients.dto';
import { PatientsService } from './patients.service';

interface PatientRequest { user: AuthenticatedUser; ip?: string }

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly service: PatientsService) {}

  @Post()
  @Roles('ENFERMERO', 'MEDICO')
  register(@Body() input: RegisterPatientDto, @Req() request: PatientRequest) {
    return this.service.register(input, request.user.id, request.ip ?? null);
  }

  // Exact document search in the body, never in paths/query strings or an unbounded patient listing.
  @Post('search')
  @HttpCode(200)
  @Roles('ADMISIONES', 'ENFERMERO', 'MEDICO')
  search(@Body() input: PatientSearchDto, @Req() request: PatientRequest) {
    return this.service.search(input.document, request.user.id, request.ip ?? null);
  }

  @Post(':patientId/triage')
  @Roles('ENFERMERO', 'MEDICO')
  recordTriage(@Param('patientId', new ParseUUIDPipe({ version: '4' })) patientId: string,
    @Body() input: RecordTriageDto, @Req() request: PatientRequest) {
    return this.service.recordTriage(patientId, input, request.user.id, request.ip ?? null);
  }

  @Get(':patientId/triage/latest')
  @Roles('ENFERMERO', 'MEDICO')
  latestTriage(@Param('patientId', new ParseUUIDPipe({ version: '4' })) patientId: string,
    @Req() request: PatientRequest) {
    return this.service.latestTriage(patientId, request.user.id, request.ip ?? null);
  }
}
