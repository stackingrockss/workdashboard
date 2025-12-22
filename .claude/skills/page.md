# Skill: /page

> Scaffold Next.js pages with App Router patterns

## Purpose

Generate Next.js pages following App Router conventions:
- Server components by default
- Proper layouts and loading states
- Metadata configuration
- Route parameters
- Data fetching patterns

## Questions to Ask

1. **Page path** - URL path (e.g., "/notes", "/opportunities/[id]/settings")
2. **Page type** - What kind?
   - List - Display collection of items
   - Detail - Single item view
   - Form - Create/edit form
   - Dashboard - Multi-section overview
   - Settings - Configuration page
3. **Dynamic route?** - Has route parameters? (e.g., `[id]`, `[slug]`)
4. **Needs loading state?** - Should have loading.tsx?
5. **Needs error handling?** - Should have error.tsx?

## Output Files

```
src/app/(app)/{path}/page.tsx
src/app/(app)/{path}/loading.tsx     (if loading state needed)
src/app/(app)/{path}/error.tsx       (if error handling needed)
src/app/(app)/{path}/layout.tsx      (if custom layout needed)
```

## Page Templates

### List Page (Server Component)

```tsx
// src/app/(app)/{entities}/page.tsx
// List page for {entities}

import { Suspense } from "react";
import { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { {Entity}List } from "@/components/features/{entities}/{Entity}List";
import { {Entity}ListSkeleton } from "@/components/features/{entities}/{Entity}ListSkeleton";

export const metadata: Metadata = {
  title: "{Entities} | Briefcase",
  description: "Manage your {entities}",
};

export default async function {Entities}Page() {
  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{Entities}</h1>
          <p className="text-muted-foreground">
            Manage and organize your {entities}
          </p>
        </div>
      </div>

      <Suspense fallback={<{Entity}ListSkeleton />}>
        <{Entity}ListContent />
      </Suspense>
    </div>
  );
}

async function {Entity}ListContent() {
  const user = await requireAuth();

  const {entities} = await prisma.{entity}.findMany({
    where: {
      organizationId: user.organization.id,
    },
    include: {
      owner: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return <{Entity}List {entities}={{entities}} />;
}
```

### Detail Page (Server Component)

```tsx
// src/app/(app)/{entities}/[id]/page.tsx
// Detail page for single {entity}

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { {Entity}Detail } from "@/components/features/{entities}/{Entity}Detail";

interface {Entity}PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: {Entity}PageProps): Promise<Metadata> {
  const { id } = await params;
  const {entity} = await prisma.{entity}.findUnique({
    where: { id },
    select: { name: true },
  });

  return {
    title: {entity}?.name
      ? `${{{entity}}.name} | Briefcase`
      : "{Entity} | Briefcase",
  };
}

export default async function {Entity}Page({ params }: {Entity}PageProps) {
  const { id } = await params;
  const user = await requireAuth();

  const {entity} = await prisma.{entity}.findFirst({
    where: {
      id,
      organizationId: user.organization.id,
    },
    include: {
      owner: true,
      // Add other relations
    },
  });

  if (!{entity}) {
    notFound();
  }

  return (
    <div className="container py-6">
      <{Entity}Detail {entity}={{entity}} />
    </div>
  );
}
```

### Form Page (Client Component)

```tsx
// src/app/(app)/{entities}/new/page.tsx
// Create form page for {entity}

import { Metadata } from "next";
import { {Entity}Form } from "@/components/features/{entities}/{Entity}Form";

export const metadata: Metadata = {
  title: "Create {Entity} | Briefcase",
};

export default function New{Entity}Page() {
  return (
    <div className="container py-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Create {Entity}</h1>
        <p className="text-muted-foreground">
          Fill in the details to create a new {entity}
        </p>
      </div>

      <{Entity}Form />
    </div>
  );
}
```

### Edit Page (Server + Client)

```tsx
// src/app/(app)/{entities}/[id]/edit/page.tsx
// Edit form page for {entity}

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { {Entity}Form } from "@/components/features/{entities}/{Entity}Form";

interface Edit{Entity}PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Edit {Entity} | Briefcase",
};

export default async function Edit{Entity}Page({ params }: Edit{Entity}PageProps) {
  const { id } = await params;
  const user = await requireAuth();

  const {entity} = await prisma.{entity}.findFirst({
    where: {
      id,
      organizationId: user.organization.id,
    },
  });

  if (!{entity}) {
    notFound();
  }

  return (
    <div className="container py-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Edit {Entity}</h1>
        <p className="text-muted-foreground">
          Update the {entity} details
        </p>
      </div>

      <{Entity}Form {entity}={{entity}} />
    </div>
  );
}
```

### Dashboard/Overview Page

```tsx
// src/app/(app)/dashboard/page.tsx
// Dashboard with multiple sections

import { Suspense } from "react";
import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Dashboard | Briefcase",
};

export default async function DashboardPage() {
  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your sales pipeline
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<StatCardSkeleton />}>
          <StatsSection />
        </Suspense>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <RecentActivitySection />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <UpcomingTasksSection />
        </Suspense>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

async function StatsSection() {
  const user = await requireAuth();

  const [totalOpportunities, openOpportunities, totalValue] = await Promise.all([
    prisma.opportunity.count({
      where: { organizationId: user.organization.id },
    }),
    prisma.opportunity.count({
      where: {
        organizationId: user.organization.id,
        stage: { notIn: ["closedWon", "closedLost"] },
      },
    }),
    prisma.opportunity.aggregate({
      where: {
        organizationId: user.organization.id,
        stage: { notIn: ["closedLost"] },
      },
      _sum: { amountArr: true },
    }),
  ]);

  return (
    <>
      <StatCard title="Total Opportunities" value={totalOpportunities} />
      <StatCard title="Open Deals" value={openOpportunities} />
      <StatCard
        title="Pipeline Value"
        value={`$${((totalValue._sum.amountArr || 0) / 1000).toFixed(0)}K`}
      />
      <StatCard title="Win Rate" value="--%" />
    </>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

async function RecentActivitySection() {
  // Fetch recent activity
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">No recent activity</p>
      </CardContent>
    </Card>
  );
}

async function UpcomingTasksSection() {
  // Fetch upcoming tasks
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">No upcoming tasks</p>
      </CardContent>
    </Card>
  );
}
```

## Loading State Template

```tsx
// src/app/(app)/{entities}/loading.tsx
// Loading state for {entities} page

import { Skeleton } from "@/components/ui/skeleton";

export default function {Entities}Loading() {
  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

## Error State Template

```tsx
// src/app/(app)/{entities}/error.tsx
// Error state for {entities} page

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function {Entities}Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("{Entities} page error:", error);
  }, [error]);

  return (
    <div className="container py-6">
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">
            Failed to load {entities}. Please try again.
          </p>
          <Button onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Not Found Template

```tsx
// src/app/(app)/{entities}/[id]/not-found.tsx
// 404 state for {entity} detail page

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function {Entity}NotFound() {
  return (
    <div className="container py-6">
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <FileQuestion className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold mb-2">{Entity} not found</h2>
          <p className="text-muted-foreground mb-4">
            The {entity} you're looking for doesn't exist or you don't have access.
          </p>
          <Button asChild>
            <Link href="/{entities}">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {Entities}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Route Group Patterns

```
src/app/
├── (app)/                    # Authenticated app routes (with sidebar)
│   ├── layout.tsx            # App layout with sidebar
│   ├── opportunities/
│   ├── accounts/
│   └── settings/
├── (marketing)/              # Public marketing routes
│   ├── layout.tsx            # Marketing layout
│   ├── page.tsx              # Landing page
│   └── pricing/
├── (auth)/                   # Auth routes
│   ├── layout.tsx            # Centered auth layout
│   ├── login/
│   └── signup/
└── api/                      # API routes
```

## Key Patterns

### Metadata

```tsx
// Static metadata
export const metadata: Metadata = {
  title: "Page Title | Briefcase",
  description: "Page description",
};

// Dynamic metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await prisma.item.findUnique({ where: { id } });
  return {
    title: item?.name ? `${item.name} | Briefcase` : "Item | Briefcase",
  };
}
```

### Route Parameters (Next.js 15)

```tsx
// params is now a Promise in Next.js 15
interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ query?: string }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { query } = await searchParams;
  // ...
}
```

### Data Fetching

```tsx
// Server Component - direct Prisma access
async function Page() {
  const user = await requireAuth();
  const data = await prisma.model.findMany({
    where: { organizationId: user.organization.id },
  });
}

// With Suspense for streaming
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <DataComponent />
    </Suspense>
  );
}
```

## Chaining

Before creating pages, ensure you have:
- **`/model`** - Prisma model exists
- **`/api`** - API endpoints exist (for client components)
- **`/component`** - UI components exist

After creating pages, consider:
- **`/test`** - Page tests

## Checklist

- [ ] Server component by default
- [ ] Proper metadata configured
- [ ] Loading state (loading.tsx)
- [ ] Error handling (error.tsx)
- [ ] Not found handling (not-found.tsx)
- [ ] Organization scoping in queries
- [ ] Suspense boundaries for data fetching
- [ ] Proper params await (Next.js 15)
