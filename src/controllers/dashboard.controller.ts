import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/sendResponse';
import * as dashboardService from '../services/dashboard.service';

export const adminDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const data = await dashboardService.getAdminDashboard();
  sendSuccess(res, 200, 'Admin dashboard', data);
});

export const agentDashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await dashboardService.getAgentDashboard(req.user!.id);
  sendSuccess(res, 200, 'Agent dashboard', data);
});

export const citizenDashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await dashboardService.getCitizenDashboard(req.user!.id);
  sendSuccess(res, 200, 'Citizen dashboard', data);
});
