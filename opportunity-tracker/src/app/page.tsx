import Link from "next/link";

export default function Home() {
  return (
    <div className="py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
        <p className="text-muted-foreground">Start tracking deals in the Kanban view.</p>
      </div>
      <div className="mt-6">
        <Link
          href="/opportunities"
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Go to Opportunities
        </Link>
      </div>
    </div>
  );
}
