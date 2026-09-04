import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/sendResponse';
import { getPagination, buildMeta } from '../utils/pagination';
import * as notificationService from '../services/notification.service';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req.query);
  const isReadQuery = req.query.isRead as string | undefined;
  const isRead = isReadQuery === undefined ? undefined : isReadQuery === 'true';

  const { notifications, total, unreadCount } =
    await notificationService.listNotifications({
      userId: req.user!.id,
      page,
      limit,
      skip,
      isRead,
    });

  const meta = { ...buildMeta(total, page, limit), unreadCount };
  sendSuccess(res, 200, 'Notifications fetched', notifications, meta);
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await notificationService.markRead(req.user!.id, req.params.id);
  sendSuccess(res, 200, 'Notification marked as read', notification);
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const result = await notificationService.markAllRead(req.user!.id);
  sendSuccess(res, 200, 'All notifications marked as read', result);
});
