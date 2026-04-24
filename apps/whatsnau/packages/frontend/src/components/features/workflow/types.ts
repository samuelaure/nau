export type NodeType = 'trigger' | 'message' | 'wait' | 'logic' | 'end';

export interface WorkflowCondition {
  id: string;
  type: 'rule' | 'group';
  operator?: 'AND' | 'OR';
  field?: string;
  conditionOperator?: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'gt' | 'lt';
  value?: string;
  children?: WorkflowCondition[];
}

export interface NodeData {
  label: string;
  // Message Node
  templateId?: string;
  content?: string;
  // Wait Node
  duration?: number;
  unit?: 'minutes' | 'hours' | 'days';
  // Logic Node
  conditions?: WorkflowCondition;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  data: NodeData;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
