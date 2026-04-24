import React from 'react';

interface TagProps {
  children: React.ReactNode;
  color?: string;
}

export const Tag: React.FC<TagProps> = ({ children, color }) => (
  <span className="tag" style={color ? { borderColor: color } : {}}>
    {children}
  </span>
);
