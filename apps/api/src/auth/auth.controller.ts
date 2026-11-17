import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}
  @Post('login') @HttpCode(200)
  login(@Body() data: LoginDto) { return this.service.login(data.email, data.password); }
}
