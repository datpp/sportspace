import { createMock } from '@golevelup/ts-jest';
import { AddonServicesController } from './addon-services.controller';
import { AddonServicesService } from './addon-services.service';

describe('AddonServicesController', () => {
  it('delegates create() to AddonServicesService', async () => {
    const addonServicesService = createMock<AddonServicesService>();
    const controller = new AddonServicesController(addonServicesService);
    const dto = { venueId: 'v1', name: 'Thuê bóng', price: 20000 };
    const user = { id: 'u1', email: 'a@a.com', role: 'MERCHANT' } as never;

    await controller.create(dto, user);

    expect(addonServicesService.create).toHaveBeenCalledWith(dto, user);
  });
});
