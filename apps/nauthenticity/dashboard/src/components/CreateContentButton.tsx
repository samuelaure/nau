import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Wand2 } from 'lucide-react';
import { dispatchSourceConcept } from '../lib/api';

interface CreateContentButtonProps {
  brandId: string;
  itemType: 'post' | 'profile' | 'voicenote' | 'youtube' | 'blog';
  itemId: string;
}

export const CreateContentButton = ({ brandId, itemType, itemId }: CreateContentButtonProps) => {
  const [done, setDone] = useState(false);
  const mutation = useMutation({
    mutationFn: () => dispatchSourceConcept(brandId, itemType, itemId),
    onSuccess: () => setDone(true),
  });
  return (
    <button
      onClick={() => !done && mutation.mutate()}
      disabled={mutation.isPending || done}
      title="Create content from this source"
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 600,
        borderRadius: '6px', cursor: done || mutation.isPending ? 'default' : 'pointer',
        border: `1px solid ${done ? 'rgba(63,185,80,0.4)' : 'rgba(210,153,34,0.4)'}`,
        background: done ? 'rgba(63,185,80,0.1)' : 'rgba(210,153,34,0.1)',
        color: done ? '#3fb950' : '#d29922',
        transition: 'opacity 0.15s',
        opacity: mutation.isPending ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      <Wand2 size={12} />
      {done ? 'Dispatched!' : mutation.isPending ? 'Dispatching…' : 'Create content'}
    </button>
  );
};
