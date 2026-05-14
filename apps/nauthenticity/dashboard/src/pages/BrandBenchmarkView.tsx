import { BarChart2 } from 'lucide-react';
import { BrandCategoryLayout } from './BrandCategoryLayout';

export const BrandBenchmarkView = () => (
  <BrandCategoryLayout
    category="BENCHMARK"
    targetType="benchmark"
    title="Benchmarks"
    icon={<BarChart2 size={28} style={{ color: '#0969da' }} />}
    accentColor="#0969da"
    description="Profiles and posts tracked for competitive analysis and visual benchmarking."
  />
);
