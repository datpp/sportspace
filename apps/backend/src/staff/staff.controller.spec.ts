import { createMock } from '@golevelup/ts-jest';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

describe('StaffController', () => {
  it('delegates create() to StaffService', async () => {
    const staffService = createMock<StaffService>();
    const controller = new StaffController(staffService);
    const dto = { venueId: 'v1', fullName: 'A', phone: '090', position: 'Lễ tân' };
    const user = { id: 'u1', email: 'a@a.com', role: 'MERCHANT' } as never;

    await controller.create(dto, user);

    expect(staffService.create).toHaveBeenCalledWith(dto, user);
  });
});
