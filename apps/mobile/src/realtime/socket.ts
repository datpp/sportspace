import { io, Socket } from 'socket.io-client';
import type { BookingStatus } from '@sportspace/shared';
import { API_BASE_URL } from '../api/client';

export interface CourtRoom {
  courtId: string;
  bookingDate: string;
}

export interface SlotUpdatePayload extends CourtRoom {
  startTime: string;
  status: BookingStatus;
}

interface ServerToClientEvents {
  'court:slotUpdate': (payload: SlotUpdatePayload) => void;
}

interface ClientToServerEvents {
  'court:subscribe': (room: CourtRoom, ack?: (res: { joined: boolean }) => void) => void;
  'court:unsubscribe': (room: CourtRoom) => void;
}

// Kết nối lazy (autoConnect: false) — chỉ connect khi có màn hình cần realtime
// (hiện là CourtSlotsScreen qua useCourtSlotUpdates), disconnect khi rời màn.
// Chỉ dùng transport 'websocket', bỏ HTTP long-polling fallback (không cần
// thiết ở RN, ít bug hơn theo khuyến nghị chính thức của Socket.IO).
export const realtimeSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_BASE_URL, {
  autoConnect: false,
  transports: ['websocket'],
});
