'use client'

import Link from 'next/link'
import { Video, Table, CheckCircle, Play, ExternalLink } from 'lucide-react'
import ActionMenu from '@/modules/shared/components/ActionMenu'
import { deleteTemplate, duplicateTemplate } from '@/modules/video/actions'
import type { TemplateWithRelations } from '@/types'

interface TemplateCardProps {
  template: TemplateWithRelations
  context?: 'templates' | 'account' // to determine back link behavior
}

export default function TemplateCard({ template, context = 'templates' }: TemplateCardProps) {
  // Construct the URL with a query param to know where we came from
  const detailsUrl = `/dashboard/templates/${template.id}?from=${context}`

  return (
    <div className="card" style={{ position: 'relative' }}>
      <ActionMenu
        onDelete={() => deleteTemplate(template.id)}
        onDuplicate={() => duplicateTemplate(template.id)}
      />

      <div
        style={{
          width: '100%',
          aspectRatio: '16/9',
          background: '#27272a',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Video size={40} style={{ opacity: 0.2 }} />

        {/* Full card clickable area to go to details */}
        <Link
          href={detailsUrl}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(0,0,0,0.6)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '600',
            zIndex: 2,
          }}
        >
          {template.remotionId}
        </div>
      </div>

      <Link href={detailsUrl} style={{ textDecoration: 'none', color: 'inherit' }}>
        <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>{template.name}</h3>
      </Link>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
          }}
        >
          <Table size={16} />
          <span>Table: {template.airtableTableId || 'Not linked'}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
          }}
        >
          <CheckCircle size={16} />
          <span>{template._count?.renders || 0} renders completed</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', zIndex: 2 }}>
          <Play size={16} />
          Run
        </button>
        <Link
          href={detailsUrl}
          style={{
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          <ExternalLink size={20} />
        </Link>
      </div>
    </div>
  )
}
