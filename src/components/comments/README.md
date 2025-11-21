# Google Docs-Style Comment System

A comprehensive, real-time comment system with inline text selection, mentions, reactions, and threading support.

## Features

✅ **Google Docs-style inline comments** - Highlight any text and add comments
✅ **Real-time updates** - Comments sync instantly using Supabase Realtime
✅ **@Mentions** - Tag team members with autocomplete
✅ **Emoji reactions** - React to comments with emojis
✅ **Markdown support** - Rich text formatting in comments
✅ **Flat threading** - Reply to comments (one level deep)
✅ **Resolve/unresolve** - Mark discussions as complete
✅ **Edit & delete** - Full comment lifecycle management
✅ **Multi-tenant** - Strict data isolation by organization
✅ **Role-based permissions** - ADMIN, MANAGER, REP, VIEWER access control

## Usage

### 1. Enable Comments on a Page

Add the `useTextSelection` hook and `CommentHighlights` component to any page where you want commenting:

```tsx
// src/app/opportunities/[id]/page.tsx
"use client";

import { useEffect } from "react";
import { useCommentSidebar } from "@/components/comments/CommentSidebarContext";
import { useTextSelection } from "@/components/comments/useTextSelection";
import { CommentHighlights } from "@/components/comments/CommentHighlights";

export default function OpportunityPage({ params }: { params: { id: string } }) {
  const { openSidebar, setEntityContext } = useCommentSidebar();

  // Set up text selection for inline comments
  useTextSelection({
    enabled: true,
    entityType: "opportunity",
    entityId: params.id,
    pageContext: `/opportunities/${params.id}`,
  });

  // Auto-open sidebar for this entity
  useEffect(() => {
    setEntityContext("opportunity", params.id, `/opportunities/${params.id}`);
  }, [params.id, setEntityContext]);

  return (
    <div>
      {/* Your page content */}
      <h1>Opportunity Details</h1>
      <p>Select any text to comment on it...</p>

      {/* Render highlights for existing inline comments */}
      <CommentHighlights
        entityType="opportunity"
        entityId={params.id}
        pageContext={`/opportunities/${params.id}`}
      />
    </div>
  );
}
```

### 2. Programmatically Open Sidebar

```tsx
import { useCommentSidebar } from "@/components/comments/CommentSidebarContext";

function MyComponent() {
  const { openSidebar, closeSidebar } = useCommentSidebar();

  return (
    <Button
      onClick={() => openSidebar("opportunity", "abc123", "/opportunities/abc123")}
    >
      Open Comments
    </Button>
  );
}
```

### 3. Text Selection Keyboard Shortcuts

- **Select text + mouse release** → Opens sidebar with selection
- **Cmd/Ctrl + Shift + C** → Comment on current selection

### 4. Comment Actions

**For all users:**
- Add comments (except VIEWER role)
- Reply to comments
- React with emojis
- @Mention team members

**For comment authors + ADMIN:**
- Edit comments
- Delete comments

**For comment authors + ADMIN + MANAGER:**
- Resolve/unresolve comments

## API Routes

### Get Comments
```typescript
GET /api/v1/comments?entityType=opportunity&entityId=abc123&includeResolved=false

Response: {
  comments: Comment[]
}
```

### Create Comment
```typescript
POST /api/v1/comments
Body: {
  content: "Great point! @[John Doe](user123)",
  entityType: "opportunity",
  entityId: "abc123",
  pageContext: "/opportunities/abc123",
  textSelection: {
    selectionType: "text",
    anchorSelector: "div.content > p:nth-child(2)",
    anchorOffset: 10,
    focusSelector: "div.content > p:nth-child(2)",
    focusOffset: 50,
    selectedText: "This is the highlighted text"
  },
  parentId: null, // For replies
  mentionedUserIds: ["user123"]
}

Response: {
  comment: Comment
}
```

### Update Comment
```typescript
PATCH /api/v1/comments/[id]
Body: {
  content: "Updated content",
  mentionedUserIds: ["user123"]
}

Response: {
  comment: Comment
}
```

### Delete Comment
```typescript
DELETE /api/v1/comments/[id]

Response: {
  success: true
}
```

### Resolve/Unresolve Comment
```typescript
PATCH /api/v1/comments/[id]/resolve
Body: {
  isResolved: true
}

Response: {
  comment: Comment
}
```

### Add/Remove Reaction
```typescript
POST /api/v1/comments/[id]/reactions
Body: {
  emoji: "👍"
}

Response: {
  reaction: CommentReaction,
  action: "added" | "removed" // Toggles if already exists
}
```

## Components

### Core Components

- **`CommentSidebar`** - Main sidebar UI (client component)
- **`CommentSidebarWrapper`** - Server wrapper that fetches user data
- **`CommentSidebarContext`** - Global state provider
- **`CommentThread`** - Displays comment with replies
- **`CommentCard`** - Individual comment with actions
- **`CommentInput`** - Input with @mention autocomplete
- **`CommentHighlights`** - Renders text highlights on page

### Hooks

- **`useComments(options)`** - Fetch comments with real-time updates
- **`useCommentSidebar()`** - Access sidebar state/actions
- **`useTextSelection(options)`** - Enable text selection on page

## Database Schema

### Comment Model
```prisma
model Comment {
  id             String
  content        String  // Markdown-supported
  authorId       String
  organizationId String  // Multi-tenant isolation
  entityType     String  // "opportunity", "account", etc.
  entityId       String
  pageContext    String? // URL path

  // Text selection (Google Docs-style)
  selectionType  String?
  anchorSelector String?
  anchorOffset   Int?
  focusSelector  String?
  focusOffset    Int?
  selectedText   String?

  // Status
  isResolved     Boolean
  resolvedAt     DateTime?
  resolvedById   String?

  // Threading (flat, one level)
  parentId       String?

  // Relations
  author         User
  organization   Organization
  replies        Comment[]
  mentions       CommentMention[]
  reactions      CommentReaction[]
}
```

## Permissions

| Role | Create | Edit Own | Delete Own | Edit Any | Delete Any | Resolve | View |
|------|--------|----------|------------|----------|------------|---------|------|
| **VIEWER** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **REP** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅* | ✅ |
| **MANAGER** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Can resolve own comments only

## Real-Time Updates

Comments use **Supabase Realtime** for instant updates:

- ✅ New comments appear automatically
- ✅ Edits sync immediately
- ✅ Deletions remove comments in real-time
- ✅ Reactions update live
- ✅ Mentions notify instantly

Realtime channels are scoped by entity:
```typescript
supabase.channel(`comments:opportunity:abc123`)
```

## Multi-Tenancy

All queries are **strictly scoped by `organizationId`**:

```typescript
// Every comment query includes organizationId
const comments = await prisma.comment.findMany({
  where: {
    organizationId: user.organization.id, // REQUIRED
    entityType,
    entityId,
  }
});
```

**Security guarantees:**
- ❌ No cross-org data leakage
- ✅ Cascade deletes on organization removal
- ✅ Permission checks verify org membership

## Markdown & Mentions

### Mention Format
Mentions are stored as markdown-style links:
```markdown
@[Display Name](userId)
```

Example:
```markdown
Hey @[John Doe](user123), can you review this?
```

### Mention Rendering
The `CommentCard` component parses and highlights mentions:
```tsx
<span class="mention bg-primary/10 text-primary px-1 rounded">
  @John Doe
</span>
```

### Markdown Support
Comments support **GitHub Flavored Markdown** via `react-markdown`:
- **Bold**, *italic*, ~~strikethrough~~
- [Links](https://example.com)
- `code` and ```code blocks```
- Lists (ordered and unordered)
- > Blockquotes

## Text Selection

### How It Works

1. **User selects text** on page
2. **Selection is captured** using CSS selectors + offsets
3. **Stored in database** with comment
4. **Restored on page load** and highlighted
5. **Click highlight** to jump to comment in sidebar

### Selector Strategy

Uses **CSS selectors + character offsets** for accuracy:

```typescript
{
  anchorSelector: "div.content > p:nth-child(2)",
  anchorOffset: 10,
  focusSelector: "div.content > p:nth-child(2)",
  focusOffset: 50,
  selectedText: "This is the highlighted text"
}
```

### Fuzzy Matching

If exact text doesn't match (page changed), falls back to **Levenshtein distance**:
- Allows up to 20% difference
- Shows warning if text changed significantly
- Fallback: show "[Original selection unavailable]"

## Styling

### Custom Highlight Colors

Resolved comments use muted highlights:

```tsx
highlightRange(range, {
  color: comment.isResolved ? "#e0e0e0" : "#ffeb3b"
});
```

### CSS Classes

- `.comment-highlight` - All highlights
- `.comment-highlight-{commentId}` - Specific comment
- `.mention` - Mention spans

## Performance Optimizations

1. **Pagination** - Comments load in batches
2. **Virtual scrolling** - For long comment lists
3. **Debounced search** - @mention autocomplete
4. **Lazy highlights** - Only render visible viewport
5. **Optimistic updates** - Instant UI feedback

## Troubleshooting

### Highlights Not Appearing

**Problem**: Text selections don't restore after page reload

**Solutions**:
- Ensure `CommentHighlights` component is mounted
- Check console for selector errors
- Verify `pageContext` matches between save and load
- Text content may have changed (check selectedText fallback)

### Realtime Not Working

**Problem**: Comments don't update in real-time

**Solutions**:
- Verify Supabase Realtime is enabled in dashboard
- Check channel subscription in browser console
- Ensure `organizationId` filter is correct
- Confirm network connection (WebSocket)

### Mentions Not Autocompleting

**Problem**: @mention dropdown doesn't show

**Solutions**:
- Check `availableUsers` prop has data
- Verify `organizationUsers` query in wrapper
- Test with `@` character in input
- Check console for JavaScript errors

## Future Enhancements

🚀 **Planned features:**
- Email notifications for mentions
- Comment search and filtering
- Comment templates
- Keyboard shortcuts (J/K navigation)
- Mobile optimizations (bottom sheet)
- Comment analytics dashboard
- Export comments to PDF/CSV
- Video/image attachments
- Voice comments

## Support

For issues, feature requests, or questions:
- Check [ARCHITECTURE.md](.claude/ARCHITECTURE.md) for system design
- Check [API.md](.claude/API.md) for API patterns
- Check [MULTI_TENANCY.md](.claude/MULTI_TENANCY.md) for permissions

---

**Built with:**
- Next.js 15 (App Router)
- Supabase Realtime
- Apache Annotator
- Prisma + PostgreSQL
- shadcn/ui + Tailwind CSS
