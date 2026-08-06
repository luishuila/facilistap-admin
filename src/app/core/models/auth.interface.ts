export interface LoginRequest {
  users: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    name: string;
    username: string;
    lastname: string;
    uiid: string;
    img: string;
    roles: Array<{
      idRol: number;
      name: string;
      role: string;
    }>;
  };
  access_token: string;
  refresh_token: string;
}

export interface TokenPayload {
  id: string;
  sid: string;
  exp: number;
  iat: number;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}
