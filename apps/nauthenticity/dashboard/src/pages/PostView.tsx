import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { getPost, updatePost, getPostSourceConcepts, getMediaUrl } from '../lib/api';
import { ArrowLeft, ArrowRight, MessageCircle, Heart, Eye, Calendar, ChevronDown, ChevronRight, ScrollText } from 'lucide-react';
import { MediaCarousel } from '../components/MediaCarousel';
import { PromptsModal } from '../components/PromptsModal';

// ── Inline editable field ─────────────────────────────────────────────────────

interface EditableFieldProps {
  value: string
  onSave: (val: string) => void
  multiline?: boolean
  placeholder?: string
  saving?: boolean
}

const EditableField = ({ value, onSave, multiline = false, placeholder = '—', saving }: EditableFieldProps) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setDraft(value); setEditing(false) }
    if (!multiline && e.key === 'Enter') { e.preventDefault(); commit() }
    if (multiline && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
  }

  if (editing) {
    const shared = {
      ref,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: handleKeyDown,
      style: {
        width: '100%',
        background: 'rgba(88,166,255,0.06)',
        color: '#f0f6fc',
        padding: '0.65rem 0.75rem',
        borderRadius: '6px',
        border: '1px solid #58a6ff',
        fontSize: '0.875rem',
        lineHeight: '1.6',
        resize: 'vertical' as const,
        outline: 'none',
        boxSizing: 'border-box' as const,
      },
    }
    return multiline
      ? <textarea {...shared} rows={6} />
      : <input {...shared} type="text" />
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Click to edit"
      style={{
        whiteSpace: 'pre-wrap',
        color: value ? '#c9d1d9' : '#6e7681',
        lineHeight: '1.65',
        fontSize: '0.875rem',
        cursor: 'text',
        padding: '0.65rem 0.75rem',
        borderRadius: '6px',
        border: '1px solid transparent',
        transition: 'border-color 0.15s, background 0.15s',
        maxHeight: '260px',
        overflowY: 'auto',
        opacity: saving ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {value || placeholder}
    </div>
  )
}

// ── Section with collapse toggle ──────────────────────────────────────────────

const Section = ({ label, tag, children, defaultOpen = true }: { label: string; tag?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#8b949e', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: open ? '0.6rem' : 0, width: '100%' }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {label}
        {tag && <span style={{ marginLeft: 'auto' }}>{tag}</span>}
      </button>
      {open && children}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export const PostView = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const backTo: string | null = (location.state as any)?.backTo ?? null;
  const queryClient = useQueryClient();
  const [showPrompts, setShowPrompts] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: () => getPost(id!),
  });

  const { data: concepts } = useQuery({
    queryKey: ['post-source-concepts', id],
    queryFn: () => getPostSourceConcepts(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updatePost>[1]) => updatePost(id!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['post', id] }),
  });

  const save = (field: 'caption' | 'transcriptText' | 'postSynthesis') => (val: string) =>
    updateMutation.mutate({ [field]: val });

  if (isLoading) return <div>Loading...</div>;
  if (!post) return <div>Post not found</div>;

  const saving = updateMutation.isPending;
  const transcript = post.transcripts?.[0]?.text ?? '';

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Nav bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={() => backTo ? navigate(backTo) : navigate(-1)}
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, fontSize: '0.9rem' }}
        >
          <ArrowLeft size={16} /> Back to Posts
        </button>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {post.newerPostId && (
            <Link to={`/posts/${post.newerPostId}`} className="nav-arrow" title="Previous Post (Newer)">
              <ArrowLeft size={24} />
            </Link>
          )}
          {post.olderPostId && (
            <Link to={`/posts/${post.olderPostId}`} className="nav-arrow" title="Next Post (Older)">
              <ArrowRight size={24} />
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left: Media */}
        <div style={{ background: '#111', borderRadius: '12px', overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {post.media && post.media.length > 0
            ? <MediaCarousel media={post.media} />
            : <div style={{ padding: '2rem', color: '#666' }}>No media available</div>
          }
        </div>

        {/* Right: Data */}
        <div>
          {/* Date + stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            <Calendar size={14} /> {new Date(post.postedAt).toLocaleDateString()}
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--bg-card)', borderRadius: '8px', fontSize: '0.875rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Heart size={14} className="accent-text" /> <strong>{post.likes.toLocaleString()}</strong></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><MessageCircle size={14} className="accent-text" /> <strong>{post.comments.toLocaleString()}</strong></span>
            {post.views && <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Eye size={14} className="accent-text" /> <strong>{post.views.toLocaleString()}</strong></span>}
          </div>

          {/* Collaborators */}
          {post.collaborators && post.collaborators.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Collab:</span>
              {post.collaborators.map((c, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {c.profilePicUrl && <img src={getMediaUrl(c.profilePicUrl)} alt={c.username} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />}
                  <a href={`https://instagram.com/${c.username}`} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>@{c.username}</a>
                </div>
              ))}
            </div>
          )}

          {/* Synthesis */}
          <Section
            label="Synthesis"
            tag={post.synthesisTrace && (
              <button
                onClick={() => setShowPrompts(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#6e7681', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <ScrollText size={12} /> Prompts
              </button>
            )}
          >
            <EditableField
              value={post.postSynthesis ?? ''}
              onSave={save('postSynthesis')}
              multiline
              placeholder="No synthesis yet — click to add one manually"
              saving={saving}
            />
          </Section>

          {/* Source Concepts */}
          {concepts && concepts.length > 0 && (
            <Section label="Source Concepts" defaultOpen={false}
              tag={<span style={{ fontSize: '0.72rem', background: 'rgba(210,153,34,0.15)', color: '#d29922', padding: '1px 7px', borderRadius: '100px', border: '1px solid #d2992244' }}>{concepts.length}</span>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {concepts.map((c) => (
                  <div key={c.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.65rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#c9d1d9', lineHeight: 1.6 }}>{c.content}</p>
                    <span style={{ fontSize: '0.68rem', color: c.status === 'consumed' ? '#3fb950' : '#d29922' }}>{c.status}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Caption */}
          <Section label="Caption">
            <EditableField
              value={post.caption ?? ''}
              onSave={save('caption')}
              multiline
              placeholder="No caption"
              saving={saving}
            />
          </Section>

          {/* Transcript */}
          <Section label="Transcript" defaultOpen={!!transcript}
            tag={transcript ? <span className="tag" style={{ fontSize: '0.68rem' }}>AI Generated</span> : undefined}
          >
            <EditableField
              value={transcript}
              onSave={save('transcriptText')}
              multiline
              placeholder="No transcript available for this post"
              saving={saving}
            />
          </Section>

          <div style={{ marginTop: '1.25rem' }}>
            <a href={post.instagramUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem' }}>
              View on Instagram →
            </a>
          </div>
        </div>
      </div>

      {showPrompts && post.synthesisTrace && (
        <PromptsModal
          title={`@${post.username ?? 'post'} · synthesis`}
          trace={post.synthesisTrace as any}
          onClose={() => setShowPrompts(false)}
        />
      )}
    </div>
  );
};
