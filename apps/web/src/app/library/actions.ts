"use server";

import { requestBookIngestion } from "@astrea/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function requestIngestionAction(formData: FormData) {
  const astreaBookId = String(formData.get("astreaBookId") ?? "").trim();

  if (!astreaBookId) {
    redirect("/library?error=missing-book-id");
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const result = await requestBookIngestion({
    astreaBookId,
    requestedByUserId: session.user.id,
  });

  if (result.kind === "book_available") {
    redirect(`/library?status=available&bookId=${result.bookId}`);
  }

  if (result.kind === "job_already_running") {
    redirect(`/library?status=processing&bookId=${result.bookId}&jobId=${result.jobId}`);
  }

  redirect(`/library?status=queued&bookId=${result.bookId}&jobId=${result.jobId}`);
}