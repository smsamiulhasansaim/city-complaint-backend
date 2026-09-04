import { Category } from '@prisma/client';
import prisma from '../config/db';
import AppError from '../utils/AppError';
import { cacheGet, cacheSet, cacheDel, CacheKeys, CacheTTL } from '../utils/cache';

/** Public list of active categories — served from Redis when available. */
export const listCategories = async (): Promise<Category[]> => {
  const cached = await cacheGet<Category[]>(CacheKeys.categories);
  if (cached) return cached;

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  await cacheSet(CacheKeys.categories, categories, CacheTTL.categories);
  return categories;
};

export const getCategoryById = async (id: string) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new AppError('Category not found.', 404);
  return category;
};

interface CategoryInput {
  name: string;
  description?: string;
  isActive?: boolean;
}

export const createCategory = async (data: CategoryInput) => {
  const category = await prisma.category.create({ data });
  await cacheDel(CacheKeys.categories);
  return category;
};

export const updateCategory = async (id: string, data: Partial<CategoryInput>) => {
  await getCategoryById(id);
  const category = await prisma.category.update({ where: { id }, data });
  await cacheDel(CacheKeys.categories);
  return category;
};

export const deleteCategory = async (id: string) => {
  await getCategoryById(id);

  // Preserve historical complaints: if the category is referenced, soft-disable
  // it instead of a hard delete that would break the FK.
  const inUse = await prisma.complaint.count({ where: { categoryId: id } });
  if (inUse > 0) {
    const category = await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
    await cacheDel(CacheKeys.categories);
    return { softDeleted: true, category };
  }

  await prisma.category.delete({ where: { id } });
  await cacheDel(CacheKeys.categories);
  return { deleted: true };
};
