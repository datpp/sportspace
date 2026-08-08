import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@sportspace/shared';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: DeepMocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: createMock<AuthService>() },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('register() delegates to AuthService.register', async () => {
    const dto = {
      email: faker.internet.email(),
      password: faker.internet.password({ length: 10 }),
      fullName: faker.person.fullName(),
    };
    const expected = {
      accessToken: 'a',
      refreshToken: 'r',
      userId: faker.string.uuid(),
      role: Role.PLAYER,
    };
    service.register.mockResolvedValue(expected);

    const result = await controller.register(dto);

    expect(service.register).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('login() delegates to AuthService.login', async () => {
    const dto = { email: faker.internet.email(), password: 'whatever1' };
    const expected = {
      accessToken: 'a',
      refreshToken: 'r',
      userId: faker.string.uuid(),
      role: Role.PLAYER,
    };
    service.login.mockResolvedValue(expected);

    const result = await controller.login(dto);

    expect(service.login).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });
});
