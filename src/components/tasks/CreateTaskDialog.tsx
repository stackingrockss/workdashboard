"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Form schema for creating a task
const createTaskFormSchema = z.object({
  title: z
    .string()
    .min(1, "Task title is required")
    .max(1024, "Task title must be less than 1024 characters"),
  notes: z
    .string()
    .max(8192, "Task notes must be less than 8192 characters")
    .optional(),
  due: z.date().optional().nullable(),
  opportunityId: z.string().optional().nullable(),
  taskListId: z.string().min(1, "Please select a task list"),
});

type CreateTaskFormData = z.infer<typeof createTaskFormSchema>;

interface TaskList {
  id: string;
  title: string;
}

interface Opportunity {
  id: string;
  name: string;
}

interface CreateTaskDialogProps {
  onTaskCreated?: () => void;
  trigger?: React.ReactNode;
}

export function CreateTaskDialog({ onTaskCreated, trigger }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const form = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: {
      title: "",
      notes: "",
      due: null,
      opportunityId: null,
      taskListId: "",
    },
  });

  // Fetch task lists when dialog opens
  useEffect(() => {
    if (open) {
      fetchTaskLists();
      fetchOpportunities();
    }
  }, [open]);

  const fetchTaskLists = async () => {
    setLoadingLists(true);
    try {
      const response = await fetch("/api/v1/tasks/lists");
      if (response.ok) {
        const data = await response.json();
        const lists = data.taskLists || [];
        setTaskLists(lists);
        // Auto-select first list if available
        if (lists.length > 0 && !form.getValues("taskListId")) {
          form.setValue("taskListId", lists[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch task lists:", error);
    } finally {
      setLoadingLists(false);
    }
  };

  const fetchOpportunities = async () => {
    setLoadingOpportunities(true);
    try {
      const response = await fetch("/api/v1/opportunities?limit=100");
      if (response.ok) {
        const data = await response.json();
        setOpportunities(data.opportunities || []);
      }
    } catch (error) {
      console.error("Failed to fetch opportunities:", error);
    } finally {
      setLoadingOpportunities(false);
    }
  };

  const onSubmit = async (data: CreateTaskFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/tasks/lists/${data.taskListId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          notes: data.notes || undefined,
          due: data.due ? data.due.toISOString() : undefined,
          opportunityId: data.opportunityId || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create task");
      }

      toast.success("Task created successfully");
      form.reset();
      setOpen(false);
      onTaskCreated?.();
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      form.reset();
    }
  };

  const selectedDate = form.watch("due");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" title="Create Task">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Create a new task in Google Tasks. The task will sync automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Task Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Enter task title..."
                {...form.register("title")}
                aria-invalid={!!form.formState.errors.title}
                aria-describedby={form.formState.errors.title ? "title-error" : undefined}
              />
              {form.formState.errors.title && (
                <p id="title-error" className="text-sm text-destructive">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            {/* Task List Selection */}
            <div className="grid gap-2">
              <Label htmlFor="taskListId">
                Task List <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("taskListId")}
                onValueChange={(value) => form.setValue("taskListId", value)}
                disabled={loadingLists}
              >
                <SelectTrigger id="taskListId">
                  <SelectValue placeholder={loadingLists ? "Loading lists..." : "Select a task list"} />
                </SelectTrigger>
                <SelectContent>
                  {taskLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.taskListId && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.taskListId.message}
                </p>
              )}
            </div>

            {/* Due Date */}
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate || undefined}
                    onSelect={(date) => {
                      form.setValue("due", date || null);
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                  <div className="border-t p-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        form.setValue("due", new Date());
                        setCalendarOpen(false);
                      }}
                    >
                      Today
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        form.setValue("due", tomorrow);
                        setCalendarOpen(false);
                      }}
                    >
                      Tomorrow
                    </Button>
                    {selectedDate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          form.setValue("due", null);
                          setCalendarOpen(false);
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Link to Opportunity */}
            <div className="grid gap-2">
              <Label htmlFor="opportunityId">Link to Opportunity</Label>
              <Select
                value={form.watch("opportunityId") || "none"}
                onValueChange={(value) =>
                  form.setValue("opportunityId", value === "none" ? null : value)
                }
                disabled={loadingOpportunities}
              >
                <SelectTrigger id="opportunityId">
                  <SelectValue
                    placeholder={loadingOpportunities ? "Loading opportunities..." : "Select an opportunity (optional)"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No opportunity</SelectItem>
                  {opportunities.map((opp) => (
                    <SelectItem key={opp.id} value={opp.id}>
                      {opp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add notes (optional)..."
                rows={3}
                {...form.register("notes")}
              />
              {form.formState.errors.notes && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.notes.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || taskLists.length === 0}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
