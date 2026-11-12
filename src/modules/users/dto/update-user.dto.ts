import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../repo/user.model';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateUserDto {
  @Transform(trim)
  @IsOptional()
  @IsString({ message: 'Indica el nombre del usuario' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @MaxLength(255, { message: 'El correo no puede superar 255 caracteres' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Ingresa una contraseña válida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(100, { message: 'La contraseña no puede superar 100 caracteres' })
  password?: string;

  @Transform(trim)
  @IsOptional()
  @IsIn(['owner', 'admin'], {
    message: 'El rol debe ser owner o admin',
  })
  role?: UserRole;

  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser un valor booleano' })
  isActive?: boolean;
}
