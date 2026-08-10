import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { BookingStatus } from '@sportspace/shared';
import { Server, Socket } from 'socket.io';

export type SlotStatus = BookingStatus;

export interface CourtRoomDto {
  courtId: string;
  bookingDate: string;
}

export interface SlotUpdateEvent extends CourtRoomDto {
  startTime: string;
  status: SlotStatus;
}

function courtRoom({ courtId, bookingDate }: CourtRoomDto): string {
  return `court:${courtId}:${bookingDate}`;
}

/**
 * Broadcasts booking-slot status changes so clients viewing a court's
 * schedule can drop REST polling. Event contract (shared with mobile/web):
 * client emits `court:subscribe`/`court:unsubscribe` with {courtId,
 * bookingDate} to join/leave a room; server emits `court:slotUpdate` to that
 * room whenever a booking is created, cancelled, rescheduled, or confirmed
 * via payment. Field names match the REST DTOs (Booking.bookingDate) on
 * purpose so clients don't need to remember two names for the same concept.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('court:subscribe')
  handleSubscribe(
    @MessageBody() { courtId, bookingDate }: CourtRoomDto,
    @ConnectedSocket() client: Socket,
  ): { joined: true } {
    void client.join(courtRoom({ courtId, bookingDate }));
    return { joined: true };
  }

  @SubscribeMessage('court:unsubscribe')
  handleUnsubscribe(
    @MessageBody() { courtId, bookingDate }: CourtRoomDto,
    @ConnectedSocket() client: Socket,
  ): void {
    void client.leave(courtRoom({ courtId, bookingDate }));
  }

  broadcastSlotUpdate(event: SlotUpdateEvent): void {
    this.server.to(courtRoom(event)).emit('court:slotUpdate', event);
  }
}
