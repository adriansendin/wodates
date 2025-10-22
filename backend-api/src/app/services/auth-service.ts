import { RegisterRequest } from '../../domain/entities/Auth';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export interface AuthService {
  registerUser(registerRequest: RegisterRequest): Promise<AuthUser>;
  validateCredentials(email: string, password: string): Promise<AuthUser>;
}

