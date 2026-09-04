import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/sendResponse';
import { getPagination, buildMeta } from '../utils/pagination';
import * as userService from '../services/user.service';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req.query);
  const { role, status, search } = req.query as {
    role?: 'CITIZEN' | 'AGENT' | 'ADMIN';
    status?: 'ACTIVE' | 'BANNED';
    search?: string;
  };

  const { users, total } = await userService.listUsers({
    page,
    limit,
    skip,
    role,
    status,
    search,
  });

  sendSuccess(res, 200, 'Users fetched', users, buildMeta(total, page, limit));
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id);
  sendSuccess(res, 200, 'User fetched', user);
});

export const createAgent = asyncHandler(async (req: Request, res: Response) => {
  const agent = await userService.createAgent(req.body);
  sendSuccess(res, 201, 'Agent account created', agent);
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateRole(req.user!.id, req.params.id, req.body.role);
  sendSuccess(res, 200, 'User role updated', user);
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateStatus(
    req.user!.id,
    req.params.id,
    req.body.status
  );
  sendSuccess(res, 200, 'User status updated', user);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.deleteUser(req.user!.id, req.params.id);
  sendSuccess(res, 200, 'User deleted', result);
});
