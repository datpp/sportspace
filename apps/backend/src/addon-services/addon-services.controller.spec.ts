import { Test, TestingModule } from '@nestjs/testing';
import { AddonServicesController } from './addon-services.controller';
import { AddonServicesService } from './addon-services.service';

describe('AddonServicesController', () => {
  let controller: AddonServicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddonServicesController],
      providers: [AddonServicesService],
    }).compile();

    controller = module.get<AddonServicesController>(AddonServicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
