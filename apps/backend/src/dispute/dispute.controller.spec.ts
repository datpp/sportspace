import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { DisputeStatus } from '@sportspace/shared';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

describe('DisputeController', () => {
  let controller: DisputeController;
  let service: DeepMocked<DisputeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputeController],
      providers: [{ provide: DisputeService, useValue: createMock<DisputeService>() }],
    }).compile();

    controller = module.get(DisputeController);
    service = module.get(DisputeService);
  });

  it('create() forwards the authenticated userId + dto', async () => {
    const userId = faker.string.uuid();
    const dto = { bookingId: 'b1', reason: 'Sân bẩn, không đúng mô tả' };

    await controller.create(userId, dto);

    expect(service.create).toHaveBeenCalledWith(userId, dto);
  });

  it('findAll() forwards the status query param', async () => {
    service.findAll.mockResolvedValue([]);

    await controller.findAll(DisputeStatus.OPEN);

    expect(service.findAll).toHaveBeenCalledWith(DisputeStatus.OPEN);
  });

  it('resolve() forwards id + adminId + dto', async () => {
    const adminId = faker.string.uuid();
    const dto: ResolveDisputeDto = {
      status: DisputeStatus.REJECTED,
      resolutionNote: 'Không đủ căn cứ',
    };

    await controller.resolve('d1', adminId, dto);

    expect(service.resolve).toHaveBeenCalledWith('d1', adminId, dto);
  });
});
