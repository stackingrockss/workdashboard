"use client";

import { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  ConnectionLineType,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { Contact } from "@/types/contact";
import { OrgChartNode } from "./OrgChartNode";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";

interface OrgChartViewProps {
  contacts: Contact[];
  onContactClick?: (contact: Contact) => void;
  onPositionChange?: (contactId: string, x: number, y: number) => void;
}

const nodeTypes = {
  orgChartNode: OrgChartNode,
};

// Configure dagre for automatic layout
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "TB", // Top to bottom
    nodesep: 80,
    ranksep: 120,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 280, height: 160 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 140, // Center the node
        y: nodeWithPosition.y - 80,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export function OrgChartView({
  contacts,
  onContactClick,
  onPositionChange,
}: OrgChartViewProps) {
  // Convert contacts to nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = contacts.map((contact) => ({
      id: contact.id,
      type: "orgChartNode",
      data: {
        contact,
        onEdit: onContactClick,
      },
      position: {
        x: contact.positionX ?? 0,
        y: contact.positionY ?? 0,
      },
    }));

    const edges: Edge[] = contacts
      .filter((contact) => contact.managerId)
      .map((contact) => ({
        id: `${contact.managerId}-${contact.id}`,
        source: contact.managerId!,
        target: contact.id,
        type: ConnectionLineType.SmoothStep,
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: {
          strokeWidth: 2,
          stroke: "#94a3b8",
        },
      }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [contacts, onContactClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when contacts change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle node drag end
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onPositionChange) {
        onPositionChange(node.id, node.position.x, node.position.y);
      }
    },
    [onPositionChange]
  );

  // Auto-layout function
  const onLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges
    );

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);

    // Save positions
    if (onPositionChange) {
      layoutedNodes.forEach((node) => {
        onPositionChange(node.id, node.position.x, node.position.y);
      });
    }
  }, [nodes, edges, setNodes, setEdges, onPositionChange]);

  // Auto-layout on first render if positions aren't set
  useEffect(() => {
    const hasPositions = contacts.some(
      (c) => c.positionX !== null || c.positionY !== null
    );
    if (!hasPositions && contacts.length > 0) {
      onLayout();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount, intentionally ignoring contacts and onLayout

  if (contacts.length === 0) {
    return (
      <div className="h-[600px] flex items-center justify-center text-muted-foreground border rounded-lg">
        Add contacts to see the organization chart
      </div>
    );
  }

  return (
    <div className="h-[600px] border rounded-lg bg-slate-50 dark:bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.5,
          maxZoom: 1.5,
        }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: ConnectionLineType.SmoothStep,
        }}
      >
        <Background />
        <Controls />
        <Panel position="top-right" className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onLayout}
            className="gap-2"
          >
            <LayoutDashboard className="h-4 w-4" />
            Auto Layout
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
