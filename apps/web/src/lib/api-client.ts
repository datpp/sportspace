import axios from 'axios';
import { getAuth, getVenues, getCourts, getMerchant, getAdmin, getBookings } from '@sportspace/shared';

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? 'http://localhost:3000';

export function createAnonymousApiClient() {
  const instance = axios.create({ baseURL: BACKEND_API_URL });
  return { auth: getAuth(instance) };
}

export function createAuthenticatedApiClient(accessToken: string) {
  const instance = axios.create({
    baseURL: BACKEND_API_URL,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return {
    venues: getVenues(instance),
    courts: getCourts(instance),
    merchant: getMerchant(instance),
    admin: getAdmin(instance),
    bookings: getBookings(instance),
  };
}
