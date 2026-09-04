import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/sendResponse';
import { getPagination, buildMeta } from '../utils/pagination';
import * as complaintService from '../services/complaint.service';

export const createComplaint = asyncHandler(async (req: Request, res: Response) => {
  const complaint = await complaintService.createComplaint(req.user!.id, req.body);
  sendSuccess(res, 201, 'Complaint filed successfully', complaint);
});

export const listComplaints = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, categoryId, priority, ward, search, sort } = req.query as Record<
    string,
    string | undefined
  >;

  const { complaints, total } = await complaintService.listComplaints({
    role: req.user!.role,
    userId: req.user!.id,
    page,
    limit,
    skip,
    status: status as never,
    categoryId,
    priority: priority as never,
    ward,
    search,
    sort: sort as 'newest' | 'oldest' | undefined,
  });

  sendSuccess(res, 200, 'Complaints fetched', complaints, buildMeta(total, page, limit));
});

export const getComplaint = asyncHandler(async (req: Request, res: Response) => {
  const complaint = await complaintService.getComplaintById(
    req.params.id,
    req.user!.role,
    req.user!.id
  );
  sendSuccess(res, 200, 'Complaint fetched', complaint);
});

export const updateComplaint = asyncHandler(async (req: Request, res: Response) => {
  const complaint = await complaintService.updateComplaint(
    req.params.id,
    req.user!.id,
    req.body
  );
  sendSuccess(res, 200, 'Complaint updated', complaint);
});

export const deleteComplaint = asyncHandler(async (req: Request, res: Response) => {
  const result = await complaintService.deleteComplaint(
    req.params.id,
    req.user!.role,
    req.user!.id
  );
  sendSuccess(res, 200, 'Complaint deleted', result);
});
