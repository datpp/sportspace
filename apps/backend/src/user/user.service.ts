import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { buildPaginationMeta } from '../common/pagination.util';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.userRepo.update(userId, { fcmToken });
  }

  async findAll(query: FindUsersQueryDto): Promise<PaginatedDto<User>> {
    const { page, limit, q, role, isLocked } = query;
    const qb = this.userRepo
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC');

    if (q?.trim()) {
      qb.andWhere('(user.fullName ILIKE :q OR user.email ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }
    if (role) {
      qb.andWhere('user.role = :role', { role });
    }
    if (isLocked !== undefined) {
      qb.andWhere('user.isLocked = :isLocked', {
        isLocked: isLocked === 'true',
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async setLocked(userId: string, isLocked: boolean): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    user.isLocked = isLocked;
    return this.userRepo.save(user);
  }
}
