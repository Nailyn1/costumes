import { Request } from 'express';

export interface ActiveUserData {
  id: string;
  login: string;
  refreshToken?: string;
}

export interface RequestWithUser extends Request {
  user: ActiveUserData;
}
