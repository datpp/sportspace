import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from './entities/system-config.entity';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@Injectable()
export class SystemConfigService {
  constructor(
    @InjectRepository(SystemConfig)
    private readonly repo: Repository<SystemConfig>,
  ) {}

  async get(): Promise<SystemConfig> {
    const [existing] = await this.repo.find({ take: 1 });
    if (existing) {
      return existing;
    }
    return this.repo.save(this.repo.create({}));
  }

  async update(dto: UpdateSystemConfigDto): Promise<SystemConfig> {
    const config = await this.get();
    Object.assign(config, dto);
    return this.repo.save(config);
  }
}
