import { Equals } from 'class-validator';

// RF-13: la activación exige confirmación explícita
export class ActivateModuleDto {
  @Equals(true, { message: 'Confirma la activación enviando "confirm": true' })
  confirm: boolean;
}
