import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getVoicenotes } from '../lib/api';
import { Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { BrandCategoryLayout } from './BrandCategoryLayout';

export const BrandInspoBaseView = () => {
  const { brandId } = useParams<{ brandId: string }>();

  const { data: voicenotes, isLoading: loadingVoicenotes } = useQuery({
    queryKey: ['voicenotes', brandId],
    queryFn: () => getVoicenotes(brandId!),
    enabled: !!brandId,
  });

  return (
    <BrandCategoryLayout
      category="INSPO"
      targetType="inspo"
      title="InspoBase"
      icon={<Sparkles size={28} style={{ color: '#d29922' }} />}
      accentColor="#d29922"
      description="Profiles and posts that fuel your brand's creative direction."
      extraTabs={[
        {
          key: 'voicenotes',
          label: `Voicenotes${!loadingVoicenotes ? ` (${voicenotes?.length ?? 0})` : ''}`,
          content: <VoicenotesTab voicenotes={voicenotes ?? []} loading={loadingVoicenotes} />,
        },
      ]}
    />
  );
};

const VoicenotesTab = ({ voicenotes, loading }: { voicenotes: any[]; loading: boolean }) => {
  if (loading) return <div style={{ color: '#8b949e' }}>Loading voicenotes...</div>;

  if (voicenotes.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e', border: '1px dashed var(--border)', borderRadius: '10px' }}>
        No voicenotes captured yet. Send a voice message to Zazŭ to capture content ideas.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {voicenotes.map((v: any) => (
        <div key={v.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>
            {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
          </span>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#c9d1d9', lineHeight: '1.6' }}>{v.cleanTranscription}</p>
          {v.synthesis && (
            <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Synthesis</span>
              <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: '#f0f6fc', fontStyle: 'italic', lineHeight: '1.5' }}>{v.synthesis}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
