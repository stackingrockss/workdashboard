"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Trash2, LayoutDashboard, FileText, Users, ExternalLink, AlertCircle, Target, ListChecks, Clock, ChevronDown, Briefcase, FileStack } from "lucide-react";
import { Opportunity, getStageLabel, OpportunityStage, getDefaultConfidenceLevel, getDefaultForecastCategory, ReviewStatus, PlatformType, getReviewStatusLabel, getPlatformTypeLabel } from "@/types/opportunity";
import { OpportunityForm } from "@/components/forms/OpportunityForm";
import { updateOpportunity, deleteOpportunity, updateOpportunityField } from "@/lib/api/opportunities";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";
import { formatCurrencyCompact, formatDateShort } from "@/lib/format";
import { GongCallsSection } from "./gong-calls-section";
import { GranolaNotesSection } from "./granola-notes-section";
import type { CalendarEvent } from "@/types/calendar";
import type { GongCall } from "@/types/gong-call";
import type { GranolaNote } from "@/types/granola-note";
import { STAGE_OPTIONS } from "@/lib/constants";
import { OrgChartSection } from "@/components/contacts/OrgChartSection";
import { Separator } from "@/components/ui/separator";
import {
  InlineTextInput,
  InlineTextarea,
  InlineSelect,
  InlineDatePicker,
  InlineCurrencyInput,
} from "@/components/ui/inline-editable";
import { InlineMarkdownWithAI } from "@/components/ui/inline-markdown";
import { DecisionMakerSection } from "@/components/opportunities/DecisionMakerSection";
import { Contact } from "@/types/contact";
import { ActivitySection } from "./activity/activity-section";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { SecFilingsSection } from "./sec-filings-section";
import { EarningsTranscriptsSection } from "./earnings-transcripts-section";
import { useCommentSidebar } from "@/components/comments/CommentSidebarContext";
import { useTextSelection } from "@/components/comments/useTextSelection";
import { CommentView } from "@/components/comments/CommentView";
import { CommentAnchorIcons } from "@/components/comments/CommentAnchorIcons";
import { CommentScrollbarMarkers } from "@/components/comments/CommentScrollbarMarkers";
import { SelectionCommentToolbar } from "@/components/comments/SelectionCommentToolbar";
import type { TextSelection } from "@/lib/text-selection";
import { ParseGongTranscriptDialog } from "./parse-gong-transcript-dialog";
import { GongCallInsightsDialog } from "./gong-call-insights-dialog";
import { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import type { RiskAssessment } from "@/types/gong-call";
import { BusinessProposalTab } from "./business-proposal-tab";
import { AccountIntelSummaryCard } from "./account-intel-summary-card";
import { NotesTab } from "./notes-tab";
import { DocumentsTab } from "../documents";

interface OpportunityDetailClientProps {
  opportunity: Opportunity;
  organizationId: string;
  userId?: string;
  currentUser: {
    id: string;
    role: "ADMIN" | "MANAGER" | "REP" | "VIEWER";
    organizationId: string;
  };
  organizationUsers: Array<{
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }>;
}

// Using centralized stage options from constants
const stageOptions = STAGE_OPTIONS;

const forecastCategoryOptions = [
  { value: "pipeline", label: "Pipeline" },
  { value: "bestCase", label: "Best Case" },
  { value: "commit", label: "Commit" },
  { value: "closedWon", label: "Closed Won" },
  { value: "closedLost", label: "Closed Lost" },
];

const confidenceLevelOptions = [
  { value: "1", label: "1 - Very Low" },
  { value: "2", label: "2 - Low" },
  { value: "3", label: "3 - Medium" },
  { value: "4", label: "4 - High" },
  { value: "5", label: "5 - Very High" },
];

const reviewStatusOptions = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "not_applicable", label: "N/A" },
];

const platformTypeOptions = [
  { value: "oem", label: "OEM" },
  { value: "api", label: "API" },
  { value: "isv", label: "ISV" },
];

// Valid tab values for the opportunity detail page
const VALID_TABS = ["overview", "research", "activity", "account-intel", "contacts", "documents", "proposal"] as const;
type TabValue = typeof VALID_TABS[number];

export function OpportunityDetailClient({ opportunity, organizationId, userId, currentUser, organizationUsers }: OpportunityDetailClientProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);
  const [researchStatus, setResearchStatus] = useState(opportunity.accountResearchStatus);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [allGongCalls, setAllGongCalls] = useState<GongCall[]>(Array.isArray(opportunity.gongCalls) ? opportunity.gongCalls : []);
  const [allGranolaNotes, setAllGranolaNotes] = useState<GranolaNote[]>(Array.isArray(opportunity.granolaNotes) ? opportunity.granolaNotes : []);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [addGongDialogEvent, setAddGongDialogEvent] = useState<{id: string; title: string; startTime: string | Date} | null>(null);
  const [addGranolaDialogEvent, setAddGranolaDialogEvent] = useState<{id: string; title: string; startTime: string | Date} | null>(null);
  const [selectedGongCallForParsing, setSelectedGongCallForParsing] = useState<GongCall | null>(null);
  const [selectedGongCallForViewing, setSelectedGongCallForViewing] = useState<GongCall | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setEntityContext, openSidebarWithSelection } = useCommentSidebar();

  // Get initial tab from URL search params, default to "overview"
  const tabParam = searchParams.get("tab");
  const initialTab: TabValue = tabParam && VALID_TABS.includes(tabParam as TabValue)
    ? (tabParam as TabValue)
    : "overview";

  // Use local state for instant tab switching (no server round-trip)
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  // Handle tab change - instant switch with URL update (no navigation)
  const handleTabChange = (value: string) => {
    const newTab = value as TabValue;
    setActiveTab(newTab); // Instant UI update

    // Update URL without triggering navigation/refetch
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", newTab);
    }
    const queryString = params.toString();
    const newUrl = `/opportunities/${opportunity.id}${queryString ? `?${queryString}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  };

  // Handle comment toolbar click - opens sidebar when user clicks Comment button
  const handleCommentClick = (selection: TextSelection) => {
    openSidebarWithSelection("opportunity", opportunity.id, `/opportunities/${opportunity.id}`);
  };

  // Enable comment system (no longer auto-opens sidebar)
  useTextSelection({
    enabled: true,
    entityType: "opportunity",
    entityId: opportunity.id,
    pageContext: `/opportunities/${opportunity.id}`,
  });

  // Set entity context for comment sidebar
  useEffect(() => {
    setEntityContext("opportunity", opportunity.id, `/opportunities/${opportunity.id}`);
  }, [opportunity.id, setEntityContext]);

  // Poll for research status when generating
  useEffect(() => {
    // Only poll if status is 'generating'
    if (researchStatus !== "generating") {
      return;
    }

    const pollResearchStatus = async () => {
      try {
        const response = await fetch(`/api/v1/opportunities/${opportunity.id}/research-status`);

        if (!response.ok) {
          console.error("Failed to poll research status");
          return;
        }

        const data = await response.json();

        // Update local status
        setResearchStatus(data.status);

        // If completed or failed, refresh the page to show updated content
        if (data.status === "completed") {
          toast.success("Account research generated!");
          router.refresh();
        } else if (data.status === "failed") {
          toast.error("Failed to generate research. You can retry manually.");
          router.refresh();
        }
      } catch (error) {
        console.error("Error polling research status:", error);
      }
    };

    // Start polling every 10 seconds
    const pollInterval = setInterval(pollResearchStatus, 10000); // 10s (reduced from 3s to save compute)

    // Cleanup on unmount or when status changes
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [researchStatus, opportunity.id, router]);

  // Load contacts for decision maker section
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const response = await fetch(`/api/v1/opportunities/${opportunity.id}/contacts`);
        if (response.ok) {
          const data = await response.json();
          // API returns { contacts: [...] } - extract the array, with fallback for safety
          const contactsArray = Array.isArray(data) ? data : (Array.isArray(data?.contacts) ? data.contacts : []);
          setContacts(contactsArray);
        }
      } catch (error) {
        console.error("Failed to load contacts:", error);
      }
    };
    loadContacts();
  }, [opportunity.id]);

  // Load external calendar events for this opportunity
  useEffect(() => {
    const loadCalendarEvents = async () => {
      setLoadingCalendar(true);
      try {
        // Fetch external meetings for this opportunity (90 days past to 90 days future)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 90);

        // Build query params - include accountId to also show account-matched events
        const params = new URLSearchParams({
          opportunityId: opportunity.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          externalOnly: "true",
        });
        if (opportunity.accountId) {
          params.set("accountId", opportunity.accountId);
        }

        const response = await fetch(
          `/api/v1/integrations/google/calendar/events?${params.toString()}`
        );

        if (response.ok) {
          const data = await response.json();
          setCalendarEvents(Array.isArray(data.events) ? data.events : []);
        }
      } catch (error) {
        console.error("Failed to load calendar events:", error);
      } finally {
        setLoadingCalendar(false);
      }
    };

    loadCalendarEvents();
  }, [opportunity.id, opportunity.accountId]);

  // Sync local state when opportunity prop updates (after router.refresh())
  useEffect(() => {
    setAllGongCalls(Array.isArray(opportunity.gongCalls) ? opportunity.gongCalls : []);
    setAllGranolaNotes(Array.isArray(opportunity.granolaNotes) ? opportunity.granolaNotes : []);
  }, [opportunity.gongCalls, opportunity.granolaNotes]);

  // Function to refresh all data after changes
  const handleRefreshMeetingsData = () => {
    router.refresh();
  };

  const handleUpdateOpportunity = async (data: OpportunityUpdateInput) => {
    try {
      await updateOpportunity(opportunity.id, data);
      toast.success("Opportunity updated successfully!");
      setIsEditDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update opportunity");
    }
  };

  const handleFieldUpdate = async (
    field: keyof OpportunityUpdateInput,
    value: string | number | null
  ) => {
    try {
      // When updating stage, also update confidenceLevel and forecastCategory
      if (field === "stage") {
        const stage = value as OpportunityStage;
        await updateOpportunity(opportunity.id, {
          stage,
          confidenceLevel: getDefaultConfidenceLevel(stage),
          forecastCategory: getDefaultForecastCategory(stage),
        });
      } else {
        await updateOpportunityField(opportunity.id, field, value);
      }
      toast.success("Updated successfully!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
      throw error;
    }
  };

  const handleDeleteOpportunity = async () => {
    setIsDeleting(true);
    try {
      await deleteOpportunity(opportunity.id);
      toast.success("Opportunity deleted successfully!");
      router.push("/opportunities");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete opportunity");
      setIsDeleting(false);
    }
  };

  const handleGenerateAccountResearch = async () => {
    const accountName = opportunity.account?.name || opportunity.accountName;

    if (!accountName || accountName.trim() === "") {
      toast.error("Account name is required to generate research");
      return;
    }

    setIsGeneratingResearch(true);
    try {
      const response = await fetch("/api/v1/ai/meeting-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountName,
          stage: opportunity.stage,
          opportunityValue: opportunity.amountArr > 0 ? opportunity.amountArr : undefined,
          opportunityId: opportunity.id, // Save to database
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate account research");
      }

      // API now handles saving to database automatically
      toast.success("Account research generated successfully!");
      router.refresh();
    } catch (error) {
      console.error("Error generating research:", error);

      // Extract more detailed error message from validation errors
      let errorMessage = "Failed to generate account research";
      if (error instanceof Error) {
        errorMessage = error.message;

        // Check if it's a validation error
        if (error.message.includes("[object Object]")) {
          errorMessage = "Validation error: Generated content may be too long or contain invalid data";
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsGeneratingResearch(false);
    }
  };

  // Callbacks for adding Gong/Granola calls from calendar events
  const handleAddGongCall = (event: CalendarEvent) => {
    setAddGongDialogEvent({
      id: event.id,
      title: event.summary,
      startTime: event.startTime,
    });
  };

  const handleAddGranolaNote = (event: CalendarEvent) => {
    setAddGranolaDialogEvent({
      id: event.id,
      title: event.summary,
      startTime: event.startTime,
    });
  };

  // Handlers for Gong call insights and parsing from MeetingEventCard
  const handleViewGongCallInsights = (call: GongCall) => {
    setSelectedGongCallForViewing(call);
  };

  const handleParseGongCall = (call: GongCall) => {
    setSelectedGongCallForParsing(call);
  };

  // Wrapper for viewing insights from Activity timeline (accepts ID, looks up full call)
  const handleViewGongCallInsightsById = (callId: string) => {
    const call = allGongCalls.find((c) => c.id === callId);
    if (call) {
      setSelectedGongCallForViewing(call);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/opportunities">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Opportunities
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{opportunity.name}</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {opportunity.account?.name || opportunity.accountName || "No Account"}
            </p>
            {opportunity.account?.website && (
              <a
                href={opportunity.account.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                title={`Visit ${opportunity.account.name} website`}
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex w-full overflow-x-auto gap-1 scrollbar-none md:grid md:grid-cols-7">
          <TabsTrigger value="overview" className="flex items-center gap-2 shrink-0">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="research" className="flex items-center gap-2 shrink-0">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Notes</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2 shrink-0">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger value="account-intel" className="flex items-center gap-2 shrink-0">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Account Intel</span>
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2 shrink-0">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Contacts</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2 shrink-0">
            <FileStack className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
          </TabsTrigger>
          <TabsTrigger value="proposal" className="flex items-center gap-2 shrink-0">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Proposal</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Core Deal Info */}
          <div>
            <h3 className="text-sm font-medium mb-3">Core Deal Info</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <InlineSelect
                label="Stage"
                value={opportunity.stage}
                onSave={async (value) => handleFieldUpdate("stage", value)}
                options={stageOptions}
                displayFormatter={(val) => getStageLabel(val as OpportunityStage)}
              />
              <InlineCurrencyInput
                label="Amount (ARR)"
                value={opportunity.amountArr}
                onSave={async (value) => handleFieldUpdate("amountArr", value)}
                displayFormatter={(val) => `${formatCurrencyCompact(val as number)} ARR`}
              />
              <InlineSelect
                label="Confidence Level"
                value={String(opportunity.confidenceLevel)}
                onSave={async (value) => handleFieldUpdate("confidenceLevel", value ? parseInt(String(value)) : null)}
                options={confidenceLevelOptions}
                displayFormatter={(val) => `${val}/5`}
              />
              <InlineDatePicker
                label="Close date"
                value={opportunity.closeDate}
                onSave={async (value) => handleFieldUpdate("closeDate", value)}
                displayFormatter={(val) => formatDateShort(val as string)}
              />
              <InlineSelect
                label="Forecast Category"
                value={opportunity.forecastCategory || ""}
                onSave={async (value) => handleFieldUpdate("forecastCategory", value || null)}
                options={forecastCategoryOptions}
                placeholder="Select category"
                displayFormatter={(val) =>
                  val ? forecastCategoryOptions.find(o => o.value === val)?.label || "" : "—"
                }
              />
              <InlineTextarea
                label="Next steps"
                value={opportunity.nextStep || ""}
                onSave={async (value) => handleFieldUpdate("nextStep", value)}
                placeholder="e.g. Schedule demo call"
                rows={4}
                className="md:col-span-2 lg:col-span-3"
              />
              {/* Meeting Cadence Section */}
              <div className="md:col-span-2 lg:col-span-3 space-y-3">
                <label className="text-sm font-medium">Meeting Cadence</label>

                {/* Warning banner if needs next call scheduled */}
                {opportunity.needsNextCallScheduled && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-sm text-amber-800 dark:text-amber-200">
                      No upcoming meeting scheduled. Consider booking the next call to maintain momentum.
                    </span>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  {/* Last Call */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Last Call</label>
                    <div className="flex items-center gap-2">
                      {opportunity.lastCallDate ? (
                        <>
                          <span className="text-sm">
                            {new Date(opportunity.lastCallDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          {opportunity.lastCallDateSource && (
                            <Badge variant="outline" className="text-xs">
                              {opportunity.lastCallDateSource === 'auto_calendar' && 'Calendar'}
                              {opportunity.lastCallDateSource === 'auto_gong' && 'Gong'}
                              {opportunity.lastCallDateSource === 'auto_granola' && 'Granola'}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">No past calls</span>
                      )}
                    </div>
                  </div>

                  {/* CBC (Contact Before Call) */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Reach Out By</label>
                    <div className="flex items-center gap-2">
                      {opportunity.cbc ? (
                        <>
                          <span className={`text-sm ${
                            new Date(opportunity.cbc) < new Date()
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : new Date(opportunity.cbc).toDateString() === new Date().toDateString()
                                ? 'text-amber-600 dark:text-amber-400 font-medium'
                                : ''
                          }`}>
                            {new Date(opportunity.cbc).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          {new Date(opportunity.cbc) < new Date() && (
                            <Badge variant="destructive" className="text-xs">Overdue</Badge>
                          )}
                          {new Date(opportunity.cbc).toDateString() === new Date().toDateString() && (
                            <Badge variant="secondary" className="text-xs">Today</Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {opportunity.lastCallDate && !opportunity.nextCallDate
                            ? 'Schedule next call'
                            : 'Auto-calculated'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Next Call */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Next Call</label>
                    <div className="flex items-center gap-2">
                      {opportunity.nextCallDate ? (
                        <>
                          <span className="text-sm">
                            {new Date(opportunity.nextCallDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          {opportunity.nextCallDateSource && (
                            <Badge variant={opportunity.nextCallDateSource === 'manual' ? 'secondary' : 'default'} className="text-xs">
                              {opportunity.nextCallDateSource === 'auto_calendar' && 'Calendar'}
                              {opportunity.nextCallDateSource === 'auto_gong' && 'Gong'}
                              {opportunity.nextCallDateSource === 'auto_granola' && 'Granola'}
                              {opportunity.nextCallDateSource === 'manual' && 'Manual'}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">No upcoming calls</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Deal Context */}
          <div>
            <h3 className="text-sm font-medium mb-3">Deal Context</h3>
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-3">Decision Makers</h4>
              <DecisionMakerSection
                contacts={contacts}
                opportunityId={opportunity.id}
                apiEndpoint={`/api/v1/opportunities/${opportunity.id}/contacts`}
                onContactsUpdate={setContacts}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InlineTextInput
                label="Competition"
                value={opportunity.competition || ""}
                onSave={async (value) => handleFieldUpdate("competition", value)}
                placeholder="e.g. Manual process, Healthstream, Checkr..."
              />
              <InlineSelect
                label="Platform Type"
                value={opportunity.platformType || ""}
                onSave={async (value) => handleFieldUpdate("platformType", value || null)}
                options={platformTypeOptions}
                placeholder="Select platform type"
                displayFormatter={(val) => val ? getPlatformTypeLabel(val as PlatformType) : "—"}
              />
            </div>
          </div>

          <Separator />

          {/* Review Status */}
          <div>
            <h3 className="text-sm font-medium mb-3">Review Status</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <InlineSelect
                label="Legal Review"
                value={opportunity.legalReviewStatus || "not_started"}
                onSave={async (value) => handleFieldUpdate("legalReviewStatus", value)}
                options={reviewStatusOptions}
                displayFormatter={(val) => getReviewStatusLabel(val as ReviewStatus)}
              />
              <InlineSelect
                label="Security Review"
                value={opportunity.securityReviewStatus || "not_started"}
                onSave={async (value) => handleFieldUpdate("securityReviewStatus", value)}
                options={reviewStatusOptions}
                displayFormatter={(val) => getReviewStatusLabel(val as ReviewStatus)}
              />
              <InlineSelect
                label="Business Case"
                value={opportunity.businessCaseStatus || "not_started"}
                onSave={async (value) => handleFieldUpdate("businessCaseStatus", value)}
                options={reviewStatusOptions}
                displayFormatter={(val) => getReviewStatusLabel(val as ReviewStatus)}
              />
            </div>
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="research" className="mt-4">
          <NotesTab
            opportunity={{
              id: opportunity.id,
              notes: opportunity.notes,
              consolidatedPainPoints: opportunity.consolidatedPainPoints,
              consolidatedGoals: opportunity.consolidatedGoals,
              consolidatedRiskAssessment: opportunity.consolidatedRiskAssessment,
              consolidatedWhyAndWhyNow: opportunity.consolidatedWhyAndWhyNow,
              consolidatedMetrics: opportunity.consolidatedMetrics,
              lastConsolidatedAt: opportunity.lastConsolidatedAt,
              consolidationCallCount: opportunity.consolidationCallCount,
            }}
            onFieldUpdate={handleFieldUpdate}
            onReconsolidate={() => router.refresh()}
          />
        </TabsContent>

        {/* Activity Tab - Horizontal Timeline */}
        <TabsContent value="activity" className="mt-4">
          <ActivitySection
            opportunityId={opportunity.id}
            onViewInsights={handleViewGongCallInsightsById}
          />
        </TabsContent>

        {/* Account Intel Tab */}
        <TabsContent value="account-intel" className="mt-4 space-y-6">
          {opportunity.account ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{opportunity.account.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Account research, SEC filings, and earnings call transcripts
                  </p>
                </div>
                {opportunity.account.ticker && (
                  <div className="text-sm text-muted-foreground">
                    Ticker: <span className="font-mono font-semibold">{opportunity.account.ticker}</span>
                  </div>
                )}
              </div>

              {/* Summary Card */}
              <AccountIntelSummaryCard
                hasAccountResearch={!!opportunity.accountResearch}
                hasSecFilings={false}
                hasEarningsTranscripts={false}
                onScrollToSection={(sectionId) => {
                  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />

              {/* Account Research Section */}
              {opportunity.account.ticker ? (
                /* Public Company: Two-column layout with SEC filings */
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <Collapsible defaultOpen={true}>
                      <Card id="account-research" className="border-l-4 border-l-blue-500">
                        <CollapsibleTrigger className="w-full group">
                          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                            <CardTitle className="flex items-center justify-between text-base">
                              <span className="font-semibold">Account Research</span>
                              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </CardTitle>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0">
                            <InlineMarkdownWithAI
                              label=""
                              value={opportunity.accountResearch || ""}
                              onSave={async (value) => handleFieldUpdate("accountResearch", value)}
                              placeholder={
                                researchStatus === "generating"
                                  ? "Generating account research with AI... This may take 10-30 seconds."
                                  : researchStatus === "failed"
                                  ? "AI generation failed. Click 'Generate with Gemini' to retry."
                                  : "AI-powered account research and pre-meeting intelligence..."
                              }
                              rows={8}
                              onGenerate={handleGenerateAccountResearch}
                              isGenerating={isGeneratingResearch || researchStatus === "generating"}
                              generateButtonLabel="Generate with Gemini"
                              useRichTextEditor={true}
                            />
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  </div>

                  <div className="space-y-4">
                    <div id="sec-filings">
                      <SecFilingsSection
                        accountId={opportunity.account.id}
                        accountTicker={opportunity.account.ticker}
                        opportunityId={opportunity.id}
                      />
                    </div>

                    <div id="earnings-transcripts">
                      <EarningsTranscriptsSection
                        accountId={opportunity.account.id}
                        accountName={opportunity.account.name}
                        accountTicker={opportunity.account.ticker}
                        nextEarningsDate={opportunity.account.nextEarningsDate}
                        lastEarningsSync={opportunity.account.lastEarningsSync}
                        opportunityId={opportunity.id}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Private Company: Single-column full-width layout */
                <Collapsible defaultOpen={true}>
                  <Card id="account-research" className="border-l-4 border-l-blue-500">
                    <CollapsibleTrigger className="w-full group">
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span className="font-semibold">Account Research</span>
                          <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <InlineMarkdownWithAI
                          label=""
                          value={opportunity.accountResearch || ""}
                          onSave={async (value) => handleFieldUpdate("accountResearch", value)}
                          placeholder={
                            researchStatus === "generating"
                              ? "Generating account research with AI... This may take 10-30 seconds."
                              : researchStatus === "failed"
                              ? "AI generation failed. Click 'Generate with Gemini' to retry."
                              : "AI-powered account research and pre-meeting intelligence..."
                          }
                          rows={8}
                          onGenerate={handleGenerateAccountResearch}
                          isGenerating={isGeneratingResearch || researchStatus === "generating"}
                          generateButtonLabel="Generate with Gemini"
                          useRichTextEditor={true}
                        />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Account Linked</h3>
                <p className="text-muted-foreground mb-4">
                  Link an account to this opportunity to view SEC filings and earnings call transcripts.
                </p>
                <Button onClick={() => setIsEditDialogOpen(true)}>
                  Link Account
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="mt-4">
          <OrgChartSection opportunityId={opportunity.id} />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab
            opportunityId={opportunity.id}
            opportunityName={opportunity.name}
            hasAccountResearch={!!opportunity.accountResearch}
            hasConsolidatedInsights={!!(opportunity.consolidatedPainPoints || opportunity.consolidatedGoals)}
          />
        </TabsContent>

        {/* Business Impact Proposal Tab */}
        <TabsContent value="proposal" className="mt-4">
          <BusinessProposalTab
            opportunityId={opportunity.id}
            businessProposalContent={opportunity.businessProposalContent}
            businessProposalGeneratedAt={opportunity.businessProposalGeneratedAt}
            businessProposalGenerationStatus={opportunity.businessProposalGenerationStatus}
            businessCaseQuestions={opportunity.businessCaseQuestions}
            onFieldUpdate={handleFieldUpdate}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Opportunity</DialogTitle>
          </DialogHeader>
          <OpportunityForm
            onSubmit={handleUpdateOpportunity}
            onCancel={() => setIsEditDialogOpen(false)}
            initialData={{
              name: opportunity.name,
              account: opportunity.account?.name || opportunity.accountName,
              accountTicker: opportunity.account?.ticker,
              accountWebsite: opportunity.account?.website,
              amountArr: opportunity.amountArr,
              confidenceLevel: opportunity.confidenceLevel,
              nextStep: opportunity.nextStep,
              cbc: opportunity.cbc,
              closeDate: opportunity.closeDate,
              stage: opportunity.stage,
              forecastCategory: opportunity.forecastCategory ?? undefined,
              riskNotes: opportunity.riskNotes,
              notes: opportunity.notes,
              accountResearch: opportunity.accountResearch,
              decisionMakers: opportunity.decisionMakers,
              competition: opportunity.competition,
              legalReviewStatus: opportunity.legalReviewStatus,
              securityReviewStatus: opportunity.securityReviewStatus,
              platformType: opportunity.platformType,
              businessCaseStatus: opportunity.businessCaseStatus,
              ownerId: opportunity.owner.id,
            }}
            submitLabel="Update Opportunity"
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Opportunity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete &quot;{opportunity.name}&quot;? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteOpportunity}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comment System - Inline popovers on desktop, bottom sheet on mobile */}
      <CommentView
        entityType="opportunity"
        entityId={opportunity.id}
        organizationId={organizationId}
        pageContext={`/opportunities/${opportunity.id}`}
        currentUser={currentUser}
        organizationUsers={organizationUsers}
        mode="inline"
      />

      {/* Comment Position Indicators */}
      <CommentAnchorIcons
        entityType="opportunity"
        entityId={opportunity.id}
        organizationId={organizationId}
        pageContext={`/opportunities/${opportunity.id}`}
        userId={userId}
      />
      <CommentScrollbarMarkers
        entityType="opportunity"
        entityId={opportunity.id}
        organizationId={organizationId}
        pageContext={`/opportunities/${opportunity.id}`}
        userId={userId}
      />

      {/* Selection Comment Toolbar - appears when text is selected */}
      <SelectionCommentToolbar
        enabled={true}
        onCommentClick={handleCommentClick}
      />

      {/* AI Chat Widget */}
      <ChatWidget
        entityType="opportunity"
        entityId={opportunity.id}
        entityName={opportunity.name}
      />

      {/* Add Gong Call Dialog (triggered from calendar events) */}
      {addGongDialogEvent && (
        <Dialog open={!!addGongDialogEvent} onOpenChange={(open) => !open && setAddGongDialogEvent(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Gong Call</DialogTitle>
            </DialogHeader>
            <GongCallsSection
              opportunityId={opportunity.id}
              calls={[]}
              preselectedCalendarEvent={addGongDialogEvent}
              onCallAdded={() => {
                setAddGongDialogEvent(null);
                handleRefreshMeetingsData();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add Granola Note Dialog (triggered from calendar events) */}
      {addGranolaDialogEvent && (
        <Dialog open={!!addGranolaDialogEvent} onOpenChange={(open) => !open && setAddGranolaDialogEvent(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Granola Note</DialogTitle>
            </DialogHeader>
            <GranolaNotesSection
              opportunityId={opportunity.id}
              notes={[]}
              preselectedCalendarEvent={addGranolaDialogEvent}
              onNoteAdded={() => {
                setAddGranolaDialogEvent(null);
                handleRefreshMeetingsData();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Parse Gong Transcript Dialog (triggered from MeetingEventCard) */}
      {selectedGongCallForParsing && (
        <ParseGongTranscriptDialog
          open={!!selectedGongCallForParsing}
          onOpenChange={(open) => {
            if (!open) setSelectedGongCallForParsing(null);
          }}
          opportunityId={opportunity.id}
          gongCallId={selectedGongCallForParsing.id}
          onContactsImported={() => {
            router.refresh();
          }}
          onParsingStarted={() => {
            router.refresh();
            handleRefreshMeetingsData();
          }}
        />
      )}

      {/* Gong Call Insights Dialog (triggered from MeetingEventCard) */}
      {selectedGongCallForViewing && selectedGongCallForViewing.parsedAt && (
        <GongCallInsightsDialog
          open={!!selectedGongCallForViewing}
          onOpenChange={(open) => {
            if (!open) setSelectedGongCallForViewing(null);
          }}
          gongCallTitle={selectedGongCallForViewing.title}
          opportunityId={opportunity.id}
          gongCallId={selectedGongCallForViewing.id}
          insights={{
            painPoints: (selectedGongCallForViewing.painPoints as string[]) || [],
            goals: (selectedGongCallForViewing.goals as string[]) || [],
            people: (selectedGongCallForViewing.parsedPeople as PersonExtracted[]) || [],
            nextSteps: (selectedGongCallForViewing.nextSteps as string[]) || [],
          }}
          riskAssessment={(selectedGongCallForViewing.riskAssessment as RiskAssessment) || null}
          onContactsImported={() => {
            router.refresh();
          }}
          onRiskAnalysisComplete={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
