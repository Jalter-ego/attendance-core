import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { AllowOnly, CurrentUser } from '../auth/auth.decorators';
import type { AdminPrincipal } from '../auth/types/auth-principal';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './repo/user.service';

@AllowOnly('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@CurrentUser() admin: AdminPrincipal, @Body() dto: CreateUserDto) {
    return this.usersService.create(dto, admin);
  }

  @Get()
  list(@CurrentUser() admin: AdminPrincipal) {
    return this.usersService.findAll(admin);
  }

  @Get(':id')
  findOne(@CurrentUser() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id, admin);
  }

  @Patch(':id')
  update(
    @CurrentUser() admin: AdminPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto, admin);
  }

  @Put(':id')
  replace(
    @CurrentUser() admin: AdminPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto, admin);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() admin: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id, admin);
  }
}
