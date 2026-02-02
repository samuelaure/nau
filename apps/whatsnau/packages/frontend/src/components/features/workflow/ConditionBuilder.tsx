import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowCondition } from './types';

interface ConditionBuilderProps {
  condition: WorkflowCondition;
  onChange: (condition: WorkflowCondition) => void;
  isRoot?: boolean;
}

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  condition,
  onChange,
  isRoot = false,
}) => {
  const addRule = () => {
    const newChildren = [
      ...(condition.children || []),
      {
        id: uuidv4(),
        type: 'rule' as const,
        field: 'status',
        conditionOperator: 'equals' as const,
        value: '',
      },
    ];
    onChange({ ...condition, children: newChildren });
  };

  const addGroup = () => {
    const newChildren = [
      ...(condition.children || []),
      {
        id: uuidv4(),
        type: 'group' as const,
        operator: 'AND' as const,
        children: [],
      },
    ];
    onChange({ ...condition, children: newChildren });
  };

  const removeChild = (id: string) => {
    const newChildren = (condition.children || []).filter((c) => c.id !== id);
    onChange({ ...condition, children: newChildren });
  };

  const updateChild = (id: string, updatedChild: WorkflowCondition) => {
    const newChildren = (condition.children || []).map((c) => (c.id === id ? updatedChild : c));
    onChange({ ...condition, children: newChildren });
  };

  if (condition.type === 'rule') {
    return (
      <div className="condition-rule">
        <select
          value={condition.field}
          onChange={(e) => onChange({ ...condition, field: e.target.value })}
        >
          <option value="status">Lead Status</option>
          <option value="last_message">Last Message</option>
          <option value="tag">Tag</option>
          <option value="ai_active">AI Active</option>
        </select>

        <select
          value={condition.conditionOperator}
          onChange={(e) => onChange({ ...condition, conditionOperator: e.target.value as WorkflowCondition['conditionOperator'] })}
        >
          <option value="equals">equals</option>
          <option value="not_equals">not equals</option>
          <option value="contains">contains</option>
          <option value="gt">greater than</option>
          <option value="lt">less than</option>
        </select>

        <input
          type="text"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="Value..."
        />

        {!isRoot && (
          <button className="icon-btn danger" onClick={() => removeChild(condition.id)}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`condition-group ${isRoot ? 'root-group' : 'nested-group'}`}>
      <div className="group-header">
        <select
          value={condition.operator}
          onChange={(e) => onChange({ ...condition, operator: e.target.value as WorkflowCondition['operator'] })}
          className="operator-select"
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>

        <div className="group-actions">
          <button className="text-btn" onClick={addRule}>
            <Plus size={14} /> Rule
          </button>
          <button className="text-btn" onClick={addGroup}>
            <Plus size={14} /> Group
          </button>
          {!isRoot && (
            <button className="icon-btn danger" onClick={() => removeChild(condition.id)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="group-children">
        {(condition.children || []).map((child) => (
          <ConditionBuilder
            key={child.id}
            condition={child}
            onChange={(updated) => updateChild(child.id, updated)}
          />
        ))}
        {(condition.children || []).length === 0 && (
          <div className="empty-group">No conditions added...</div>
        )}
      </div>
    </div>
  );
};
