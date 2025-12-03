"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Copy,
  ExternalLink,
  MoreVertical,
  Pencil,
  Trash2,
  FileText,
  BookOpen,
  Video,
  Presentation,
  File,
  FileSpreadsheet,
  Briefcase,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Content, ContentType, CONTENT_TYPE_LABELS } from "@/types/content";

interface ContentCardProps {
  content: Content;
  onEdit: (content: Content) => void;
  onDelete: (content: Content) => void;
}

const contentTypeIcons: Record<ContentType, React.ReactNode> = {
  blog_post: <FileText className="h-4 w-4" />,
  case_study: <BookOpen className="h-4 w-4" />,
  whitepaper: <File className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  webinar: <Presentation className="h-4 w-4" />,
  mutual_action_plan: <FileSpreadsheet className="h-4 w-4" />,
  business_case: <Briefcase className="h-4 w-4" />,
  other: <FileText className="h-4 w-4" />,
};

const contentTypeBadgeColors: Record<ContentType, string> = {
  blog_post: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  case_study: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  whitepaper: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
  video: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  webinar: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  mutual_action_plan: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100",
  business_case: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
};

export function ContentCard({ content, onEdit, onDelete }: ContentCardProps) {
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyLink = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(content.url);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    } finally {
      setIsCopying(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-muted-foreground">
              {contentTypeIcons[content.contentType]}
            </span>
            <Badge className={contentTypeBadgeColors[content.contentType]}>
              {CONTENT_TYPE_LABELS[content.contentType]}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(content)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(content)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <h3 className="font-semibold text-base leading-tight line-clamp-2 mt-2">
          {content.title}
        </h3>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-4">
        <div>
          {content.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {content.description}
            </p>
          )}
        </div>

        <div className="space-y-3">
          {/* Added by info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar className="h-5 w-5">
              <AvatarImage src={content.createdBy?.avatarUrl || undefined} />
              <AvatarFallback className="text-[10px]">
                {getInitials(content.createdBy?.name || null)}
              </AvatarFallback>
            </Avatar>
            <span>
              {content.createdBy?.name || "Unknown"} ·{" "}
              {formatDistanceToNow(new Date(content.createdAt), { addSuffix: true })}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleCopyLink}
              disabled={isCopying}
              className="flex-1"
            >
              <Copy className="h-4 w-4 mr-2" />
              {isCopying ? "Copied!" : "Copy Link"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={content.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
