import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'active' }) => (
  <span className={`badge badge-${variant.toLowerCase()}`}>{children}</span>
);
