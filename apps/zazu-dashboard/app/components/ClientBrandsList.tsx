'use client';

import { useEffect, useState } from 'react';
import { useTelegram } from '../components/TelegramProvider';
import {
  Plus,
  Settings2,
  Trash2,
  Globe,
  ShieldCheck,
  Zap,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Brain,
  MessageSquare,
  Clock,
  Hash,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import {
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  addBrandTargets,
  updateBrandTarget,
  removeBrandTarget,
  type Brand,
  type BrandTarget,
  type BrandCreatePayload,
} from '../lib/actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIMEZONES = [
  'UTC', 'Europe/Madrid', 'Europe/London', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Mexico_City', 'America/Bogota', 'America/Lima',
  'America/Santiago', 'America/Sao_Paulo', 'America/Buenos_Aires',
];

const labelStyle = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 700,
  color: 'var(--text-dim)',
  marginBottom: '6px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '14px',
};

// ---------------------------------------------------------------------------
// Sub-view: Brand Form (create or edit)
// ---------------------------------------------------------------------------

interface BrandFormProps {
  initial?: Brand | null;
  workspaces?: any[];
  onSave: () => void;
  onCancel: () => void;
}

function BrandForm({ initial, workspaces = [], onSave, onCancel }: BrandFormProps) {
  const [workspaceId, setWorkspaceId] = useState(initial?.workspaceId ?? (workspaces[0]?.id ?? ''));
  const [name, setName] = useState(initial?.brandName ?? '');
  const [voicePrompt, setVoicePrompt] = useState(initial?.voicePrompt ?? '');
  const [commentStrategy, setCommentStrategy] = useState(initial?.commentStrategy ?? '');
  const [suggestionsCount, setSuggestionsCount] = useState(initial?.suggestionsCount ?? 3);
  const [windowStart, setWindowStart] = useState(initial?.windowStart ?? '');
  const [windowEnd, setWindowEnd] = useState(initial?.windowEnd ?? '');
  const [timezone, setTimezone] = useState(initial?.timezone ?? 'UTC');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(!!initial);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('El nombre de la marca es obligatorio.');
      return;
    }
    setIsLoading(true);
    setError('');

    const payload: BrandCreatePayload = {
      brandName: name.trim(),
      voicePrompt: voicePrompt.trim() || undefined,
      commentStrategy: commentStrategy.trim() || null,
      suggestionsCount,
      windowStart: windowStart || null,
      windowEnd: windowEnd || null,
      timezone,
      isActive: true,
    };

    let res;
    if (initial) {
      res = await updateBrand(initial.id, { ...payload, workspaceId });
    } else {
      if (!workspaceId) {
        setError('Debes seleccionar un espacio de trabajo.');
        setIsLoading(false);
        return;
      }
      res = await createBrand({ ...payload, workspaceId });
    }

    if (res.success) {
      onSave();
    } else {
      setError(res.error ?? 'Error desconocido.');
    }
    setIsLoading(false);
  };

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', border: '1px solid var(--primary)' }}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Brain size={20} color="var(--primary)" />
        {initial ? `Editar: ${initial.brandName}` : 'Nueva Marca'}
      </h2>

      <div style={sectionStyle}>
        {/* Workspace Selector — only on create */}
        {!initial && workspaces.length > 1 && (
          <div>
            <label style={labelStyle}>Espacio de Trabajo</label>
            <select
              className="input-field"
              value={workspaceId}
              onChange={e => setWorkspaceId(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Name — always visible */}
        <div>
          <label style={labelStyle}>Nombre de la marca *</label>
          <input className="input-field" placeholder="Ej: Samuel Aure Personal" value={name} onChange={e => setName(e.target.value)} />
        </div>

        {/* Advanced toggle */}
        {!initial && (
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ChevronDown size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            {showAdvanced ? 'Ocultar configuración avanzada' : 'Configuración avanzada (opcional)'}
          </button>
        )}

        {/* Advanced fields */}
        {showAdvanced && (
          <>
            {/* Voice Prompt */}
            <div>
              <label style={labelStyle}>
                <Brain size={11} style={{ display: 'inline', marginRight: '4px' }} />
                Brand DNA — Voz &amp; Personalidad
              </label>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                Define el tono, personalidad y forma de expresarse de esta marca. Si lo dejas vacío, se usará una voz genérica de plataforma.
              </p>
              <textarea
                className="input-field"
                style={{ minHeight: '130px', resize: 'vertical' }}
                placeholder="Ej: Eres una marca enfocada en emprendimiento digital. Tono auténtico, cercano y motivador. Usas emojis con moderación. Evitas el lenguaje corporativo..."
                value={voicePrompt}
                onChange={e => setVoicePrompt(e.target.value)}
              />
            </div>

            {/* Comment Strategy */}
            <div>
              <label style={labelStyle}>
                <MessageSquare size={11} style={{ display: 'inline', marginRight: '4px' }} />
                Estrategia de Comentarios (período actual)
              </label>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                ¿Cuál es la intención general de los comentarios en este período? (crear autoridad, ganar alcance, generar curiosidad...)
              </p>
              <textarea
                className="input-field"
                style={{ minHeight: '90px', resize: 'vertical' }}
                placeholder="Ej: Queremos ganar presencia y autoridad en la comunidad de fitness. Comentarios que aporten valor y generen curiosidad hacia nuestro perfil."
                value={commentStrategy}
                onChange={e => setCommentStrategy(e.target.value)}
              />
            </div>

            {/* Suggestions Count */}
            <div>
              <label style={labelStyle}>
                <Hash size={11} style={{ display: 'inline', marginRight: '4px' }} />
                Sugerencias por post
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={suggestionsCount}
                  onChange={e => setSuggestionsCount(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--primary)' }}
                />
                <span style={{
                  minWidth: '36px',
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  color: 'var(--primary)',
                }}>
                  {suggestionsCount}
                </span>
              </div>
            </div>

            {/* Delivery Window */}
            <div>
              <label style={labelStyle}>
                <Clock size={11} style={{ display: 'inline', marginRight: '4px' }} />
                Ventana de actividad
              </label>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                Dentro de esta ventana, los perfiles se monitorean cada 15 min. Fuera, cada hora.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Inicio</label>
                  <input
                    type="time"
                    className="input-field"
                    value={windowStart}
                    onChange={e => setWindowStart(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Fin</label>
                  <input
                    type="time"
                    className="input-field"
                    value={windowEnd}
                    onChange={e => setWindowEnd(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Zona horaria</label>
                <select
                  className="input-field"
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {error && (
          <p style={{ color: '#ff4444', fontSize: '0.8rem', background: 'rgba(255,68,68,0.1)', padding: '10px', borderRadius: '8px' }}>
            ⚠️ {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            className="btn-primary"
            style={{ flex: 1, opacity: isLoading ? 0.6 : 1 }}
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Guardando...' : initial ? 'Actualizar Marca' : 'Crear Marca'}
          </button>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text)', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-view: Target detail with profileStrategy editing
// ---------------------------------------------------------------------------

interface TargetItemProps {
  target: BrandTarget;
  brandId: string;
  onRemove: () => void;
  onUpdate: () => void;
}

function TargetItem({ target, brandId, onRemove, onUpdate }: TargetItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [strategy, setStrategy] = useState(target.profileStrategy ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveStrategy = async () => {
    setIsSaving(true);
    await updateBrandTarget(brandId, target.username, strategy || null);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdate();
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '10px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', flex: 1, textAlign: 'left' }}
        >
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>@{target.username}</span>
          {target.profileStrategy && (
            <span style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
              estrategia
            </span>
          )}
          <ChevronDown size={14} color="var(--text-dim)" style={{ marginLeft: 'auto', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        <button
          onClick={onRemove}
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,68,68,0.5)', cursor: 'pointer', marginLeft: '8px', padding: '4px' }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {isExpanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <label style={{ ...labelStyle, marginTop: '12px' }}>
            <Edit3 size={10} style={{ display: 'inline', marginRight: '4px' }} />
            Estrategia específica para @{target.username}
          </label>
          <textarea
            className="input-field"
            style={{ minHeight: '80px', resize: 'vertical', fontSize: '0.85rem' }}
            placeholder="Ej: El objetivo es captar la atención del autor. Cada 3-4 comentarios, mencionar sutilmente interés en colaborar..."
            value={strategy}
            onChange={e => setStrategy(e.target.value)}
          />
          <button
            className="btn-primary"
            style={{ marginTop: '10px', padding: '8px 18px', fontSize: '0.8rem', opacity: isSaving ? 0.6 : 1 }}
            onClick={handleSaveStrategy}
            disabled={isSaving}
          >
            {saved ? <><Check size={14} style={{ display: 'inline' }} /> Guardado</> : isSaving ? 'Guardando...' : 'Guardar estrategia'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-view: Brand Detail (targets + add new)
// ---------------------------------------------------------------------------

interface BrandDetailProps {
  brand: Brand;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

function BrandDetail({ brand, onClose, onEdit, onDelete, onRefresh }: BrandDetailProps) {
  const [newTarget, setNewTarget] = useState('');
  const [newTargetStrategy, setNewTargetStrategy] = useState('');
  const [isAddingTarget, setIsAddingTarget] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddTarget = async () => {
    if (!newTarget.trim()) return;
    await addBrandTargets({
      brandId: brand.id,
      usernames: [newTarget.trim().replace('@', '')],
      profileStrategy: newTargetStrategy.trim() || null,
    });
    onRefresh();
    setNewTarget('');
    setNewTargetStrategy('');
    setIsAddingTarget(false);
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar marca "${brand.brandName}" y todos sus perfiles monitoreados?`)) return;
    setIsDeleting(true);
    await deleteBrand(brand.id, brand.workspaceId!);
    onDelete();
  };

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', border: '1px solid var(--secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Settings2 size={20} /> {brand.brandName}
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {brand.suggestionsCount} sugerencias · {brand.windowStart && brand.windowEnd ? `${brand.windowStart}–${brand.windowEnd} (${brand.timezone})` : 'Sin ventana configurada'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onEdit}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', color: 'var(--text)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
          >
            Editar
          </button>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Monitored profiles section */}
      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label style={labelStyle}>Perfiles monitoreados</label>
          <button
            onClick={() => setIsAddingTarget(!isAddingTarget)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,255,136,0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}
          >
            <Plus size={12} /> Añadir
          </button>
        </div>

        {isAddingTarget && (
          <div style={{ marginBottom: '16px', padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Usuario de Instagram</label>
              <input
                className="input-field"
                placeholder="username (sin @)"
                value={newTarget}
                onChange={e => setNewTarget(e.target.value)}
                style={{ padding: '10px 14px' }}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Estrategia para este perfil (opcional)</label>
              <textarea
                className="input-field"
                style={{ minHeight: '70px', resize: 'none', fontSize: '0.82rem' }}
                placeholder="Ej: Objetivo: captar audiencia del autor. Comentarios que generen curiosidad y ganas de visitarnos..."
                value={newTargetStrategy}
                onChange={e => setNewTargetStrategy(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" style={{ flex: 1, padding: '10px' }} onClick={handleAddTarget}>
                <Plus size={16} style={{ display: 'inline', marginRight: '4px' }} /> Añadir perfil
              </button>
              <button onClick={() => setIsAddingTarget(false)} style={{ background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {brand.targets?.map((t: BrandTarget) => (
            <TargetItem
              key={t.username}
              target={t}
              brandId={brand.id}
              onRemove={async () => {
                await removeBrandTarget(brand.id, t.username);
                onRefresh();
              }}
              onUpdate={onRefresh}
            />
          ))}
          {(!brand.targets || brand.targets.length === 0) && (
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-dim)', padding: '10px' }}>
              No hay perfiles monitoreados. Añade tu primero.
            </p>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ marginTop: '20px', textAlign: 'right' }}>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          style={{ background: 'transparent', border: '1px solid rgba(255,68,68,0.3)', color: 'rgba(255,68,68,0.7)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
        >
          <Trash2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
          {isDeleting ? 'Eliminando...' : 'Eliminar marca'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ClientBrandsList({ initialBrands }: { initialBrands: Brand[] }) {
  const { isReady } = useTelegram();
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail'>('list');
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  const loadWorkspaces = async () => {
    const ws = await getWorkspaces();
    setWorkspaces(ws);
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const refresh = async () => {
    const updated = await getBrands();
    setBrands(updated);
    if (selectedBrand) {
      const refreshed = updated.find(b => b.id === selectedBrand.id);
      setSelectedBrand(refreshed ?? null);
    }
  };

  useEffect(() => {
    if (isReady && typeof window !== 'undefined') {
      const WebApp = require('@twa-dev/sdk').default;
      WebApp.MainButton.setText('NUEVA MARCA');
      if (view === 'list') {
        WebApp.MainButton.show();
        WebApp.MainButton.onClick(() => setView('create'));
      } else {
        WebApp.MainButton.hide();
      }
      return () => { WebApp.MainButton.hide(); };
    }
  }, [isReady, view]);

  if (!isReady) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Zap className="glow-text animate-pulse" size={48} color="var(--primary)" />
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '32px' }}>
        {view !== 'list' && (
          <button
            onClick={() => { setView('list'); setSelectedBrand(null); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}
          >
            <ArrowLeft size={14} /> Volver
          </button>
        )}
        {view === 'list' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' }}>Mis Marcas</h1>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Gestiona el ADN y los perfiles de tus identidades.</p>
            </div>
            <div style={{ background: 'rgba(0, 255, 136, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
              <Globe size={24} />
            </div>
          </div>
        )}
      </header>

      {/* Create form */}
      {view === 'create' && (
        <BrandForm
          workspaces={workspaces}
          onSave={async () => { await refresh(); setView('list'); }}
          onCancel={() => setView('list')}
        />
      )}

      {/* Edit form */}
      {view === 'edit' && selectedBrand && (
        <BrandForm
          initial={selectedBrand}
          workspaces={workspaces}
          onSave={async () => { await refresh(); setView('detail'); }}
          onCancel={() => setView('detail')}
        />
      )}

      {/* Brand detail */}
      {view === 'detail' && selectedBrand && (
        <BrandDetail
          brand={selectedBrand}
          onClose={() => { setView('list'); setSelectedBrand(null); }}
          onEdit={() => setView('edit')}
          onDelete={async () => { await refresh(); setView('list'); setSelectedBrand(null); }}
          onRefresh={refresh}
        />
      )}

      {/* Brands list */}
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {brands.map(brand => (
            <div
              key={brand.id}
              onClick={() => { setSelectedBrand(brand); setView('detail'); }}
              className="glass-card"
              style={{
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderLeft: brand.isActive ? '4px solid var(--primary)' : '4px solid var(--text-dim)',
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateX(4px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 6px' }}>
                    {brand.brandName}
                    {brand.isActive && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)', flexShrink: 0 }} />}
                  </h3>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', fontStyle: 'italic', margin: '0 0 12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                    "{brand.voicePrompt}"
                  </p>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                      <ShieldCheck size={13} color="var(--primary)" /> {brand.targets?.length ?? 0} perfiles
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                      <Hash size={13} color="var(--secondary)" /> {brand.suggestionsCount} sugerencias
                    </span>
                    {brand.windowStart && brand.windowEnd && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        <Clock size={13} color="#818cf8" /> {brand.windowStart}–{brand.windowEnd}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={20} color="var(--text-dim)" style={{ marginLeft: '12px', flexShrink: 0 }} />
              </div>
            </div>
          ))}

          {brands.length === 0 && (
            <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center' }}>
              <Brain size={48} color="var(--primary)" style={{ margin: '0 auto 20px', opacity: 0.3 }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>No hay marcas</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Pulsa el botón de abajo para configurar tu primera identidad.</p>
              <button className="btn-primary" style={{ marginTop: '24px' }} onClick={() => setView('create')}>
                Crear Primera Marca
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}
