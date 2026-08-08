import { Injectable } from '@nestjs/common';
import { Role } from '@sportspace/shared';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  register(_dto: RegisterDto): AuthResponseDto {
    return { accessToken: '', refreshToken: '', userId: '', role: Role.PLAYER };
  }

  login(_dto: LoginDto): AuthResponseDto {
    return { accessToken: '', refreshToken: '', userId: '', role: Role.PLAYER };
  }
}
