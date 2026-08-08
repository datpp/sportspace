import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Role } from '@sportspace/shared';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { RegisterDto } from './dto/register.dto';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    passwordHash: 'unused-in-most-tests',
    fullName: faker.person.fullName(),
    phone: faker.phone.number(),
    role: Role.PLAYER,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildRegisterDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
  return {
    email: faker.internet.email(),
    password: faker.internet.password({ length: 10 }),
    fullName: faker.person.fullName(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: DeepMocked<Repository<User>>;
  let jwtService: DeepMocked<JwtService>;
  let config: DeepMocked<ConfigService>;
  let queryBuilder: DeepMocked<SelectQueryBuilder<User>>;

  beforeEach(() => {
    userRepo = createMock<Repository<User>>();
    jwtService = createMock<JwtService>();
    config = createMock<ConfigService>();
    queryBuilder = createMock<SelectQueryBuilder<User>>();

    queryBuilder.addSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    userRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    userRepo.create.mockImplementation(((data: object) => ({
      role: Role.PLAYER,
      ...data,
    })) as typeof userRepo.create);
    userRepo.save.mockImplementation((u) =>
      Promise.resolve({ id: faker.string.uuid(), ...u } as User),
    );

    jwtService.sign.mockImplementation(
      (payload: unknown) => `signed:${JSON.stringify(payload)}`,
    );

    service = new AuthService(userRepo, jwtService, config);
  });

  describe('register', () => {
    it('hashes the password, saves a PLAYER user and returns tokens', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const dto = buildRegisterDto();

      const result = await service.register(dto);

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: dto.email, fullName: dto.fullName }),
      );
      const savedArg = userRepo.save.mock.calls[0][0] as User;
      expect(savedArg.passwordHash).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, savedArg.passwordHash)).toBe(
        true,
      );

      expect(result.userId).toBeDefined();
      expect(result.role).toBe(Role.PLAYER);
      expect(result.accessToken).toContain('signed:');
      expect(result.refreshToken).toContain('signed:');
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('throws ConflictException when the email is already registered', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());

      await expect(service.register(buildRegisterDto())).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns tokens when the password matches', async () => {
      const password = 'CorrectHorseBattery9';
      const passwordHash = await bcrypt.hash(password, 10);
      const user = buildUser({ passwordHash });
      queryBuilder.getOne.mockResolvedValue(user);

      const result = await service.login({ email: user.email, password });

      expect(result.userId).toBe(user.id);
      expect(result.role).toBe(user.role);
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      const passwordHash = await bcrypt.hash('RightPassword1', 10);
      const user = buildUser({ passwordHash });
      queryBuilder.getOne.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: 'WrongPassword1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when the email is unknown', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.login({ email: faker.internet.email(), password: 'whatever1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
