import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '@sportspace/shared';
import { Staff } from './entities/staff.entity';
import { Venue } from '../venue/entities/venue.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff) private readonly staffRepo: Repository<Staff>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateStaffDto,
    user: AuthenticatedUser,
  ): Promise<Staff> {
    const venue = await this.dataSource.getRepository(Venue).findOne({
      where: { id: dto.venueId },
      relations: { owner: true },
    });
    if (!venue) {
      throw new NotFoundException('Cụm sân không tồn tại');
    }
    this.assertOwnerOrAdmin(venue, user);

    const staff = this.staffRepo.create({
      venue,
      fullName: dto.fullName,
      phone: dto.phone,
      position: dto.position,
    });
    return this.staffRepo.save(staff);
  }

  findAll(venueId: string): Promise<Staff[]> {
    return this.staffRepo.find({
      where: { venue: { id: venueId } },
      relations: { venue: true },
    });
  }

  async findOne(id: string): Promise<Staff> {
    const staff = await this.staffRepo.findOne({
      where: { id },
      relations: { venue: { owner: true } },
    });
    if (!staff) {
      throw new NotFoundException('Nhân viên không tồn tại');
    }
    return staff;
  }

  async update(
    id: string,
    dto: UpdateStaffDto,
    user: AuthenticatedUser,
  ): Promise<Staff> {
    const staff = await this.findOne(id);
    this.assertOwnerOrAdmin(staff.venue, user);
    Object.assign(staff, dto);
    return this.staffRepo.save(staff);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const staff = await this.findOne(id);
    this.assertOwnerOrAdmin(staff.venue, user);
    await this.staffRepo.remove(staff);
  }

  private assertOwnerOrAdmin(venue: Venue, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && venue.owner.id !== user.id) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên nhân viên của sân này',
      );
    }
  }
}
