import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
export const AUDIT_ACTIONS = ['REGISTER_PATIENT','RECORD_TRIAGE','SEARCH_PATIENT','READ_TRIAGE',
  'ASSIGN_BED','RELEASE_BED','COMPLETE_CLEANING','READ_BED_ASSIGNMENT','READ_TRIAGE_PANEL','READ_AUDIT'];
export const AUDIT_ENTITIES = ['patient','triage','bed','panel','audit'];
export class AuditQuery {
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @IsOptional() @IsUUID('4') actorId?: string;
  @IsOptional() @IsIn(AUDIT_ACTIONS) action?: string;
  @IsOptional() @IsIn(AUDIT_ENTITIES) entityType?: string;
  @IsOptional() @Matches(/^[1-9][0-9]{0,18}$/) cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
