import { getBrands } from '../lib/actions';
import ClientBrandsList from '../components/ClientBrandsList';

export default async function BrandsPage() {
  const brands = await getBrands();
  
  return (
    <main className="min-h-screen bg-bg-dark">
      <ClientBrandsList initialBrands={brands} />
    </main>
  );
}
