/**
 * Shape of the inbound IPN call VNPAY makes as a GET request — every field
 * arrives as a query string value, never a JSON body. Deliberately NOT a
 * class-validator DTO: the signature (vnp_SecureHash) is computed over every
 * field VNPAY sends, so the controller binds the raw `Record<string,string>`
 * query untouched (bypassing the global ValidationPipe's `whitelist: true`,
 * which would otherwise silently drop any field not listed here before
 * signature verification ever runs). This interface documents the fields the
 * service actually reads; see vnpay.util.ts for the signing algorithm.
 */
export interface VnpayIpnQuery {
  vnp_TxnRef: string;
  vnp_Amount: string;
  vnp_ResponseCode: string;
  vnp_TransactionStatus?: string;
  vnp_TransactionNo?: string;
  vnp_BankCode?: string;
  vnp_PayDate?: string;
  vnp_OrderInfo?: string;
  vnp_TmnCode?: string;
  vnp_SecureHash: string;
  vnp_SecureHashType?: string;
  [key: string]: string | undefined;
}
