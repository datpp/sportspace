import * as WebBrowser from 'expo-web-browser';
import { WebBrowserResultType } from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/server';
import { startVnpayCheckout, PAYMENT_RETURN_PATH } from '../checkout';

jest.mock('expo-web-browser', () => ({
  ...jest.requireActual('expo-web-browser'),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-linking', () => ({
  createURL: jest.fn(),
}));

const mockedWebBrowser = WebBrowser as jest.Mocked<typeof WebBrowser>;
const mockedLinking = Linking as jest.Mocked<typeof Linking>;

describe('startVnpayCheckout', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('gọi paymentControllerCheckout với returnUrl từ Linking.createURL rồi mở openAuthSessionAsync đúng paymentUrl/redirectUrl', async () => {
    mockedLinking.createURL.mockReturnValue('sportspace://payment-return');
    mockedWebBrowser.openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'sportspace://payment-return?vnp_ResponseCode=00',
    });
    let capturedBody: unknown;
    server.use(
      http.post('*/payments/:bookingId/checkout', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ paymentUrl: 'https://sandbox.vnpayment.vn/pay?x=1' }, { status: 201 });
      }),
    );

    const result = await startVnpayCheckout('booking-1');

    expect(mockedLinking.createURL).toHaveBeenCalledWith(PAYMENT_RETURN_PATH);
    expect(capturedBody).toEqual({ returnUrl: 'sportspace://payment-return' });
    expect(mockedWebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://sandbox.vnpayment.vn/pay?x=1',
      'sportspace://payment-return',
    );
    expect(result).toEqual({ type: 'success', url: 'sportspace://payment-return?vnp_ResponseCode=00' });
  });

  it('trả về type cancel khi người dùng đóng trình duyệt giữa chừng', async () => {
    mockedLinking.createURL.mockReturnValue('sportspace://payment-return');
    mockedWebBrowser.openAuthSessionAsync.mockResolvedValue({ type: WebBrowserResultType.CANCEL });

    const result = await startVnpayCheckout('booking-1');

    expect(result).toEqual({ type: WebBrowserResultType.CANCEL });
  });
});
