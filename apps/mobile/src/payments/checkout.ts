import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { WebBrowserAuthSessionResult } from 'expo-web-browser';
import { paymentsApi } from '../api/client';

export const PAYMENT_RETURN_PATH = 'payment-return';

// VNPAY Sandbox redirect user's browser về returnUrl sau khi thanh toán. Kết
// quả trên URL redirect (vnp_ResponseCode, vnp_SecureHash...) đến từ browser,
// KHÔNG được tin để quyết định thành công — nguồn sự thật là IPN webhook mà
// VNPAY gọi thẳng vào backend (đã verify chữ ký). Hàm này chỉ trả về việc
// browser đã đóng thế nào (success/cancel/dismiss); caller phải tự gọi lại
// GET /bookings/{id} để đọc status thật.
export async function startVnpayCheckout(bookingId: string): Promise<WebBrowserAuthSessionResult> {
  const redirectUrl = Linking.createURL(PAYMENT_RETURN_PATH);
  const { data } = await paymentsApi.paymentControllerCheckout(bookingId, { returnUrl: redirectUrl });
  return WebBrowser.openAuthSessionAsync(data.paymentUrl, redirectUrl);
}
