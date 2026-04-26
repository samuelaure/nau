import { Routes, Route, Navigate } from 'react-router-dom';
import { BrandContentView } from './BrandContentView';
import { BrandInspoBaseView } from './BrandInspoBaseView';
import { BrandCommentsLayout } from './BrandCommentsLayout';
import { BrandBenchmarkView } from './BrandBenchmarkView';
import { BrandProfilesView } from './BrandProfilesView';

export const BrandLayout = () => {
  return (
    <Routes>
      <Route path="content" element={<BrandContentView />} />
      <Route path="inspo" element={<BrandInspoBaseView />} />
      <Route path="inspobase" element={<Navigate to="../inspo" replace />} />
      <Route path="profiles" element={<BrandProfilesView />} />
      <Route path="comments/*" element={<BrandCommentsLayout />} />
      <Route path="benchmark" element={<BrandBenchmarkView />} />
      <Route path="*" element={<Navigate to="content" replace />} />
    </Routes>
  );
};
