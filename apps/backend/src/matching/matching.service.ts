import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  BookingStatus,
  MatchParticipantStatus,
  MatchStatus,
  Role,
} from '@sportspace/shared';
import { DataSource, In, Repository } from 'typeorm';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { FindMatchesQueryDto } from './dto/find-matches-query.dto';
import { Match } from './entities/match.entity';
import { MatchParticipant } from './entities/match-participant.entity';

const ACTIVE_PARTICIPANT_STATUSES = [
  MatchParticipantStatus.REQUESTED,
  MatchParticipantStatus.ACCEPTED,
];

@Injectable()
export class MatchingService {
  constructor(
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    @InjectRepository(MatchParticipant)
    private readonly participantRepo: Repository<MatchParticipant>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(hostId: string, dto: CreateMatchDto): Promise<Match> {
    const booking = await this.bookingRepo.findOne({
      where: { id: dto.bookingId },
      relations: { user: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking không tồn tại');
    }
    if (booking.user.id !== hostId) {
      throw new ForbiddenException('Bạn không có quyền tạo kèo từ booking này');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Chỉ có thể tạo kèo từ booking đã CONFIRMED',
      );
    }

    const existing = await this.matchRepo.findOne({
      where: { booking: { id: dto.bookingId } },
    });
    if (existing) {
      throw new BadRequestException('Booking này đã có kèo');
    }

    const match = this.matchRepo.create({
      booking,
      host: { id: hostId } as User,
      slotsTotal: dto.slotsTotal,
      slotsFilled: 0,
      skillLevel: dto.skillLevel,
      status: MatchStatus.OPEN,
    });
    return this.matchRepo.save(match);
  }

  findAll(query: FindMatchesQueryDto): Promise<Match[]> {
    const qb = this.matchRepo
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.booking', 'booking')
      .leftJoinAndSelect('booking.court', 'court')
      .leftJoinAndSelect('match.host', 'host')
      .where('match.status = :status', { status: MatchStatus.OPEN });

    if (query.sport) {
      qb.andWhere('court.sport = :sport', { sport: query.sport });
    }

    return qb.orderBy('match.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Match> {
    const match = await this.matchRepo.findOne({
      where: { id },
      relations: {
        booking: { court: true },
        host: true,
        participants: { user: true },
      },
    });
    if (!match) {
      throw new NotFoundException('Kèo không tồn tại');
    }
    return match;
  }

  async update(
    id: string,
    dto: UpdateMatchDto,
    user: AuthenticatedUser,
  ): Promise<Match> {
    const match = await this.findOne(id);
    this.assertHostOrAdmin(match, user);
    if (match.status !== MatchStatus.OPEN) {
      throw new BadRequestException('Chỉ có thể sửa kèo đang mở');
    }
    Object.assign(match, dto);
    return this.matchRepo.save(match);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const match = await this.findOne(id);
    this.assertHostOrAdmin(match, user);
    await this.matchRepo.remove(match);
  }

  async join(matchId: string, userId: string): Promise<MatchParticipant> {
    const match = await this.findOne(matchId);
    if (match.host.id === userId) {
      throw new BadRequestException(
        'Chủ kèo không thể tự xin ghép kèo của mình',
      );
    }
    if (match.status !== MatchStatus.OPEN) {
      throw new BadRequestException('Kèo đã đóng, không thể xin ghép');
    }

    const existing = await this.participantRepo.findOne({
      where: {
        match: { id: matchId },
        user: { id: userId },
        status: In(ACTIVE_PARTICIPANT_STATUSES),
      },
    });
    if (existing) {
      throw new BadRequestException('Bạn đã xin ghép kèo này rồi');
    }

    const participant = this.participantRepo.create({
      match,
      user: { id: userId } as User,
      status: MatchParticipantStatus.REQUESTED,
    });
    return this.participantRepo.save(participant);
  }

  /**
   * Host-only. Locks the Match row for the duration of the transaction so
   * two concurrent accepts can't both push slotsFilled past slotsTotal.
   */
  async acceptParticipant(
    matchId: string,
    participantId: string,
    user: AuthenticatedUser,
  ): Promise<MatchParticipant> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const match = await queryRunner.manager
        .createQueryBuilder(Match, 'match')
        .setLock('pessimistic_write')
        .innerJoinAndSelect('match.host', 'host')
        .where('match.id = :matchId', { matchId })
        .getOne();
      if (!match) {
        throw new NotFoundException('Kèo không tồn tại');
      }
      this.assertHostOrAdmin(match, user);

      const participant = await queryRunner.manager.findOne(MatchParticipant, {
        where: { id: participantId, match: { id: matchId } },
        relations: { user: true },
      });
      if (!participant) {
        throw new NotFoundException('Yêu cầu ghép kèo không tồn tại');
      }
      if (participant.status !== MatchParticipantStatus.REQUESTED) {
        throw new BadRequestException('Yêu cầu này đã được xử lý');
      }
      if (match.status !== MatchStatus.OPEN) {
        throw new BadRequestException('Kèo đã đóng');
      }
      if (match.slotsFilled >= match.slotsTotal) {
        throw new BadRequestException('Kèo đã đủ người');
      }

      participant.status = MatchParticipantStatus.ACCEPTED;
      await queryRunner.manager.save(MatchParticipant, participant);

      match.slotsFilled += 1;
      if (match.slotsFilled >= match.slotsTotal) {
        match.status = MatchStatus.CLOSED;
      }
      await queryRunner.manager.save(Match, match);

      await queryRunner.commitTransaction();
      return participant;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectParticipant(
    matchId: string,
    participantId: string,
    user: AuthenticatedUser,
  ): Promise<MatchParticipant> {
    const match = await this.findOne(matchId);
    this.assertHostOrAdmin(match, user);

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, match: { id: matchId } },
    });
    if (!participant) {
      throw new NotFoundException('Yêu cầu ghép kèo không tồn tại');
    }
    if (participant.status !== MatchParticipantStatus.REQUESTED) {
      throw new BadRequestException('Yêu cầu này đã được xử lý');
    }

    participant.status = MatchParticipantStatus.REJECTED;
    return this.participantRepo.save(participant);
  }

  private assertHostOrAdmin(match: Match, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && match.host.id !== user.id) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên kèo này');
    }
  }
}
