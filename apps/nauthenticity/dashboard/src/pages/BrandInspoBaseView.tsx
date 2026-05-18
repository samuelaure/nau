import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getVoicenotes, getYoutubeVideos, getBlogPosts, retryYoutubeVideo, retryBlogPost } from '../lib/api';
import { Sparkles, Youtube, FileText, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { BrandCategoryLayout } from './BrandCategoryLayout';
import { StatusBadge } from '../components/StatusBadge';

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
          content: <VoicenotesTab voicenotes={voicenotes ?? []} loading={loadingVoicenotes} />,
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


const VoicenotesTab = ({ voicenotes, loading }: { voicenotes: any[]; loading: boolean }) => {
  const location = useLocation();

  if (loading) return <div style={{ color: '#8b949e' }}>Loading voicenotes...</div>;

  if (voicenotes.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e', border: '1px dashed var(--border)', borderRadius: '10px' }}>
        No voicenotes captured yet. Send a voice message to Zazŭ to capture content ideas.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      {voicenotes.map((v: any) => {
        const preview = v.cleanTranscription.length > 200
          ? v.cleanTranscription.slice(0, 200).trimEnd() + '…'
          : v.cleanTranscription;
        return (
          <Link
            key={v.id}
            to={`/voicenotes/${v.id}`}
            state={{ backTo: location.pathname + location.search }}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px',
              padding: '1.1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
              textDecoration: 'none', color: 'inherit', transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#58a6ff66')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <span style={{ fontSize: '0.72rem', color: '#8b949e' }}>
              {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
            </span>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#c9d1d9', lineHeight: 1.55 }}>{preview}</p>
          </Link>
        );
      })}
    </div>
  );
};

const YoutubeTab = ({ videos, loading, brandId }: { videos: any[]; loading: boolean; brandId: string }) => {
  const location = useLocation();
  const qc = useQueryClient();
  const retry = useMutation({
    mutationFn: (id: string) => retryYoutubeVideo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspo-youtube', brandId] }),
  });

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
        <Link
          key={v.id}
          to={`/youtube-videos/${v.id}`}
          state={{ backTo: location.pathname + location.search }}
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px',
            overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#58a6ff66')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0d1117' }}>
            <img
              src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
              alt={v.title ?? 'YouTube video'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
              <Youtube size={36} style={{ color: '#ff0000', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }} />
            </div>
            <a
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open on YouTube"
              style={{
                position: 'absolute', top: '6px', right: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '26px', height: '26px', borderRadius: '6px',
                background: 'rgba(0,0,0,0.65)', color: '#fff', textDecoration: 'none',
              }}
            >
              <ExternalLink size={13} />
            </a>
          </div>
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
            {v.status === 'failed' && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); retry.mutate(v.id); }}
                disabled={retry.isPending}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'flex-start',
                  padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                  background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.3)',
                  color: '#58a6ff', cursor: 'pointer',
                }}
              >
                {retry.isPending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />}
                Retry
              </button>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
};

const BlogTab = ({ posts, loading, brandId }: { posts: any[]; loading: boolean; brandId: string }) => {
  const location = useLocation();
  const qc = useQueryClient();
  const retry = useMutation({
    mutationFn: (id: string) => retryBlogPost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspo-blog', brandId] }),
  });

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
          <Link
            key={p.id}
            to={`/blog-posts/${p.id}`}
            state={{ backTo: location.pathname + location.search }}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px',
              padding: '1.1rem', display: 'flex', gap: '0.9rem', alignItems: 'flex-start',
              textDecoration: 'none', color: 'inherit', transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#58a6ff66')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
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
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f0f6fc', lineHeight: 1.4 }}>
                  {p.title ?? domain}
                </span>
                <StatusBadge status={p.status} />
              </div>
              {p.author && <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>{p.author}</span>}
              <span style={{ fontSize: '0.72rem', color: '#6e7681' }}>{domain}</span>
              {p.failureReason && (
                <span style={{ fontSize: '0.72rem', color: '#f85149' }}>{p.failureReason}</span>
              )}
              {p.status === 'failed' && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); retry.mutate(p.id); }}
                  disabled={retry.isPending}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'flex-start',
                    padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                    background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.3)',
                    color: '#58a6ff', cursor: 'pointer',
                  }}
                >
                  {retry.isPending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />}
                  Retry
                </button>
              )}
            </div>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open original post"
              style={{ color: '#8b949e', flexShrink: 0, marginTop: '2px', display: 'flex' }}
            >
              <ExternalLink size={14} />
            </a>
            <FileText size={16} style={{ color: '#8b949e', flexShrink: 0, marginTop: '2px' }} />
          </Link>
        )
      })}
    </div>
  );
};
