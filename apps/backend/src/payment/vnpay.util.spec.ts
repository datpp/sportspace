import { faker } from '@faker-js/faker';
import {
  buildVnpayRedirectUrl,
  formatVnpayDate,
  fromVnpayAmount,
  generateTxnRef,
  signVnpayParams,
  toVnpayAmount,
  verifyVnpaySignature,
} from './vnpay.util';

describe('vnpay.util', () => {
  const secretKey = 'RAOEXHYVSDDIIENYWSLDIIZTANRIIFI';

  function sampleParams() {
    return {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: 'DEMOV210',
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: generateTxnRef(),
      vnp_OrderInfo: faker.lorem.words(3),
      vnp_OrderType: 'other',
      vnp_Amount: toVnpayAmount(200000),
      vnp_ReturnUrl: 'http://localhost:3000/payments/return',
      vnp_IpAddr: '127.0.0.1',
      vnp_CreateDate: formatVnpayDate(new Date()),
    };
  }

  it('signs a payload deterministically for the same params and secret', () => {
    const params = sampleParams();
    expect(signVnpayParams(params, secretKey)).toBe(
      signVnpayParams(params, secretKey),
    );
  });

  it('produces a different signature when a param value changes', () => {
    const params = sampleParams();
    const signature = signVnpayParams(params, secretKey);
    const tampered = { ...params, vnp_Amount: toVnpayAmount(1) };
    expect(signVnpayParams(tampered, secretKey)).not.toBe(signature);
  });

  it('produces a different signature for a different secret', () => {
    const params = sampleParams();
    expect(signVnpayParams(params, secretKey)).not.toBe(
      signVnpayParams(params, 'a-different-secret'),
    );
  });

  it('builds a redirect URL whose vnp_SecureHash verifies against the query it round-trips through', () => {
    const params = sampleParams();
    const url = buildVnpayRedirectUrl(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      params,
      secretKey,
    );

    const query = Object.fromEntries(new URL(url).searchParams.entries());
    expect(verifyVnpaySignature(query, secretKey)).toBe(true);
  });

  it('rejects a query whose vnp_SecureHash does not match the other fields', () => {
    const params = sampleParams();
    const url = buildVnpayRedirectUrl(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      params,
      secretKey,
    );
    const query = Object.fromEntries(new URL(url).searchParams.entries());
    query.vnp_Amount = String(toVnpayAmount(1));

    expect(verifyVnpaySignature(query, secretKey)).toBe(false);
  });

  it('rejects a query signed with the wrong secret', () => {
    const params = sampleParams();
    const url = buildVnpayRedirectUrl(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      params,
      'wrong-secret',
    );
    const query = Object.fromEntries(new URL(url).searchParams.entries());

    expect(verifyVnpaySignature(query, secretKey)).toBe(false);
  });

  it('rejects a query with no vnp_SecureHash at all', () => {
    expect(verifyVnpaySignature({ vnp_TxnRef: 'abc' }, secretKey)).toBe(false);
  });

  it('converts between VND and VNPAY integer amount (x100) without float drift', () => {
    expect(toVnpayAmount(200000)).toBe(20000000);
    expect(fromVnpayAmount(20000000)).toBe(200000);
    expect(fromVnpayAmount('20000000')).toBe(200000);
  });

  it('formats dates as yyyyMMddHHmmss in Asia/Ho_Chi_Minh time', () => {
    const formatted = formatVnpayDate(new Date('2026-08-08T10:00:00Z'));
    expect(formatted).toMatch(/^\d{14}$/);
    expect(formatted.slice(0, 8)).toBe('20260808');
  });

  it('generates unique hex-only txn refs', () => {
    const a = generateTxnRef();
    const b = generateTxnRef();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
});
