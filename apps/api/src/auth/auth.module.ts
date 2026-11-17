import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [JwtModule.registerAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const secret = config.get<string>('JWT_SECRET');
      if (!secret || secret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
      return { secret, signOptions: { expiresIn: 900, issuer: 'sit-cama-api', audience: 'sit-cama-client' } };
    },
  })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
