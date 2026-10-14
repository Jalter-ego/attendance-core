import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AdminLoginDto {
  // Slug de la institución
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Indica la institución' })
  tenant: string;

  @Transform(trim)
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  email: string;

  @IsString({ message: 'Ingresa tu contraseña' })
  @IsNotEmpty({ message: 'Ingresa tu contraseña' })
  password: string;
}
