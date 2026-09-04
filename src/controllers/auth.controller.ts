import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/sendResponse';
import * as authService from '../services/auth.service';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerCitizen(req.body);
  sendSuccess(res, 201, 'Registration successful', result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  sendSuccess(res, 200, 'Login successful', result);
});

export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.googleLogin(req.body.idToken);
  sendSuccess(res, 200, 'Google login successful', result);
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  sendSuccess(res, 200, 'Current user fetched', user);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.updateMe(req.user!.id, req.body);
  sendSuccess(res, 200, 'Profile updated', user);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(
    req.user!.id,
    currentPassword,
    newPassword
  );
  sendSuccess(res, 200, 'Password changed successfully', result);
});
