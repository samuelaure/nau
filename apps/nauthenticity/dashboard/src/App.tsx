import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { ProfilesList } from './pages/ProfilesList';
import { ProfileView } from './pages/ProfileView';
import { PostView } from './pages/PostView';
import { ProgressView } from './pages/ProgressView';
import { AuthCallback } from './pages/AuthCallback';
import { WorkspaceSettings } from './pages/WorkspaceSettings';
import { WorkspacesList } from './pages/WorkspacesList';
import { BrandsList } from './pages/BrandsList';
import { BrandLayout } from './pages/BrandLayout';
import { RequireAuth } from './components/RequireAuth';
import { Sidebar } from './components/Sidebar';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/complete" element={<AuthCallback />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <div className="app-layout">
                  <Sidebar />
                  <main className="main-content">
                    <Routes>
                      <Route path="/workspaces" element={<WorkspacesList />} />
                      <Route path="/workspaces/:workspaceId/brands" element={<BrandsList />} />
                      <Route
                        path="/workspaces/:workspaceId/brands/:brandId/*"
                        element={<BrandLayout />}
                      />
                      <Route path="/dashboard" element={<Navigate to="/workspaces" replace />} />

                      {/* Legacy routes */}
                      <Route path="/accounts" element={<ProfilesList />} />
                      <Route path="/accounts/:username" element={<ProfileView />} />
                      <Route path="/profiles" element={<ProfilesList />} />
                      <Route path="/profiles/:username" element={<ProfileView />} />
                      <Route path="/posts/:id" element={<PostView />} />
                      <Route path="/progress" element={<ProgressView />} />
                      <Route path="/workspace-settings" element={<WorkspaceSettings />} />
                    </Routes>
                  </main>
                </div>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
