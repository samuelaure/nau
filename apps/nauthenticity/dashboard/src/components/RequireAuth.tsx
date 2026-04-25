import { isAuthenticated } from '../lib/auth';
import { LandingPage } from '../pages/LandingPage';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <LandingPage />;
  return <>{children}</>;
}
