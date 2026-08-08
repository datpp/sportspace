import { Injectable } from '@nestjs/common';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { FindVenuesQueryDto } from './dto/find-venues-query.dto';
import { Venue } from './entities/venue.entity';

@Injectable()
export class VenueService {
  create(_dto: CreateVenueDto): Venue {
    throw new Error('Not implemented');
  }

  findAll(_query: FindVenuesQueryDto): Venue[] {
    return [];
  }

  findOne(_id: string): Venue | null {
    return null;
  }

  update(_id: string, _dto: UpdateVenueDto): Venue {
    throw new Error('Not implemented');
  }

  remove(_id: string): void {
    throw new Error('Not implemented');
  }
}
