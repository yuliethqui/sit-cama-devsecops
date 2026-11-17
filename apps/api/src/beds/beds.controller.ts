import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BedsService, BedStatus } from './beds.service';
import { AssignBedDto, CompleteCleaningDto, ReleaseBedDto } from './beds.dto';

interface BedRequest { user: AuthenticatedUser; ip?: string }

@Controller('beds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BedsController {
  constructor(private readonly service: BedsService) {}

  @Get()
  @Roles('ENFERMERO', 'MEDICO', 'ADMISIONES', 'COORDINADOR', 'SERVICIOS', 'AUDITOR')
  list(@Query('service') service?: string, @Query('status') status?: BedStatus) {
    return this.service.list(service, status);
  }

  @Post(':code/complete-cleaning')
  @Roles('SERVICIOS')
  completeCleaning(@Param('code') code: string, @Body() input: CompleteCleaningDto, @Req() request: BedRequest) {
    return this.service.completeCleaning(code, input.expectedUpdatedAt, request.user.id, request.ip ?? null);
  }

  @Post(':code/assign')
  @Roles('MEDICO')
  assign(@Param('code') code: string, @Body() input: AssignBedDto, @Req() request: BedRequest) {
    return this.service.assign(code, input, request.user.id, request.ip ?? null);
  }

  @Get(':code/assignment')
  @Roles('MEDICO')
  assignment(@Param('code') code: string, @Req() request: BedRequest) {
    return this.service.assignment(code, request.user.id, request.ip ?? null);
  }

  @Post(':code/release')
  @HttpCode(200)
  @Roles('MEDICO')
  release(@Param('code') code: string, @Body() input: ReleaseBedDto, @Req() request: BedRequest) {
    return this.service.release(code, input.assignmentId, request.user.id, request.ip ?? null);
  }
}
