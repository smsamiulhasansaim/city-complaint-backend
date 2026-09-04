import prisma from '../config/db';
import AppError from '../utils/AppError';
import { AppRole } from '../utils/jwt';
import { publicUserSelect } from './complaint.service';

const reviewInclude = {
  citizen: { select: publicUserSelect },
  complaint: { select: { id: true, title: true, status: true } },
};

export const createReview = async (
  citizenId: string,
  input: { complaintId: string; rating: number; comment: string }
) => {
  const complaint = await prisma.complaint.findUnique({
    where: { id: input.complaintId },
  });
  if (!complaint) throw new AppError('Complaint not found.', 404);
  if (complaint.citizenId !== citizenId) {
    throw new AppError('You can only review your own complaints.', 403);
  }
  if (complaint.status !== 'RESOLVED' && complaint.status !== 'CLOSED') {
    throw new AppError('You can only review a resolved or closed complaint.', 400);
  }

  const existing = await prisma.review.findUnique({
    where: { complaintId: input.complaintId },
  });
  if (existing) {
    throw new AppError('You have already reviewed this complaint.', 409);
  }

  return prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        citizenId,
        complaintId: input.complaintId,
        rating: input.rating,
        comment: input.comment,
      },
      include: reviewInclude,
    });

    if (complaint.assignedAgentId) {
      await tx.notification.create({
        data: {
          userId: complaint.assignedAgentId,
          type: 'COMPLAINT',
          message: `Your resolved complaint received a ${input.rating}★ review.`,
        },
      });
    }

    return review;
  });
};

export const getReviewByComplaint = async (complaintId: string) => {
  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    select: { id: true },
  });
  if (!complaint) throw new AppError('Complaint not found.', 404);

  // At most one review per complaint (unique constraint).
  return prisma.review.findUnique({
    where: { complaintId },
    include: reviewInclude,
  });
};

export const deleteReview = async (id: string, role: AppRole, userId: string) => {
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw new AppError('Review not found.', 404);
  if (role !== 'ADMIN' && review.citizenId !== userId) {
    throw new AppError('You can only delete your own review.', 403);
  }

  await prisma.review.delete({ where: { id } });
  return { deleted: true };
};
