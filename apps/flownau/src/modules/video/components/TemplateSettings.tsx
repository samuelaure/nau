'use client'

import { useState, useTransition } from 'react'
import { toggleTemplateAssets } from '@/modules/video/actions'
import { updateTemplate, duplicateTemplate } from '@/modules/video/actions'
import { Info, Lock, Copy } from 'lucide-react'

interface TemplateWithCount {
  id: string
  name: string
  remotionId: string
  airtableTableId?: string | null
  accountId?: string | null
  useAccountAssets: boolean
  _count?: {
    assets: number
  }
}

interface Account {
  id: string
  username: string
  platform: string
}

export default function TemplateSettings({
  template,
  accounts = [],
}: {
  template: TemplateWithCount
  accounts?: Account[]
}) {
  const [isPending, startTransition] = useTransition()

  // Logic: If no assets, forced to true
  const hasAssets = (template._count?.assets ?? 0) > 0
  const isForced = !hasAssets

  const handleToggle = () => {
    if (isForced) return
    startTransition(() => {
      toggleTemplateAssets(template.id, !template.useAccountAssets)
    })
  }

  const handleDuplicate = () => {
    if (!confirm('Are you sure you want to duplicate this template?')) return
    startTransition(async () => {
      await duplicateTemplate(template.id)
    })
  }

  const handleUpdate = (formData: FormData) => {
    startTransition(async () => {
      await updateTemplate(template.id, formData)
    })
  }

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '32px' }}
    >
      {/* General Settings */}
      <div className="card" style={{ padding: '32px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ fontSize: '20px' }}>General Settings</h3>
          <button
            onClick={handleDuplicate}
            disabled={isPending}
            className="btn-secondary"
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Copy size={14} /> Duplicate
          </button>
        </div>

        <form
          action={handleUpdate}
          style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
        >
          <div className="form-group">
            <label className="form-label">Template Name</label>
            <input name="name" defaultValue={template.name} className="input-field" required />
          </div>
          <div className="form-group">
            <label className="form-label">Remotion Composition ID</label>
            <input
              name="remotionId"
              defaultValue={template.remotionId}
              className="input-field"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Airtable Table ID</label>
            <input
              name="airtableTableId"
              defaultValue={template.airtableTableId || ''}
              className="input-field"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Linked Account</label>
            <select
              name="accountId"
              defaultValue={template.accountId || ''}
              className="input-field"
            >
              <option value="">No linked account (Global)</option>
              {accounts?.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.username} ({acc.platform})
                </option>
              ))}
            </select>
            <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Relocating this template to another account will affect asset inheritance.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Asset Configuration */}
      <div className="card" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '20px', marginBottom: '24px' }}>Asset Configuration</h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '16px', fontWeight: '500' }}>Use Account Assets</span>
              {isForced && (
                <span
                  style={{
                    fontSize: '10px',
                    background: 'rgba(255,255,255,0.1)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Lock size={10} /> Enforced
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px' }}>
              If enabled, this template will have access to the parent Account&apos;s asset library.
              Disable this to strictly use only assets uploaded directly to this template.
            </p>
            {!hasAssets && (
              <p
                style={{
                  color: 'var(--accent-color)',
                  fontSize: '12px',
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Info size={14} />
                Upload template-specific assets to unlock this setting.
              </p>
            )}
          </div>

          <button
            onClick={handleToggle}
            disabled={isForced || isPending}
            style={{
              width: '48px',
              height: '24px',
              background:
                isForced || template.useAccountAssets ? 'var(--success)' : 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              position: 'relative',
              border: 'none',
              cursor: isForced || isPending ? 'not-allowed' : 'pointer',
              opacity: isForced || isPending ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                background: 'white',
                borderRadius: '50%',
                position: 'absolute',
                top: '2px',
                left: isForced || template.useAccountAssets ? '26px' : '2px',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
