import { Test, TestingModule } from '@nestjs/testing';
import { AddonServicesService } from './addon-services.service';

describe('AddonServicesService', () => {
  let service: AddonServicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AddonServicesService],
    }).compile();

    service = module.get<AddonServicesService>(AddonServicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
