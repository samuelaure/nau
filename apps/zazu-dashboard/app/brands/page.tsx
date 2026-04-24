import { getBrands } from '../lib/actions';
import ClientBrandsList from '../components/ClientBrandsList';
import { TelegramProvider } from '../components/TelegramProvider';

export default async function BrandsPage() {
  const brands = await getBrands();
  
  return (
    <main className="min-h-screen bg-bg-dark">
      <TelegramProvider>
        <ClientBrandsList initialBrands={brands} />
      </TelegramProvider>
    </main>
  );
}
