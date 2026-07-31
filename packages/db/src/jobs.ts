import { prisma } from "./client";

export async function listRecentIngestionJobs() {
  return prisma.ingestionJob.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    include: {
      book: true,
      requestedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function listActiveIngestionJobs() {
  return prisma.ingestionJob.findMany({
    where: {
      status: {
        in: ["queued", "running"],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      book: true,
      requestedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}