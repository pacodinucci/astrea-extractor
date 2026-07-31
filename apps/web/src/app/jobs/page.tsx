import { listActiveIngestionJobs, listRecentIngestionJobs } from "@astrea/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function JobsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const [activeJobs, recentJobs] = await Promise.all([
    listActiveIngestionJobs(),
    listRecentIngestionJobs(),
  ]);

  return (
    <main className="page">
      <section className="hero library-section">
        <p className="eyebrow">Jobs</p>
        <h1>Cola de procesamiento</h1>
        <p>
          El servidor procesa un solo libro a la vez. Los demás pedidos quedan
          en cola y avanzan en orden de llegada.
        </p>
      </section>

      <section className="content-section">
        <h2>Activos</h2>
        {activeJobs.length === 0 ? (
          <p className="muted">No hay jobs activos.</p>
        ) : (
          <JobList jobs={activeJobs} />
        )}
      </section>

      <section className="content-section">
        <h2>Recientes</h2>
        {recentJobs.length === 0 ? (
          <p className="muted">Todavía no hay jobs registrados.</p>
        ) : (
          <JobList jobs={recentJobs} />
        )}
      </section>
    </main>
  );
}

type JobListProps = {
  jobs: Awaited<ReturnType<typeof listRecentIngestionJobs>>;
};

function JobList({ jobs }: JobListProps) {
  return (
    <ol className="book-list">
      {jobs.map((job) => (
        <li key={job.id}>
          <strong>{job.book.title ?? `Libro ${job.book.astreaBookId}`}</strong>
          <span>Job: {job.id}</span>
          <span>Estado: {job.status}</span>
          <span>
            Progreso: {job.progressDone}/{job.progressTotal} · Fallidas: {job.progressFailed}
          </span>
          <span>Solicitado por: {job.requestedByUser.email}</span>
        </li>
      ))}
    </ol>
  );
}