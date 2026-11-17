import { Transform, Type } from 'class-transformer';
import { IsDefined, IsObject, IsString, Length, Matches, ValidateNested } from 'class-validator';
import { TriageDto } from '../triage/triage.dto';

const trim = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim() : value;

export class PatientSearchDto {
  @Transform(trim)
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9.-]{2,39}$/)
  document!: string;
}

export class RecordTriageDto extends TriageDto {
  @Transform(trim)
  @IsString()
  @Length(1, 1000)
  @Matches(/\S/)
  chiefComplaint!: string;
}

export class RegisterPatientDto extends PatientSearchDto {
  @Transform(trim)
  @IsString()
  @Length(2, 160)
  @Matches(/^[^\x00-\x1f\x7f]+$/)
  fullName!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RecordTriageDto)
  triage!: RecordTriageDto;
}
