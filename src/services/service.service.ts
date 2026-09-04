import { Service } from '@prisma/client';
import prisma from '../config/db';
import AppError from '../utils/AppError';
import { cacheGet, cacheSet, cacheDel, CacheKeys, CacheTTL } from '../utils/cache';

/** Public catalog of active municipal services — cached in Redis. */
export const listServices = async (): Promise<Service[]> => {
  const cached = await cacheGet<Service[]>(CacheKeys.services);
  if (cached) return cached;

  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  await cacheSet(CacheKeys.services, services, CacheTTL.services);
  return services;
};

export const getServiceById = async (id: string) => {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) throw new AppError('Service not found.', 404);
  return service;
};

interface ServiceInput {
  name: string;
  description: string;
  fee: number;
  isActive?: boolean;
}

export const createService = async (data: ServiceInput) => {
  const service = await prisma.service.create({ data });
  await cacheDel(CacheKeys.services);
  return service;
};

export const updateService = async (id: string, data: Partial<ServiceInput>) => {
  await getServiceById(id);
  const service = await prisma.service.update({ where: { id }, data });
  await cacheDel(CacheKeys.services);
  return service;
};

export const deleteService = async (id: string) => {
  await getServiceById(id);

  // Soft-disable when the service already has requests, to keep history intact.
  const inUse = await prisma.serviceRequest.count({ where: { serviceId: id } });
  if (inUse > 0) {
    const service = await prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
    await cacheDel(CacheKeys.services);
    return { softDeleted: true, service };
  }

  await prisma.service.delete({ where: { id } });
  await cacheDel(CacheKeys.services);
  return { deleted: true };
};
