import { prisma } from "../../lib/prisma";

export async function getReviews(filters = {}) {
  return prisma.review.findMany({
    where: filters,
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getReview(id) {
  return prisma.review.findUnique({
    where: { id },
  });
}

export async function createReview(data) {
  return prisma.review.create({
    data,
  });
}

export async function updateReview(id, data) {
  return prisma.review.update({
    where: { id },
    data,
  });
}

export async function deleteReview(id) {
  return prisma.review.delete({
    where: { id },
  });
}