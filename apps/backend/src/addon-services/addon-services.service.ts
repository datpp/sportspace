import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '@sportspace/shared';
import { AddOnService } from './entities/add-on-service.entity';
import { Venue } from '../venue/entities/venue.entity';
import { CreateAddOnServiceDto } from './dto/create-addon-service.dto';
import { UpdateAddOnServiceDto } from './dto/update-addon-service.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class AddonServicesService {
  constructor(
    @InjectRepository(AddOnService)
    private readonly serviceRepo: Repository<AddOnService>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateAddOnServiceDto,
    user: AuthenticatedUser,
  ): Promise<AddOnService> {
    const venue = await this.dataSource.getRepository(Venue).findOne({
      where: { id: dto.venueId },
      relations: { owner: true },
    });
    if (!venue) {
      throw new NotFoundException('Cụm sân không tồn tại');
    }
    this.assertOwnerOrAdmin(venue, user);

    const addOnService = this.serviceRepo.create({
      venue,
      name: dto.name,
      price: dto.price,
      description: dto.description ?? null,
    });
    return this.serviceRepo.save(addOnService);
  }

  findAll(venueId: string): Promise<AddOnService[]> {
    return this.serviceRepo.find({
      where: { venue: { id: venueId } },
      relations: { venue: true },
    });
  }

  async findOne(id: string): Promise<AddOnService> {
    const addOnService = await this.serviceRepo.findOne({
      where: { id },
      relations: { venue: { owner: true } },
    });
    if (!addOnService) {
      throw new NotFoundException('Dịch vụ không tồn tại');
    }
    return addOnService;
  }

  async update(
    id: string,
    dto: UpdateAddOnServiceDto,
    user: AuthenticatedUser,
  ): Promise<AddOnService> {
    const addOnService = await this.findOne(id);
    this.assertOwnerOrAdmin(addOnService.venue, user);
    Object.assign(addOnService, dto);
    return this.serviceRepo.save(addOnService);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const addOnService = await this.findOne(id);
    this.assertOwnerOrAdmin(addOnService.venue, user);
    await this.serviceRepo.remove(addOnService);
  }

  private assertOwnerOrAdmin(venue: Venue, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && venue.owner.id !== user.id) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên dịch vụ của sân này',
      );
    }
  }
}
