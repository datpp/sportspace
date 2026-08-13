import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.userRepo.update(userId, { fcmToken });
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find();
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
