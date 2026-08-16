import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '@sportspace/shared';
import { Staff } from './entities/staff.entity';
import { Shift } from './entities/shift.entity';
import { Venue } from '../venue/entities/venue.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { ShiftQueryDto } from './dto/shift-query.dto';
import { FindStaffQueryDto } from './dto/find-staff-query.dto';
import { hasOverlap } from './shift-overlap';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { buildPaginationMeta } from '../common/pagination.util';

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

  async findAll(query: FindStaffQueryDto): Promise<PaginatedDto<Staff>> {
    const { page, limit, q, venueId, isActive } = query;

    const qb = this.staffRepo
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.venue', 'venue')
      .where('venue.id = :venueId', { venueId })
      .orderBy('staff.fullName', 'ASC');

    if (isActive !== undefined) {
      qb.andWhere('staff.isActive = :isActive', {
        isActive: isActive === 'true',
      });
    }
    if (q?.trim()) {
      qb.andWhere('(staff.fullName ILIKE :q OR staff.phone ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
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

  async createShift(
    staffId: string,
    dto: CreateShiftDto,
    user: AuthenticatedUser,
  ): Promise<Shift> {
    const staff = await this.findOne(staffId);
    this.assertOwnerOrAdmin(staff.venue, user);

    const shiftRepo = this.dataSource.getRepository(Shift);
    const existing = await shiftRepo.find({
      where: { staff: { id: staffId }, shiftDate: dto.shiftDate },
    });
    if (hasOverlap(existing, dto)) {
      throw new BadRequestException('Ca làm bị trùng giờ với ca đã có');
    }

    const shift = shiftRepo.create({ ...dto, staff });
    return shiftRepo.save(shift);
  }

  listShifts(staffId: string, query: ShiftQueryDto): Promise<Shift[]> {
    return this.dataSource.getRepository(Shift).find({
      where: {
        staff: { id: staffId },
        ...(query.date ? { shiftDate: query.date } : {}),
      },
    });
  }

  async removeShift(
    staffId: string,
    shiftId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const staff = await this.findOne(staffId);
    this.assertOwnerOrAdmin(staff.venue, user);

    const result = await this.dataSource
      .getRepository(Shift)
      .delete({ id: shiftId, staff: { id: staffId } });
    if (!result.affected) {
      throw new NotFoundException('Ca làm không tồn tại');
    }
  }

  private assertOwnerOrAdmin(venue: Venue, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && venue.owner.id !== user.id) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên nhân viên của sân này',
      );
    }
  }
}
