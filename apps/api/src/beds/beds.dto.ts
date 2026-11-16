import { IsDateString, IsIn, IsUUID } from 'class-validator';

export const BED_SERVICES = ['URGENCIAS_ADULTOS', 'URGENCIAS_PEDIATRICAS', 'OBSERVACION', 'AISLAMIENTO'] as const;
export type BedService = (typeof BED_SERVICES)[number];
export class AssignBedDto {
  @IsUUID('4') patientId!: string;
  @IsIn(BED_SERVICES) service!: BedService;
}
export class ReleaseBedDto {
  @IsUUID('4') assignmentId!: string;
}
export class CompleteCleaningDto {
  @IsDateString({ strict: true }) expectedUpdatedAt!: string;
}
