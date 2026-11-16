import { IsBoolean, IsInt, Max, Min } from 'class-validator';
export class TriageDto {
  @IsInt() @Min(0) @Max(100) spo2!: number;
  @IsInt() @Min(3) @Max(15) glasgow!: number;
  @IsInt() @Min(0) @Max(10) eva!: number;
  @IsBoolean() paroInminente!: boolean;
  @IsBoolean() dolorToracicoTipico!: boolean;
}
