import { api } from './client';

export interface User {
  id: string;
  name: string;
  email: string;
  orgId: string | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export async function signup(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await api.post('/user/signup', { name, email, password });
  return res.data.data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post('/user/login', { email, password });
  return res.data.data;
}
