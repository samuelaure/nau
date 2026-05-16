import { Routes, Route, Navigate } from 'react-router-dom';
import { BrandContentView } from './BrandContentView';
import { BrandInspoBaseView } from './BrandInspoBaseView';
import { BrandCommentView } from './BrandCommentView';
import { BrandBenchmarkView } from './BrandBenchmarkView';
import { BrandOwnedView } from './BrandOwnedView';
import { BrandTrashView } from './BrandTrashView';

export const BrandLayout = () => {
  return (
    <Routes>
      <Route path="content" element={<BrandContentView />} />
      <Route path="content/profiles/:username" element={<BrandContentView />} />
      <Route path="inspo/*" element={<BrandInspoBaseView />} />
      <Route path="inspobase" element={<Navigate to="../inspo" replace />} />
      <Route path="comments/*" element={<BrandCommentView />} />
      <Route path="benchmark/*" element={<BrandBenchmarkView />} />
      <Route path="trash" element={<BrandTrashView />} />
      <Route path="settings/*" element={<BrandOwnedView />} />
      <Route path="*" element={<Navigate to="content" replace />} />
    </Routes>
  );
};
