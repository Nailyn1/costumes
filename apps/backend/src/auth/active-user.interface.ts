import { Request } from 'express';
import { Socket } from 'socket.io';

export interface ActiveUserData {
  id: string;
  login: string;
  refreshToken?: string;
}

export interface RequestWithUser extends Request {
  user: ActiveUserData;
}

export interface SocketWithAuth extends Socket {
  user: ActiveUserData;
}
