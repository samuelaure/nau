import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getVoicenotes, getYoutubeVideos, getBlogPosts } from '../lib/api';
import { Sparkles, Youtube, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { BrandCategoryLayout } from './BrandCategoryLayout';
import { StatusBadge } from '../components/StatusBadge';
import { CreateContentButton } from '../components/CreateContentButton';

export const BrandInspoBaseView = () => {
  const { brandId } = useParams<{ brandId: string }>();

  const { data: voicenotes, isLoading: loadingVoicenotes } = useQuery({
    queryKey: ['voicenotes', brandId],
    queryFn: () => getVoicenotes(brandId!),
    enabled: !!brandId,
  });

  const { data: youtubeVideos, isLoading: loadingYoutube } = useQuery({
    queryKey: ['inspo-youtube', brandId],
    queryFn: () => getYoutubeVideos(brandId!),
    enabled: !!brandId,
  });

  const { data: blogPosts, isLoading: loadingBlog } = useQuery({
    queryKey: ['inspo-blog', brandId],
    queryFn: () => getBlogPosts(brandId!),
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
          content: <VoicenotesTab voicenotes={voicenotes ?? []} loading={loadingVoicenotes} brandId={brandId!} />,
        },
        {
          key: 'youtube',
          label: `YouTube${!loadingYoutube ? ` (${youtubeVideos?.length ?? 0})` : ''}`,
          content: <YoutubeTab videos={youtubeVideos ?? []} loading={loadingYoutube} brandId={brandId!} />,
        },
        {
          key: 'blog',
          label: `Blog${!loadingBlog ? ` (${blogPosts?.length ?? 0})` : ''}`,
          content: <BlogTab posts={blogPosts ?? []} loading={loadingBlog} brandId={brandId!} />,
        },
      ]}
    />
  );
};


const VoicenotesTab = ({ voicenotes, loading, brandId }: { voicenotes: any[]; loading: boolean; brandId: string }) => {
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
        <div key={v.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>
              {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
            </span>
            <CreateContentButton brandId={brandId} itemType="voicenote" itemId={v.id} />
          </div>
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

const YoutubeTab = ({ videos, loading, brandId }: { videos: ReturnType<typeof getYoutubeVideos> extends Promise<infer T> ? T : never; loading: boolean; brandId: string }) => {
  if (loading) return <div style={{ color: '#8b949e' }}>Loading YouTube videos...</div>;

  if (videos.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e', border: '1px dashed var(--border)', borderRadius: '10px' }}>
        No YouTube videos added yet. Paste a YouTube URL in "Add to InspoBase".
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
      {videos.map((v) => (
        <div key={v.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', position: 'relative', aspectRatio: '16/9', background: '#0d1117' }}>
            <img
              src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
              alt={v.title ?? 'YouTube video'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
              <Youtube size={36} style={{ color: '#ff0000', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }} />
            </div>
          </a>
          <div style={{ padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#f0f6fc', lineHeight: 1.4 }}>
                {v.title ?? 'Untitled video'}
              </p>
              <StatusBadge status={v.status} />
            </div>
            {v.channelName && (
              <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>{v.channelName}</span>
            )}
            {v.failureReason && (
              <span style={{ fontSize: '0.72rem', color: '#f85149' }} title={v.failureReason}>
                {v.failureReason === 'duration_limit_exceeded' ? 'Video exceeds 60-minute limit' : v.failureReason}
              </span>
            )}
            {v.status === 'done' && <CreateContentButton brandId={brandId} itemType="youtube" itemId={v.id} />}
          </div>
        </div>
      ))}
    </div>
  );
};

const BlogTab = ({ posts, loading, brandId }: { posts: ReturnType<typeof getBlogPosts> extends Promise<infer T> ? T : never; loading: boolean; brandId: string }) => {
  if (loading) return <div style={{ color: '#8b949e' }}>Loading blog posts...</div>;

  if (posts.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e', border: '1px dashed var(--border)', borderRadius: '10px' }}>
        No blog posts added yet. Paste a blog URL in "Add to InspoBase".
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {posts.map((p) => {
        let domain = '';
        try { domain = new URL(p.url).hostname } catch {}
        return (
          <div key={p.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.1rem', display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
            <img
              src={domain ? `https://${domain}/favicon.ico` : ''}
              alt=""
              width={20}
              height={20}
              style={{ marginTop: '2px', borderRadius: '3px', flexShrink: 0 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#58a6ff', textDecoration: 'none', lineHeight: 1.4 }}>
                  {p.title ?? domain}
                </a>
                <StatusBadge status={p.status} />
              </div>
              {p.author && <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>{p.author}</span>}
              <span style={{ fontSize: '0.72rem', color: '#6e7681' }}>{domain}</span>
              {p.failureReason && (
                <span style={{ fontSize: '0.72rem', color: '#f85149' }}>{p.failureReason}</span>
              )}
              {p.status === 'done' && <CreateContentButton brandId={brandId} itemType="blog" itemId={p.id} />}
            </div>
            <FileText size={16} style={{ color: '#8b949e', flexShrink: 0, marginTop: '2px' }} />
          </div>
        )
      })}
    </div>
  );
};
