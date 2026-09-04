import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/sendResponse';
import { getPagination, buildMeta } from '../utils/pagination';
import * as srService from '../services/serviceRequest.service';

export const createServiceRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const sr = await srService.createServiceRequest(req.user!.id, req.body);
    sendSuccess(
      res,
      201,
      'Service request created — proceed to payment to submit it',
      sr
    );
  }
);

export const listServiceRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, skip } = getPagination(req.query);
    const { status, serviceId, sort } = req.query as Record<string, string | undefined>;

    const { requests, total } = await srService.listServiceRequests({
      role: req.user!.role,
      userId: req.user!.id,
      page,
      limit,
      skip,
      status: status as never,
      serviceId,
      sort: sort as 'newest' | 'oldest' | undefined,
    });

    sendSuccess(
      res,
      200,
      'Service requests fetched',
      requests,
      buildMeta(total, page, limit)
    );
  }
);

export const getServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  const sr = await srService.getServiceRequestById(
    req.params.id,
    req.user!.role,
    req.user!.id
  );
  sendSuccess(res, 200, 'Service request fetched', sr);
});

export const assignServiceRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const sr = await srService.assignServiceRequest(
      req.user!.id,
      req.params.id,
      req.body.agentId
    );
    sendSuccess(res, 200, 'Service request assigned', sr);
  }
);

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const sr = await srService.changeServiceRequestStatus(
    req.user!.id,
    req.user!.role,
    req.params.id,
    req.body.status,
    req.body.note
  );
  sendSuccess(res, 200, 'Service request status updated', sr);
});
