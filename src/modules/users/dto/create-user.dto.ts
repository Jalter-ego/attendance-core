import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../repo/user.model';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateUserDto {
  @Transform(trim)
  @IsString({ message: 'Indica el nombre del usuario' })
  @IsNotEmpty({ message: 'Indica el nombre del usuario' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  name: string;

  @Transform(trim)
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @MaxLength(255, { message: 'El correo no puede superar 255 caracteres' })
  email: string;

  @IsString({ message: 'Ingresa una contraseña' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(100, { message: 'La contraseña no puede superar 100 caracteres' })
  password: string;

  @Transform(trim)
  @IsOptional()
  @IsIn(['owner', 'admin', 'superadmin'], {
    message: 'El rol debe ser owner, admin o superadmin',
  })
  role?: UserRole;

  @Transform(trim)
  @IsOptional()
  @IsUUID('4', { message: 'El tenantId debe ser un UUID válido' })
  tenantId?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser un valor booleano' })
  isActive?: boolean;
}
