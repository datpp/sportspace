import { BookingStatus } from '@sportspace/shared';
import type { Booking } from '@sportspace/shared';
import { bookingsApi } from '../api/client';

const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Sau khi user rời trình duyệt thanh toán VNPAY, IPN webhook (nguồn sự thật
// đã verify chữ ký ở backend) có thể đến trễ vài giây so với lúc browser đóng
// (round-trip mạng + xử lý phía backend) — poll 5 lần / 1.5s (~7.5s tổng) để
// lấy status thật thay vì tin query param redirect. Cửa sổ ngắn hơn dễ báo
// "chưa xác nhận được" oan cho user dù thanh toán đã thành công thật.
export async function pollBookingUntilConfirmed(
  bookingId: string,
  attempts: number = MAX_POLL_ATTEMPTS,
): Promise<Booking | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data } = await bookingsApi.bookingControllerFindOne(bookingId);
    if (data.status === BookingStatus.CONFIRMED) {
      return data;
    }
    if (attempt < attempts - 1) {
      await sleep(POLL_INTERVAL_MS);
    }
  }
  return null;
}
