import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { sendSuccess } from '../utils/sendResponse';
import * as serviceService from '../services/service.service';

export const listServices = asyncHandler(async (_req: Request, res: Response) => {
  const services = await serviceService.listServices();
  sendSuccess(res, 200, 'Services fetched', services);
});

export const getService = asyncHandler(async (req: Request, res: Response) => {
  const service = await serviceService.getServiceById(req.params.id);
  sendSuccess(res, 200, 'Service fetched', service);
});

export const createService = asyncHandler(async (req: Request, res: Response) => {
  const service = await serviceService.createService(req.body);
  sendSuccess(res, 201, 'Service created', service);
});

export const updateService = asyncHandler(async (req: Request, res: Response) => {
  const service = await serviceService.updateService(req.params.id, req.body);
  sendSuccess(res, 200, 'Service updated', service);
});

export const deleteService = asyncHandler(async (req: Request, res: Response) => {
  const result = await serviceService.deleteService(req.params.id);
  sendSuccess(res, 200, 'Service deleted', result);
});
