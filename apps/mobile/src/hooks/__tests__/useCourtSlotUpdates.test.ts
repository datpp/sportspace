import { renderHook } from '@testing-library/react-native';
import { BookingStatus } from '@sportspace/shared';
import { useCourtSlotUpdates } from '../useCourtSlotUpdates';
import { realtimeSocket } from '../../realtime/socket';
import type { SlotUpdatePayload } from '../../realtime/socket';

jest.mock('../../realtime/socket', () => ({
  realtimeSocket: {
    connected: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

const mockedSocket = realtimeSocket as unknown as {
  connected: boolean;
  connect: jest.Mock;
  disconnect: jest.Mock;
  emit: jest.Mock;
  on: jest.Mock;
  off: jest.Mock;
};

function getHandler(mockFn: jest.Mock, event: string): (...args: unknown[]) => void {
  const call = [...mockFn.mock.calls].reverse().find(([e]) => e === event);
  if (!call) throw new Error(`no handler registered for ${event}`);
  return call[1];
}

describe('useCourtSlotUpdates', () => {
  beforeEach(() => {
    mockedSocket.connected = false;
    mockedSocket.connect.mockClear();
    mockedSocket.disconnect.mockClear();
    mockedSocket.emit.mockClear();
    mockedSocket.on.mockClear();
    mockedSocket.off.mockClear();
  });

  it('connect() lúc mount khi chưa connected, đăng ký lắng nghe connect + court:slotUpdate', async () => {
    await renderHook(() => useCourtSlotUpdates('court-1', '2026-08-10', jest.fn()));

    expect(mockedSocket.connect).toHaveBeenCalled();
    expect(mockedSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockedSocket.on).toHaveBeenCalledWith('court:slotUpdate', expect.any(Function));
  });

  it('subscribe ngay nếu socket đã connected sẵn, không gọi connect() lại', async () => {
    mockedSocket.connected = true;
    await renderHook(() => useCourtSlotUpdates('court-1', '2026-08-10', jest.fn()));

    expect(mockedSocket.connect).not.toHaveBeenCalled();
    expect(mockedSocket.emit).toHaveBeenCalledWith('court:subscribe', {
      courtId: 'court-1',
      bookingDate: '2026-08-10',
    });
  });

  it('re-subscribe mỗi khi connect event bắn lại (vd sau reconnect do mất mạng)', async () => {
    await renderHook(() => useCourtSlotUpdates('court-1', '2026-08-10', jest.fn()));
    mockedSocket.emit.mockClear();

    const connectHandler = getHandler(mockedSocket.on, 'connect');
    connectHandler();

    expect(mockedSocket.emit).toHaveBeenCalledWith('court:subscribe', {
      courtId: 'court-1',
      bookingDate: '2026-08-10',
    });
  });

  it('chỉ gọi onUpdate khi payload khớp đúng courtId + bookingDate', async () => {
    const onUpdate = jest.fn();
    await renderHook(() => useCourtSlotUpdates('court-1', '2026-08-10', onUpdate));

    const slotUpdateHandler = getHandler(mockedSocket.on, 'court:slotUpdate');

    slotUpdateHandler({
      courtId: 'court-2',
      bookingDate: '2026-08-10',
      startTime: '06:00',
      status: BookingStatus.CANCELLED,
    });
    expect(onUpdate).not.toHaveBeenCalled();

    const payload: SlotUpdatePayload = {
      courtId: 'court-1',
      bookingDate: '2026-08-10',
      startTime: '06:00',
      status: BookingStatus.CANCELLED,
    };
    slotUpdateHandler(payload);
    expect(onUpdate).toHaveBeenCalledWith(payload);
  });

  it('unsubscribe + gỡ listener + disconnect lúc unmount', async () => {
    const { unmount } = await renderHook(() => useCourtSlotUpdates('court-1', '2026-08-10', jest.fn()));
    mockedSocket.emit.mockClear();

    await unmount();

    expect(mockedSocket.emit).toHaveBeenCalledWith('court:unsubscribe', {
      courtId: 'court-1',
      bookingDate: '2026-08-10',
    });
    expect(mockedSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockedSocket.off).toHaveBeenCalledWith('court:slotUpdate', expect.any(Function));
    expect(mockedSocket.disconnect).toHaveBeenCalled();
  });
});
