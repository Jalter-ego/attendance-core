import { Controller, Get, Global, Module } from '@nestjs/common';
import { Public } from '../modules/auth/auth.decorators';
import { InstitutionService } from './institution.service';

@Controller('institution')
class InstitutionController {
  constructor(private readonly institution: InstitutionService) {}

  @Public()
  @Get()
  get() {
    return this.institution.summary();
  }
}

@Global()
@Module({
  controllers: [InstitutionController],
  providers: [InstitutionService],
  exports: [InstitutionService],
})
export class InstitutionModule {}
