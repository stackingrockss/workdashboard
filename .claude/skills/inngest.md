# Skill: /inngest

> Scaffold background job functions with Inngest

## Purpose

Generate Inngest background job functions for:
- AI content generation
- External API syncing
- Async processing
- Scheduled tasks

## Questions to Ask

1. **Job name** - kebab-case (e.g., "generate-report", "sync-data", "parse-transcript")
2. **Event name** - namespace/action format (e.g., "document/generate", "gong/sync")
3. **Trigger type** - How is it triggered?
   - Event (triggered by `inngest.send()`)
   - Cron (scheduled)
   - Both (multiple triggers)
4. **Cron schedule** - If cron, what schedule? (e.g., "0 * * * *" for hourly)
5. **Event data** - What data does it receive?
   - IDs (documentId, opportunityId, userId)
   - Context (organizationId always required)
   - Configuration options

## Output Files

```
src/lib/inngest/functions/{job-name}.ts   (create)
src/app/api/inngest/route.ts              (update - register function)
```

## Event-Triggered Job Template

```typescript
// src/lib/inngest/functions/{job-name}.ts
// {Description of what this job does}

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";

// =============================================================================
// Event Data Interface
// =============================================================================

interface {JobName}EventData {
  // Required IDs
  {entity}Id: string;
  organizationId: string;
  userId: string;

  // Optional configuration
  options?: {
    // Add job-specific options
  };
}

// =============================================================================
// Job Function
// =============================================================================

export const {jobName}Job = inngest.createFunction(
  {
    id: "{job-name}",
    name: "{Human Readable Job Name}",
    retries: 3,
    // Optional: Limit concurrent executions
    // concurrency: { limit: 5 },
  },
  { event: "{namespace}/{action}" },
  async ({ event, step }) => {
    const { {entity}Id, organizationId, userId, options } = event.data as {JobName}EventData;

    // =========================================================================
    // Step 1: Update status to processing
    // =========================================================================
    await step.run("update-status-processing", async () => {
      await prisma.{entity}.update({
        where: { id: {entity}Id },
        data: {
          processingStatus: "processing",
          processingError: null,
        },
      });
    });

    // =========================================================================
    // Step 2: Fetch required data
    // =========================================================================
    const {entity} = await step.run("fetch-{entity}", async () => {
      const result = await prisma.{entity}.findUnique({
        where: { id: {entity}Id },
        include: {
          // Add necessary relations
        },
      });

      if (!result) {
        throw new Error(`{Entity} not found: ${entity}Id`);
      }

      return result;
    });

    // =========================================================================
    // Step 3: Perform main processing
    // =========================================================================
    const processingResult = await step.run("process-{entity}", async () => {
      try {
        // Main processing logic here
        // Examples:
        // - Call AI service
        // - Fetch from external API
        // - Transform data
        // - Generate content

        return {
          success: true,
          result: "processed data",
        };
      } catch (error) {
        console.error("[{job-name}] Processing error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    // =========================================================================
    // Step 4: Handle result
    // =========================================================================
    if (!processingResult.success) {
      await step.run("update-status-failed", async () => {
        await prisma.{entity}.update({
          where: { id: {entity}Id },
          data: {
            processingStatus: "failed",
            processingError: processingResult.error,
          },
        });
      });

      throw new Error(`Processing failed: ${processingResult.error}`);
    }

    // =========================================================================
    // Step 5: Save result and update status
    // =========================================================================
    await step.run("save-result", async () => {
      await prisma.{entity}.update({
        where: { id: {entity}Id },
        data: {
          processingStatus: "completed",
          processedAt: new Date(),
          // Save processing result
          // content: processingResult.result,
        },
      });
    });

    // =========================================================================
    // Step 6: Optional - Trigger downstream jobs
    // =========================================================================
    // await step.run("trigger-downstream", async () => {
    //   await inngest.send({
    //     name: "another/job",
    //     data: { ... },
    //   });
    // });

    // =========================================================================
    // Return summary
    // =========================================================================
    return {
      success: true,
      {entity}Id,
      organizationId,
      processedAt: new Date().toISOString(),
    };
  }
);
```

## Cron-Triggered Job Template

```typescript
// src/lib/inngest/functions/{job-name}.ts
// Scheduled job that runs on a cron schedule

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";

export const {jobName}Job = inngest.createFunction(
  {
    id: "{job-name}",
    name: "{Human Readable Job Name}",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour - adjust as needed
  async ({ step }) => {
    // =========================================================================
    // Step 1: Get items to process
    // =========================================================================
    const itemsToProcess = await step.run("fetch-items", async () => {
      return await prisma.{entity}.findMany({
        where: {
          // Filter criteria
          status: "pending",
          // Only process items older than X
          createdAt: {
            lt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          },
        },
        take: 100, // Batch size
      });
    });

    if (itemsToProcess.length === 0) {
      return { processed: 0, message: "No items to process" };
    }

    // =========================================================================
    // Step 2: Process each item
    // =========================================================================
    let processed = 0;
    let failed = 0;

    for (const item of itemsToProcess) {
      const result = await step.run(`process-${item.id}`, async () => {
        try {
          // Process individual item
          await prisma.{entity}.update({
            where: { id: item.id },
            data: {
              status: "processed",
              processedAt: new Date(),
            },
          });
          return { success: true };
        } catch (error) {
          console.error(`[{job-name}] Failed to process ${item.id}:`, error);
          return { success: false };
        }
      });

      if (result.success) {
        processed++;
      } else {
        failed++;
      }
    }

    // =========================================================================
    // Return summary
    // =========================================================================
    return {
      total: itemsToProcess.length,
      processed,
      failed,
      completedAt: new Date().toISOString(),
    };
  }
);
```

## Multi-Trigger Job Template

```typescript
// src/lib/inngest/functions/{job-name}.ts
// Job that can be triggered manually or on schedule

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";

interface ManualTriggerData {
  organizationId: string;
  userId: string;
  // Manual-specific options
}

export const {jobName}Job = inngest.createFunction(
  {
    id: "{job-name}",
    name: "{Human Readable Job Name}",
    retries: 2,
    concurrency: { limit: 3 },
  },
  [
    { event: "{namespace}/sync.manual" },
    { cron: "0 */6 * * *" }, // Every 6 hours
  ],
  async ({ event, step }) => {
    // Determine if manual or scheduled
    const isManual = event.name === "{namespace}/sync.manual";
    const data = isManual ? (event.data as ManualTriggerData) : null;

    // Get organizations to sync
    const organizations = await step.run("get-organizations", async () => {
      if (isManual && data?.organizationId) {
        // Manual: sync specific org
        return await prisma.organization.findMany({
          where: { id: data.organizationId },
        });
      } else {
        // Scheduled: sync all orgs with integration enabled
        return await prisma.organization.findMany({
          where: {
            integrationEnabled: true,
          },
        });
      }
    });

    // Process each organization
    const results = [];
    for (const org of organizations) {
      const result = await step.run(`sync-${org.id}`, async () => {
        // Sync logic here
        return { orgId: org.id, success: true };
      });
      results.push(result);
    }

    return {
      trigger: isManual ? "manual" : "scheduled",
      organizationsProcessed: results.length,
      results,
    };
  }
);
```

## Register in Route Handler

```typescript
// src/app/api/inngest/route.ts
// Update this file to register your new function

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";

// Import existing functions
import { generateDocumentContentJob } from "@/lib/inngest/functions/generate-document-content";
// ... other imports

// Import new function
import { {jobName}Job } from "@/lib/inngest/functions/{job-name}";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Existing functions
    generateDocumentContentJob,
    // ... other functions

    // New function
    {jobName}Job,
  ],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
```

## Trigger from API Route

```typescript
// In your API route handler
import { inngest } from "@/lib/inngest/client";

// Fire and forget - don't await
inngest.send({
  name: "{namespace}/{action}",
  data: {
    {entity}Id: entity.id,
    organizationId: user.organization.id,
    userId: user.id,
    options: {
      // Job-specific options
    },
  },
}).catch((err) => {
  console.error("[Inngest] Failed to send event:", err);
  // Don't fail the API response
});
```

## Common Cron Schedules

| Schedule | Cron Expression | Use Case |
|----------|-----------------|----------|
| Every hour | `0 * * * *` | Frequent syncs |
| Every 6 hours | `0 */6 * * *` | Regular syncs |
| Every 12 hours | `0 */12 * * *` | Twice daily |
| Daily at 2 AM UTC | `0 2 * * *` | Nightly jobs |
| Weekly on Monday | `0 0 * * 1` | Weekly reports |

## Status Tracking Pattern

```typescript
// Database fields for status tracking
processingStatus: "pending" | "processing" | "completed" | "failed"
processedAt: DateTime?
processingError: String?

// Update flow
pending → processing → completed
pending → processing → failed (with error message)
```

## Error Handling Patterns

```typescript
// Pattern 1: Fail the entire job
if (!data) {
  throw new Error(`Required data not found: ${id}`);
}

// Pattern 2: Update status then throw
await step.run("set-failed", async () => {
  await prisma.entity.update({
    where: { id },
    data: {
      processingStatus: "failed",
      processingError: "Error message",
    },
  });
});
throw new Error("Processing failed");

// Pattern 3: Continue despite non-critical failure
await step.run("optional-step", async () => {
  try {
    await optionalOperation();
    return { success: true };
  } catch (error) {
    console.error("Optional step failed:", error);
    return { success: false };
  }
});
```

## Chaining

After creating Inngest functions:
- **`/api`** - Create API endpoint that triggers the job
- **`/component`** - UI to show job status

## Checklist

- [ ] Event data includes `organizationId`
- [ ] Event data includes `userId` for audit
- [ ] Steps are atomic and named clearly
- [ ] Status updated early for visibility
- [ ] Error handling updates status appropriately
- [ ] Function registered in `route.ts`
- [ ] Retries configured appropriately
- [ ] Concurrency limits if needed
- [ ] Returns summary object
