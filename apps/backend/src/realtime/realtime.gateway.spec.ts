import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { BookingStatus } from '@sportspace/shared';
import { Server, Socket } from 'socket.io';
import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let server: DeepMocked<Server>;
  let client: DeepMocked<Socket>;
  let emit: jest.Mock;

  beforeEach(() => {
    gateway = new RealtimeGateway();
    server = createMock<Server>();
    client = createMock<Socket>();
    emit = jest.fn();
    server.to.mockReturnValue({ emit } as unknown as ReturnType<Server['to']>);
    gateway.server = server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('joins the court:{courtId}:{bookingDate} room on subscribe and acks', () => {
    const courtId = faker.string.uuid();
    const bookingDate = '2026-09-01';

    const ack = gateway.handleSubscribe({ courtId, bookingDate }, client);

    expect(client.join).toHaveBeenCalledWith(`court:${courtId}:${bookingDate}`);
    expect(ack).toEqual({ joined: true });
  });

  it('leaves the room on unsubscribe', () => {
    const courtId = faker.string.uuid();
    const bookingDate = '2026-09-01';

    gateway.handleUnsubscribe({ courtId, bookingDate }, client);

    expect(client.leave).toHaveBeenCalledWith(
      `court:${courtId}:${bookingDate}`,
    );
  });

  it('broadcasts court:slotUpdate to the matching room with the full event payload', () => {
    const event = {
      courtId: faker.string.uuid(),
      bookingDate: '2026-09-01',
      startTime: '09:00',
      status: BookingStatus.PENDING,
    };

    gateway.broadcastSlotUpdate(event);

    expect(server.to).toHaveBeenCalledWith(
      `court:${event.courtId}:${event.bookingDate}`,
    );
    expect(emit).toHaveBeenCalledWith('court:slotUpdate', event);
  });
});
