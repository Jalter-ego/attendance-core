import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateModuleDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Indica el nombre del módulo' })
  @IsNotEmpty({ message: 'Indica el nombre del módulo' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  name: string;
}
