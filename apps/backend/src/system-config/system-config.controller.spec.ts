import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigController } from './system-config.controller';
import { SystemConfigService } from './system-config.service';
import { SystemConfig } from './entities/system-config.entity';

describe('SystemConfigController', () => {
  let controller: SystemConfigController;
  let service: DeepMocked<SystemConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemConfigController],
      providers: [
        { provide: SystemConfigService, useValue: createMock<SystemConfigService>() },
      ],
    }).compile();

    controller = module.get(SystemConfigController);
    service = module.get(SystemConfigService);
  });

  it('get() forwards to the service', async () => {
    const config = { id: 'x' } as SystemConfig;
    service.get.mockResolvedValue(config);

    expect(await controller.get()).toBe(config);
  });

  it('update() forwards the dto to the service', async () => {
    const dto = { platformCommissionPercent: 15 };
    await controller.update(dto);
    expect(service.update).toHaveBeenCalledWith(dto);
  });
});
