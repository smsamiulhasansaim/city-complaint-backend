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

export const assignComplaint = asyncHandler(async (req: Request, res: Response) => {
  const complaint = await complaintService.assignComplaint(
    req.user!.id,
    req.params.id,
    req.body.agentId
  );
  sendSuccess(res, 200, 'Complaint assigned', complaint);
});

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const complaint = await complaintService.changeComplaintStatus(
    req.user!.id,
    req.user!.role,
    req.params.id,
    req.body.status,
    req.body.note
  );
  sendSuccess(res, 200, 'Complaint status updated', complaint);
});

export const addUpdate = asyncHandler(async (req: Request, res: Response) => {
  const update = await complaintService.addComplaintUpdate(
    req.user!.id,
    req.user!.role,
    req.params.id,
    req.body.note
  );
  sendSuccess(res, 201, 'Update added', update);
});

export const listUpdates = asyncHandler(async (req: Request, res: Response) => {
  const updates = await complaintService.listComplaintUpdates(
    req.params.id,
    req.user!.role,
    req.user!.id
  );
  sendSuccess(res, 200, 'Complaint timeline fetched', updates);
});
