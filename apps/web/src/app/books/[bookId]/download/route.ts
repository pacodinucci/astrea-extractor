import { buildBookTxtExport } from "@astrea/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

type DownloadRouteContext = {
  params: Promise<{
    bookId: string;
  }>;
};

export async function GET(_request: Request, { params }: DownloadRouteContext) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { bookId } = await params;
  const exportFile = await buildBookTxtExport(bookId, session.user.id);

  if (!exportFile) {
    notFound();
  }

  return new Response(exportFile.content, {
    headers: {
      "Content-Disposition": `attachment; filename="${exportFile.fileName}"`,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}