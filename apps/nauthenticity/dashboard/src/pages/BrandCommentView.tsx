import { Activity } from 'lucide-react';
import { BrandCategoryLayout } from './BrandCategoryLayout';

export const BrandCommentView = () => (
  <BrandCategoryLayout
    category="COMMENT"
    targetType="monitored"
    title="Comments"
    icon={<Activity size={28} style={{ color: '#3fb950' }} />}
    accentColor="#3fb950"
    description="Profiles and posts monitored for proactive comment generation."
  />
);
