import React, { useState, useCallback, useMemo } from 'react';
import type {
  Connection,
  Edge,
  Node,
  OnNodesChange,
  OnEdgesChange,
  NodeTypes,
} from '@xyflow/react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Save } from 'lucide-react';
import { CustomNode } from './CustomNode';
import { ConditionBuilder } from './ConditionBuilder';
import type { NodeType, WorkflowDefinition, WorkflowCondition, NodeData } from './types';

const initialNodes: Node[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 250, y: 0 },
    data: { label: 'Start Flow' },
  },
];

const nodeTypes: NodeTypes = {
  trigger: CustomNode,
  message: CustomNode,
  wait: CustomNode,
  logic: CustomNode,
  end: CustomNode,
};

export const WorkflowBuilder: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  };

  const addNode = (type: NodeType) => {
    const newNode: Node = {
      id: uuidv4(),
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: type.charAt(0).toUpperCase() + type.slice(1),
        ...(type === 'logic' && {
          conditions: {
            id: 'root',
            type: 'group',
            operator: 'AND',
            children: [],
          },
        }),
        ...(type === 'wait' && { duration: 24, unit: 'hours' }),
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const updateNodeData = (id: string, newData: Partial<NodeData>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...newData } } : n))
    );
  };

  const exportJSON = () => {
    const definition: WorkflowDefinition = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type as NodeType,
        data: n.data as unknown as NodeData,
        position: n.position,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
      })),
    };
    console.log('Exported Workflow:', JSON.stringify(definition, null, 2));
    alert('Workflow exported to console!');
  };

  return (
    <div className="workflow-container">
      <div className="workflow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <Panel position="top-left" className="workflow-controls">
            <button className="text-btn" onClick={() => addNode('message')}>
              <Plus size={14} /> Message
            </button>
            <button className="text-btn" onClick={() => addNode('wait')}>
              <Plus size={14} /> Wait
            </button>
            <button className="text-btn" onClick={() => addNode('logic')}>
              <Plus size={14} /> Logic
            </button>
            <button className="text-btn" onClick={() => addNode('end')}>
              <Plus size={14} /> End
            </button>
            <button className="text-btn primary" onClick={exportJSON}>
              <Save size={14} /> Export
            </button>
          </Panel>
        </ReactFlow>
      </div>

      {selectedNode && (
        <div className="node-editor-sidebar">
          <h2 className="sidebar-title">Edit Node</h2>

          <div className="editor-field">
            <label>Label</label>
            <input
              type="text"
              value={(selectedNode.data.label as string) || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>

          {selectedNode.type === 'message' && (
            <div className="editor-field">
              <label>Message Content</label>
              <textarea
                value={(selectedNode.data.content as string) || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { content: e.target.value })}
                rows={4}
              />
            </div>
          )}

          {selectedNode.type === 'wait' && (
            <>
              <div className="editor-field">
                <label>Duration</label>
                <input
                  type="number"
                  value={(selectedNode.data.duration as number) || 0}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, { duration: parseInt(e.target.value) })
                  }
                />
              </div>
              <div className="editor-field">
                <label>Unit</label>
                <select
                  value={(selectedNode.data.unit as string) || 'hours'}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, { unit: e.target.value as NodeData['unit'] })
                  }
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </>
          )}

          {selectedNode.type === 'logic' && (
            <div className="editor-field">
              <label>Branch Conditions</label>
              <ConditionBuilder
                condition={selectedNode.data.conditions as WorkflowCondition}
                onChange={(conditions) => updateNodeData(selectedNode.id, { conditions })}
                isRoot
              />
            </div>
          )}

          <button
            className="secondary"
            style={{ width: '100%' }}
            onClick={() => setSelectedNodeId(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};
