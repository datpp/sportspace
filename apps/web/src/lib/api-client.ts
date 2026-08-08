import axios from 'axios';
import { getAuth } from '@sportspace/shared';

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? 'http://localhost:3000';

export function createAnonymousApiClient() {
  const instance = axios.create({ baseURL: BACKEND_API_URL });
  return { auth: getAuth(instance) };
}
