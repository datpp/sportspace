import { useEffect, useRef } from 'react';
import { realtimeSocket, type SlotUpdatePayload } from '../realtime/socket';

// Socket.IO tự rời room khi disconnect (kể cả khi tự reconnect do mất mạng),
// nên phải re-emit court:subscribe mỗi lần 'connect' bắn ra, không chỉ 1 lần
// lúc mount — nếu không, sau khi mất mạng rồi có lại, client sẽ không còn
// nhận được court:slotUpdate dù socket đã "connected" trở lại.
export function useCourtSlotUpdates(
  courtId: string,
  bookingDate: string,
  onUpdate: (payload: SlotUpdatePayload) => void,
): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const room = { courtId, bookingDate };

    const subscribe = () => {
      realtimeSocket.emit('court:subscribe', room);
    };

    const handleSlotUpdate = (payload: SlotUpdatePayload) => {
      if (payload.courtId === courtId && payload.bookingDate === bookingDate) {
        onUpdateRef.current(payload);
      }
    };

    realtimeSocket.on('connect', subscribe);
    realtimeSocket.on('court:slotUpdate', handleSlotUpdate);

    if (realtimeSocket.connected) {
      subscribe();
    } else {
      realtimeSocket.connect();
    }

    return () => {
      realtimeSocket.emit('court:unsubscribe', room);
      realtimeSocket.off('connect', subscribe);
      realtimeSocket.off('court:slotUpdate', handleSlotUpdate);
      realtimeSocket.disconnect();
    };
  }, [courtId, bookingDate]);
}
