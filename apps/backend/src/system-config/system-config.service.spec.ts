import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfigService } from './system-config.service';
import { SystemConfig } from './entities/system-config.entity';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let repo: DeepMocked<Repository<SystemConfig>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        {
          provide: getRepositoryToken(SystemConfig),
          useValue: createMock<Repository<SystemConfig>>(),
        },
      ],
    }).compile();

    service = module.get(SystemConfigService);
    repo = module.get(getRepositoryToken(SystemConfig));
  });

  it('get() returns the existing row if one exists', async () => {
    const row = { id: 'x' } as SystemConfig;
    repo.find.mockResolvedValue([row]);

    const result = await service.get();

    expect(result).toBe(row);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('get() creates and returns a default row if none exists', async () => {
    repo.find.mockResolvedValue([]);
    const created = { id: 'new' } as SystemConfig;
    repo.create.mockReturnValue(created);
    repo.save.mockResolvedValue(created);

    const result = await service.get();

    expect(repo.create).toHaveBeenCalledWith({});
    expect(result).toBe(created);
  });

  it('update() merges the dto into the existing row and saves', async () => {
    const row = { id: 'x', platformCommissionPercent: 10 } as SystemConfig;
    repo.find.mockResolvedValue([row]);
    repo.save.mockImplementation(async (r) => r as SystemConfig);

    const result = await service.update({ platformCommissionPercent: 15 });

    expect(result.platformCommissionPercent).toBe(15);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'x', platformCommissionPercent: 15 }),
    );
  });
});
