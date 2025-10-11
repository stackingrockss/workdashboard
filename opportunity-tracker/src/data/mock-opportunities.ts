import { Opportunity, OpportunityStage } from "@/types/opportunity";

const owners = [
  { id: "u1", name: "Alex Johnson", avatarUrl: undefined },
  { id: "u2", name: "Priya Singh", avatarUrl: undefined },
  { id: "u3", name: "Marco Ruiz", avatarUrl: undefined },
];

const today = new Date();
const iso = (d: Date) => d.toISOString();

export const mockOpportunities: Opportunity[] = [
  {
    id: "opp-001",
    name: "Renewal - Acme Corp",
    account: "Acme Corp",
    amountArr: 24000,
    probability: 70,
    nextStep: "Send updated MSA",
    closeDate: iso(new Date(today.getFullYear(), today.getMonth() + 1, 15)),
    stage: "proposal",
    owner: owners[0],
    createdAt: iso(new Date(today.getFullYear(), today.getMonth() - 2, 5)),
    updatedAt: iso(today),
  },
  {
    id: "opp-002",
    name: "New Biz - Globex",
    account: "Globex",
    amountArr: 54000,
    probability: 40,
    nextStep: "Schedule demo with CTO",
    closeDate: iso(new Date(today.getFullYear(), today.getMonth() + 2, 1)),
    stage: "qualification",
    owner: owners[1],
    createdAt: iso(new Date(today.getFullYear(), today.getMonth() - 1, 12)),
    updatedAt: iso(today),
  },
  {
    id: "opp-003",
    name: "Expansion - Initech",
    account: "Initech",
    amountArr: 120000,
    probability: 55,
    nextStep: "Draft proposal",
    closeDate: iso(new Date(today.getFullYear(), today.getMonth() + 1, 30)),
    stage: "prospect",
    owner: owners[2],
    createdAt: iso(new Date(today.getFullYear(), today.getMonth() - 3, 23)),
    updatedAt: iso(today),
  },
  {
    id: "opp-004",
    name: "New Biz - Hooli",
    account: "Hooli",
    amountArr: 36000,
    probability: 25,
    nextStep: "Intro call with VP Eng",
    closeDate: iso(new Date(today.getFullYear(), today.getMonth() + 3, 10)),
    stage: "prospect",
    owner: owners[0],
    createdAt: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    updatedAt: iso(today),
  },
  {
    id: "opp-005",
    name: "New Biz - Umbrella",
    account: "Umbrella Co",
    amountArr: 84000,
    probability: 65,
    nextStep: "Security review",
    closeDate: iso(new Date(today.getFullYear(), today.getMonth() + 2, 20)),
    stage: "negotiation",
    owner: owners[1],
    createdAt: iso(new Date(today.getFullYear(), today.getMonth() - 2, 8)),
    updatedAt: iso(today),
  },
  {
    id: "opp-006",
    name: "Renewal - Soylent",
    account: "Soylent",
    amountArr: 18000,
    probability: 95,
    nextStep: "Book signature",
    closeDate: iso(new Date(today.getFullYear(), today.getMonth(), 28)),
    stage: "proposal",
    owner: owners[2],
    createdAt: iso(new Date(today.getFullYear(), today.getMonth() - 4, 17)),
    updatedAt: iso(today),
  },
];

export const defaultColumns: { id: OpportunityStage; title: string }[] = [
  { id: "prospect", title: "Prospect" },
  { id: "qualification", title: "Qualification" },
  { id: "proposal", title: "Proposal" },
  { id: "negotiation", title: "Negotiation" },
  { id: "closedWon", title: "Closed Won" },
  { id: "closedLost", title: "Closed Lost" },
];


