import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class StudentLoginDto {
  // Slug de la institución
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Indica la institución' })
  tenant: string;

  // Correo electrónico o número de registro (RF-01)
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Ingresa tu correo o número de registro' })
  identifier: string;
}
