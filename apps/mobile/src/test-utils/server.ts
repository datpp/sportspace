// jest-expo dùng testEnvironment 'react-native' (customExportConditions bao gồm
// 'react-native'), nên phải import từ 'msw/native' — 'msw/node' export map tự
// null hoá dưới điều kiện 'react-native' vì dùng module `http` không tồn tại ở RN.
import { setupServer } from 'msw/native';
import {
  getAuthMock,
  getBookingsMock,
  getCourtsMock,
  getMatchesMock,
  getNotificationsMock,
  getPaymentsMock,
  getReviewsMock,
  getVenuesMock,
} from '@sportspace/shared/mocks';

// Các getXMock() trả về HttpHandler[] được type từ gói con 'msw' (qua *.msw.ts),
// còn setupServer ở đây đến từ 'msw/native' — hai điều kiện export khác nhau của
// cùng 1 package khiến TS coi lớp RequestHandler là hai identity khác nhau dù cùng
// runtime. Ép kiểu tại đây, không ảnh hưởng hành vi lúc chạy.
export const server = setupServer(
  ...([
    ...getAuthMock(),
    ...getVenuesMock(),
    ...getCourtsMock(),
    ...getBookingsMock(),
    ...getPaymentsMock(),
    ...getNotificationsMock(),
    ...getMatchesMock(),
    ...getReviewsMock(),
  ] as unknown as Parameters<typeof setupServer>),
);
