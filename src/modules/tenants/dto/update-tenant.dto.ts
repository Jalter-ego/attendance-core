import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TenantStatus } from '../repo/tenant.model';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateTenantDto {
  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'Indica el nombre del tenant' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'Indica el slug del tenant' })
  @MaxLength(60, { message: 'El slug no puede superar 60 caracteres' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'El slug solo puede contener letras minúsculas, números y guiones',
  })
  slug?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'La zona horaria no puede superar 64 caracteres' })
  timezone?: string;

  @Transform(trim)
  @IsOptional()
  @IsIn(['active', 'suspended'], { message: 'El estado debe ser active o suspended' })
  status?: TenantStatus;
}
