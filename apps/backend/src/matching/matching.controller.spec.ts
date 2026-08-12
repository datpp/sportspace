import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@sportspace/shared';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { Match } from './entities/match.entity';
import { MatchParticipant } from './entities/match-participant.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

function buildAuthUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    role: Role.PLAYER,
    ...overrides,
  };
}

describe('MatchingController', () => {
  let controller: MatchingController;
  let service: DeepMocked<MatchingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchingController],
      providers: [
        { provide: MatchingService, useValue: createMock<MatchingService>() },
      ],
    }).compile();

    controller = module.get<MatchingController>(MatchingController);
    service = module.get(MatchingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() forwards the authenticated hostId', async () => {
    const hostId = faker.string.uuid();
    const dto = { bookingId: faker.string.uuid(), slotsTotal: 3 };
    const expected = createMock<Match>();
    service.create.mockResolvedValue(expected);

    const result = await controller.create(hostId, dto);

    expect(service.create).toHaveBeenCalledWith(hostId, dto);
    expect(result).toBe(expected);
  });

  it('findAll() forwards the query', async () => {
    const query = { sport: 'football' };
    const expected = [createMock<Match>()];
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });

  it('update() forwards id + dto + authenticated user', async () => {
    const id = faker.string.uuid();
    const user = buildAuthUser();
    const dto = { slotsTotal: 5 };
    const expected = createMock<Match>();
    service.update.mockResolvedValue(expected);

    const result = await controller.update(id, dto, user);

    expect(service.update).toHaveBeenCalledWith(id, dto, user);
    expect(result).toBe(expected);
  });

  it('remove() forwards id + authenticated user', async () => {
    const id = faker.string.uuid();
    const user = buildAuthUser();

    await controller.remove(id, user);

    expect(service.remove).toHaveBeenCalledWith(id, user);
  });

  it('join() forwards match id + authenticated userId', async () => {
    const id = faker.string.uuid();
    const userId = faker.string.uuid();
    const expected = createMock<MatchParticipant>();
    service.join.mockResolvedValue(expected);

    const result = await controller.join(id, userId);

    expect(service.join).toHaveBeenCalledWith(id, userId);
    expect(result).toBe(expected);
  });

  it('acceptParticipant() forwards match id, participant id, authenticated user', async () => {
    const id = faker.string.uuid();
    const participantId = faker.string.uuid();
    const user = buildAuthUser();
    const expected = createMock<MatchParticipant>();
    service.acceptParticipant.mockResolvedValue(expected);

    const result = await controller.acceptParticipant(id, participantId, user);

    expect(service.acceptParticipant).toHaveBeenCalledWith(
      id,
      participantId,
      user,
    );
    expect(result).toBe(expected);
  });

  it('rejectParticipant() forwards match id, participant id, authenticated user', async () => {
    const id = faker.string.uuid();
    const participantId = faker.string.uuid();
    const user = buildAuthUser();
    const expected = createMock<MatchParticipant>();
    service.rejectParticipant.mockResolvedValue(expected);

    const result = await controller.rejectParticipant(id, participantId, user);

    expect(service.rejectParticipant).toHaveBeenCalledWith(
      id,
      participantId,
      user,
    );
    expect(result).toBe(expected);
  });
});
