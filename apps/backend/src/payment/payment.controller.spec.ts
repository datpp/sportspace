import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;
  let service: DeepMocked<PaymentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: PaymentService, useValue: createMock<PaymentService>() },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    service = module.get(PaymentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('checkout() forwards the authenticated userId, bookingId and dto to PaymentService.checkout', async () => {
    const userId = faker.string.uuid();
    const bookingId = faker.string.uuid();
    const dto = { returnUrl: 'http://localhost:3000/return' };
    const expected = {
      paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...',
    };
    service.checkout.mockResolvedValue(expected);

    const result = await controller.checkout(userId, bookingId, dto);

    expect(service.checkout).toHaveBeenCalledWith(bookingId, userId, dto);
    expect(result).toBe(expected);
  });

  it('ipn() forwards the raw query object untouched to PaymentService.handleIpn', async () => {
    const query = {
      vnp_TxnRef: faker.string.hexadecimal({ length: 32, prefix: '' }),
      vnp_Amount: '20000000',
      vnp_ResponseCode: '00',
      vnp_SecureHash: faker.string.hexadecimal({ length: 128, prefix: '' }),
    };
    const expected = { RspCode: '00', Message: 'Confirm Success' };
    service.handleIpn.mockResolvedValue(expected);

    const result = await controller.ipn(query);

    expect(service.handleIpn).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });
});
