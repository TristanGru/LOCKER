import { useEffect, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { api } from "./api";
import type { GraphData, SourceRef } from "./types";
import { Loading, percent, tone } from "./ui";
import "@xyflow/react/dist/style.css";

interface Props {
  ship: string;
  eventId: string;
  version: number;
  bands: { green: number; yellow: number };
  onSelect: (eic: string | null, sources: SourceRef[]) => void;
}
export default function DominoGraph({
  ship,
  eventId,
  version,
  bands,
  onSelect,
}: Props) {
  const [graph, setGraph] = useState<GraphData | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setGraph(null);
    setError("");
    api
      .graph(ship, eventId)
      .then((result) => {
        if (live) setGraph(result);
      })
      .catch((failure) => {
        if (live) setError(String(failure));
      });
    return () => {
      live = false;
    };
  }, [ship, eventId, version]);
  if (error)
    return (
      <p className="error-banner" role="alert">
        {error}
      </p>
    );
  if (!graph) return <Loading text="Building dependency map" />;
  const layout = new dagre.graphlib.Graph();
  layout.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 90 });
  layout.setDefaultEdgeLabel(() => ({}));
  graph.nodes.forEach((node) =>
    layout.setNode(node.id, { width: 225, height: 108 }),
  );
  graph.edges.forEach((edge) => layout.setEdge(edge.source, edge.target));
  dagre.layout(layout);
  const nodes: Node[] = graph.nodes.map((node) => ({
    id: node.id,
    position: {
      x: layout.node(node.id).x - 112,
      y: layout.node(node.id).y - 54,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    className: `domino-node ${tone(node.p, bands)} ${node.next ? "next-domino" : ""}`,
    data: {
      label: (
        <div>
          <small>{node.next ? "NEXT DOMINO" : node.kind.toUpperCase()}</small>
          <strong>{node.label}</strong>
          <b>{percent(node.p)}</b>
        </div>
      ),
    },
    ariaLabel: `${node.label}, ${percent(node.p)}${node.next ? ", next domino" : ""}`,
  }));
  const edges: Edge[] = graph.edges.map((edge, index) => ({
    id: `edge-${index}`,
    ...edge,
    type: "smoothstep",
    style: { stroke: "#607b91", strokeWidth: 1.5 },
  }));
  return (
    <div className="graph-container">
      <ReactFlow
        key={`${ship}-${eventId}-${version}`}
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.12}
        maxZoom={1.7}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_event, node) => {
          const detail = graph.nodes.find((item) => item.id === node.id)!;
          onSelect(detail.eic || null, detail.sources || []);
        }}
      >
        <Background color="#253f52" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="graph-caption">
        Record → requirement → event / sampled event-interval assessment
      </div>
    </div>
  );
}
