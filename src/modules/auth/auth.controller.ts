import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { CurrentUser, Public } from './auth.decorators';
import { AdminLoginDto } from './dto/admin-login.dto';
import { StudentLoginDto } from './dto/student-login.dto';
import { AuthService } from './repo/auth.service';
import type { AuthPrincipal } from './types/auth-principal';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  loginAdmin(@Body() dto: AdminLoginDto, @Ip() ip: string) {
    return this.authService.loginAdmin(dto, ip);
  }

  @Public()
  @Post('student/login')
  @HttpCode(HttpStatus.OK)
  loginStudent(@Body() dto: StudentLoginDto, @Ip() ip: string) {
    return this.authService.loginStudent(dto, ip);
  }

  @Get('me')
  me(@CurrentUser() principal: AuthPrincipal) {
    return this.authService.me(principal);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() principal: AuthPrincipal, @Ip() ip: string) {
    return this.authService.logout(principal, ip);
  }
}
