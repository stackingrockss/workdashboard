"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Content, ContentType, CONTENT_TYPE_LABELS } from "@/types/content";
import { createContent, updateContent } from "@/lib/api/content";

interface AddContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingContent?: Content | null;
}

export function AddContentDialog({
  open,
  onOpenChange,
  onSuccess,
  editingContent,
}: AddContentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState<ContentType>("blog_post");

  const isEditing = !!editingContent;

  useEffect(() => {
    if (editingContent) {
      setTitle(editingContent.title);
      setUrl(editingContent.url);
      setDescription(editingContent.description || "");
      setContentType(editingContent.contentType);
    } else {
      setTitle("");
      setUrl("");
      setDescription("");
      setContentType("blog_post");
    }
  }, [editingContent, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !url.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && editingContent) {
        await updateContent(editingContent.id, {
          title,
          url,
          description: description || undefined,
          contentType,
        });
        toast.success("Content updated successfully!");
      } else {
        await createContent({
          title,
          url,
          description: description || undefined,
          contentType,
        });
        toast.success("Content added successfully!");
      }
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Failed to ${isEditing ? "update" : "add"} content`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Content" : "Add Content"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content-title">Title *</Label>
            <Input
              id="content-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., How to Improve Sales Pipeline"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-url">URL *</Label>
            <Input
              id="content-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-type">Content Type *</Label>
            <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
              <SelectTrigger id="content-type">
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {CONTENT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-description">Description (optional)</Label>
            <Textarea
              id="content-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this content..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Adding..."
                : isEditing
                  ? "Save Changes"
                  : "Add Content"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
