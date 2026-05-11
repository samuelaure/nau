import { Routes, Route, Navigate } from 'react-router-dom';
import { ProjectCapturesView } from './ProjectCapturesView';
import { ProjectSettingsView } from './ProjectSettingsView';

export const ProjectLayout = () => {
  return (
    <Routes>
      <Route path="captures" element={<ProjectCapturesView />} />
      <Route path="settings" element={<ProjectSettingsView />} />
      <Route path="*" element={<Navigate to="captures" replace />} />
    </Routes>
  );
};
