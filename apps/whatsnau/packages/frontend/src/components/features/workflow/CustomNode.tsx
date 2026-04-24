import { memo } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { MessageSquare, Clock, GitBranch, Play, StopCircle } from 'lucide-react';

export const CustomNode = memo(({ data, type, selected }: NodeProps<Node>) => {
  const getIcon = () => {
    switch (type) {
      case 'trigger':
        return <Play size={16} />;
      case 'message':
        return <MessageSquare size={16} />;
      case 'wait':
        return <Clock size={16} />;
      case 'logic':
        return <GitBranch size={16} />;
      case 'end':
        return <StopCircle size={16} />;
      default:
        return null;
    }
  };

  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      <div className="node-header">
        {getIcon()}
        <span>{(data.label as string) || type?.toUpperCase()}</span>
      </div>
      <div className="node-content">
        {type === 'message' && ((data.content as string) || 'Send Message...')}
        {type === 'wait' &&
          `Wait ${(data.duration as number) || 0} ${(data.unit as string) || 'hours'}`}
        {type === 'logic' && 'Conditional Branch'}
      </div>

      <Handle type="target" position={Position.Top} />

      {type === 'logic' ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            style={{ left: '30%', background: 'var(--success)' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            style={{ left: '70%', background: 'var(--danger)' }}
          />
        </>
      ) : type !== 'end' ? (
        <Handle type="source" position={Position.Bottom} />
      ) : null}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
