import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { DATE_PATTERN, trimToUndefined } from '../../../common/dto/query-transforms';

// RF-10: filtros por estudiante o fecha, con paginación
export class ListActivityLogsQuery {
  @Transform(trimToUndefined)
  @IsOptional()
  @IsUUID('all', { message: 'studentId debe ser un id válido' })
  studentId?: string;

  @Transform(trimToUndefined)
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'date debe tener el formato AAAA-MM-DD' })
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser al menos 1' })
  @Max(200, { message: 'limit no puede superar 200' })
  limit: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset debe ser un número entero' })
  @Min(0, { message: 'offset no puede ser negativo' })
  offset: number = 0;
}
