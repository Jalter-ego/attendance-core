import { Transform } from 'class-transformer';
import { IsOptional, IsUUID, Matches } from 'class-validator';
import { DATE_PATTERN, trimToUndefined } from '../../../common/dto/query-transforms';

// RF-08: filtros opcionales y combinables
export class AttendanceOverviewQuery {
  @Transform(trimToUndefined)
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'date debe tener el formato AAAA-MM-DD' })
  date?: string;

  @Transform(trimToUndefined)
  @IsOptional()
  @IsUUID('all', { message: 'studentId debe ser un id válido' })
  studentId?: string;
}
