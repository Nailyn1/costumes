import { Request } from 'express';

export interface ActiveUserData {
  id: string;
  login: string;
}

export interface RequestWithUser extends Request {
  user: ActiveUserData;
}
