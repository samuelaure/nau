import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInspoDigest, getVoicenotes } from '../lib/api';
import { Sparkles, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { BrandCategoryLayout } from './BrandCategoryLayout';

export const BrandInspoBaseView = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const [showSynthesis, setShowSynthesis] = useState(false);

  const { data: digest, isFetching: fetchingDigest, refetch: refetchDigest } = useQuery({
    queryKey: ['inspo-digest', brandId],
    queryFn: () => getInspoDigest(brandId!),
    enabled: !!brandId,
  });

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
      extraActionButtons={
        <button
          onClick={() => setShowSynthesis(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.5rem 1rem', fontSize: '0.9rem',
            background: showSynthesis ? 'rgba(210,153,34,0.15)' : 'rgba(255,255,255,0.05)',
            color: showSynthesis ? '#d29922' : '#8b949e',
            border: `1px solid ${showSynthesis ? 'rgba(210,153,34,0.4)' : 'var(--border)'}`,
            borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <Sparkles size={14} />
          Creative Direction
          {showSynthesis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      }
      headerPanelContent={showSynthesis ? (
        <SynthesisPanel
          digest={digest}
          fetching={fetchingDigest}
          onRefetch={refetchDigest}
        />
      ) : null}
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

const SynthesisPanel = ({
  digest,
  fetching,
  onRefetch,
}: {
  digest: any;
  fetching: boolean;
  onRefetch: () => void;
}) => (
  <div style={{ background: 'var(--card-bg)', border: '1px solid rgba(210,153,34,0.3)', borderRadius: '12px', padding: '1.5rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <span style={{ fontSize: '0.85rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Current Creative Direction
      </span>
      <button
        onClick={onRefetch}
        disabled={fetching}
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: 'rgba(88,166,255,0.1)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
      >
        <RefreshCw size={12} className={fetching ? 'spin' : ''} />
        {fetching ? 'Synthesizing…' : 'Re-generate'}
      </button>
    </div>

    {digest ? (
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: 'linear-gradient(to bottom, #d29922, #58a6ff)', borderRadius: '2px' }} />
        <p style={{ paddingLeft: '1rem', lineHeight: '1.6', fontSize: '1rem', color: '#f0f6fc', whiteSpace: 'pre-wrap', margin: 0 }}>
          {digest.content}
        </p>
        {digest.attachedUrls?.length > 0 && (
          <div style={{ paddingLeft: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Influences</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '0.4rem', flexWrap: 'wrap' }}>
              {digest.attachedUrls.map((url: string) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#58a6ff', textDecoration: 'none', background: 'rgba(88,166,255,0.1)', padding: '3px 10px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ExternalLink size={11} />
                  {url.split('/p/')[1]?.split('/')[0] || 'View Post'}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    ) : (
      <p style={{ margin: 0, color: '#8b949e', fontSize: '0.9rem' }}>
        No synthesis generated yet. Add inspo items first, then hit Re-generate.
      </p>
    )}
  </div>
);

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
