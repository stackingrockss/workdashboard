# Skill: /component

> Create feature components following shadcn/ui and project patterns

## Purpose

Generate React components with:
- Proper TypeScript interfaces
- shadcn/ui component usage
- Client/server component decisions
- Loading, empty, and error states
- Form handling with React Hook Form + Zod
- Consistent styling with Tailwind

## Questions to Ask

1. **Component name** - PascalCase (e.g., "NoteCard", "TaskList", "ActivityDialog")
2. **Component type** - What kind?
   - Card - Display a single item
   - List/Grid - Display multiple items
   - Dialog - Modal for create/edit
   - Form - Standalone form
   - Tab - Tab panel with content
   - Section - Collapsible section
3. **Feature area** - Where does it belong? (opportunities, documents, accounts, etc.)
4. **Needs form?** - Does it include a form? (React Hook Form + Zod)
5. **Server or Client?** - Based on interactivity needs

## Output Files

```
src/components/features/{area}/{ComponentName}.tsx
src/components/features/{area}/index.ts  (update exports)
```

## Component Type Templates

### Card Component

```tsx
// src/components/features/{area}/{Entity}Card.tsx
// Displays a single {entity} with key information and actions

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateShort } from "@/lib/format";
import { {Entity}, get{Entity}StatusLabel, get{Entity}StatusColor } from "@/types/{entity}";

interface {Entity}CardProps {
  {entity}: {Entity};
  onClick?: () => void;
  onDelete?: () => void;
}

export const {Entity}Card = ({
  {entity},
  onClick,
  onDelete,
}: {Entity}CardProps) => {
  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-medium line-clamp-1">
            {{entity}.name}
          </CardTitle>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {{entity}.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {{entity}.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Badge className={get{Entity}StatusColor({entity}.status)}>
            {get{Entity}StatusLabel({entity}.status)}
          </Badge>

          <span className="text-xs text-muted-foreground">
            {formatDateShort({entity}.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
```

### List/Grid Component

```tsx
// src/components/features/{area}/{Entity}List.tsx
// Displays a filterable list/grid of {entities}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, FileStack } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { {Entity}Card } from "./{Entity}Card";
import { {Entity} } from "@/types/{entity}";

interface {Entity}ListProps {
  parentId?: string; // If nested under a parent
  onCreateClick?: () => void;
}

export const {Entity}List = ({ parentId, onCreateClick }: {Entity}ListProps) => {
  const [{entities}, set{Entities}] = useState<{Entity}[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const fetch{Entities} = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);

      const url = parentId
        ? `/api/v1/parent/${parentId}/{entities}?${params}`
        : `/api/v1/{entities}?${params}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      set{Entities}(data.{entities} || []);
    } catch (error) {
      toast.error("Failed to load {entities}");
    } finally {
      setLoading(false);
    }
  }, [parentId, debouncedSearch]);

  useEffect(() => {
    fetch{Entities}();
  }, [fetch{Entities}]);

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/{entities}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");

      toast.success("{Entity} deleted");
      fetch{Entities}();
    } catch (error) {
      toast.error("Failed to delete {entity}");
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search {entities}..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={onCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          Add {Entity}
        </Button>
      </div>

      {/* Empty state */}
      {{entities}.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileStack className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-1">No {entities} yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first {entity} to get started
            </p>
            <Button onClick={onCreateClick}>
              <Plus className="h-4 w-4 mr-2" />
              Create {Entity}
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Content grid */
        <div className="grid gap-3 md:grid-cols-2">
          {{entities}.map(({entity}) => (
            <{Entity}Card
              key={{entity}.id}
              {entity}={{entity}}
              onClick={() => {
                // Navigate or open dialog
              }}
              onDelete={() => handleDelete({entity}.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

### Dialog Component

```tsx
// src/components/features/{area}/{Entity}Dialog.tsx
// Dialog for creating/editing a {entity}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  {entity}CreateSchema,
  type {Entity}CreateInput,
} from "@/lib/validations/{entity}";
import { {Entity} } from "@/types/{entity}";

interface {Entity}DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  {entity}?: {Entity}; // If editing
  parentId?: string; // If nested
  onSuccess?: () => void;
}

export const {Entity}Dialog = ({
  open,
  onOpenChange,
  {entity},
  parentId,
  onSuccess,
}: {Entity}DialogProps) => {
  const [loading, setLoading] = useState(false);
  const isEditing = !!{entity};

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{Entity}CreateInput>({
    resolver: zodResolver({entity}CreateSchema),
    defaultValues: {entity}
      ? {
          name: {entity}.name,
          description: {entity}.description || "",
        }
      : {
          name: "",
          description: "",
        },
  });

  const onSubmit = async (data: {Entity}CreateInput) => {
    setLoading(true);
    try {
      const url = isEditing
        ? `/api/v1/{entities}/${{{entity}}.id}`
        : parentId
          ? `/api/v1/parent/${parentId}/{entities}`
          : `/api/v1/{entities}`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      toast.success(isEditing ? "{Entity} updated" : "{Entity} created");
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save {entity}"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit {Entity}" : "Create {Entity}"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the {entity} details below."
              : "Fill in the details to create a new {entity}."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Enter name"
              disabled={loading}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <p id="name-error" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Enter description (optional)"
              disabled={loading}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
```

### Tab Component

```tsx
// src/components/features/{area}/{Entity}Tab.tsx
// Tab panel for {entities} with filtering

"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { {Entity}List } from "./{Entity}List";
import { {Entity}Dialog } from "./{Entity}Dialog";

type FilterType = "all" | "active" | "archived";

interface {Entity}TabProps {
  parentId: string;
}

export const {Entity}Tab = ({ parentId }: {Entity}TabProps) => {
  const [filter, setFilter] = useState<FilterType>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          <{Entity}List
            key={refreshKey}
            parentId={parentId}
            filter={filter}
            onCreateClick={() => setDialogOpen(true)}
          />
        </TabsContent>
      </Tabs>

      <{Entity}Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        parentId={parentId}
        onSuccess={handleSuccess}
      />
    </div>
  );
};
```

## Server vs Client Decision

### Use Server Component (no "use client")

- Static content display
- Data fetching with `async/await`
- No state, effects, or event handlers
- No browser APIs

```tsx
// Server Component
import { prisma } from "@/lib/db";

export const {Entity}Summary = async ({ id }: { id: string }) => {
  const {entity} = await prisma.{entity}.findUnique({
    where: { id },
  });

  return (
    <div>
      <h2>{{entity}?.name}</h2>
      <p>{{entity}?.description}</p>
    </div>
  );
};
```

### Use Client Component ("use client")

- State management (useState, useReducer)
- Effects (useEffect)
- Event handlers (onClick, onChange)
- Browser APIs (window, localStorage)
- Interactive shadcn/ui components (Dialog, Form, etc.)

## Key Imports

```tsx
// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Icons
import { Plus, Search, Loader2, Trash2, MoreHorizontal } from "lucide-react";

// Utilities
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";
import { toast } from "sonner";

// Hooks
import { useDebounce } from "@/hooks/useDebounce";

// Types
import { {Entity} } from "@/types/{entity}";

// Forms
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { {entity}CreateSchema, type {Entity}CreateInput } from "@/lib/validations/{entity}";
```

## Chaining

Before creating components, ensure you have:
- **`/model`** - Prisma model and types exist
- **`/validation`** - Zod schemas exist
- **`/api`** - API endpoints exist

After creating components, consider:
- **`/test`** - Component tests
- **`/page`** - Page to display the component

## Checklist

- [ ] Props interface defined with TypeScript
- [ ] "use client" only when needed
- [ ] Loading state with Skeleton
- [ ] Empty state with CTA
- [ ] Error handling with toast
- [ ] Accessible (labels, ARIA, keyboard nav)
- [ ] Uses path aliases (@/)
- [ ] Uses formatting utilities
- [ ] Exported from index.ts
