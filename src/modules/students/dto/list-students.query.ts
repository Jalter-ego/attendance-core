import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimToUndefined } from '../../../common/dto/query-transforms';

export class ListStudentsQuery {
  // Nombre o número de registro (RF-06)
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'La búsqueda no puede superar 100 caracteres' })
  search?: string;
}
