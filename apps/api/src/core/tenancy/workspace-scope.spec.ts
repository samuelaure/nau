import {
  isWorkspaceOwned,
  scopedWhere,
  scopedData,
  WORKSPACE_OWNED_MODELS,
} from './workspace-scope';

describe('workspace scoping', () => {
  describe('isWorkspaceOwned', () => {
    it('recognises the models that carry a workspace', () => {
      expect(isWorkspaceOwned('Block')).toBe(true);
      expect(isWorkspaceOwned('Tag')).toBe(true);
    });

    it('leaves models that are not workspace-owned alone', () => {
      // A User belongs to many workspaces; a Session belongs to a user. Scoping
      // these by workspace would be wrong, not merely unnecessary.
      expect(isWorkspaceOwned('User')).toBe(false);
      expect(isWorkspaceOwned('Session')).toBe(false);
      expect(isWorkspaceOwned('Workspace')).toBe(false);
      expect(isWorkspaceOwned(undefined)).toBe(false);
    });

    it('lists every scoped model exactly once', () => {
      expect(new Set(WORKSPACE_OWNED_MODELS).size).toBe(WORKSPACE_OWNED_MODELS.length);
    });
  });

  describe('scopedWhere', () => {
    it('scopes an absent filter', () => {
      expect(scopedWhere(undefined, 'ws-1')).toEqual({ workspaceId: 'ws-1' });
    });

    it('scopes an empty filter', () => {
      expect(scopedWhere({}, 'ws-1')).toEqual({ workspaceId: 'ws-1' });
    });

    it('preserves the original filter alongside the scope', () => {
      expect(scopedWhere({ type: 'example.thing' }, 'ws-1')).toEqual({
        AND: [{ type: 'example.thing' }, { workspaceId: 'ws-1' }],
      });
    });

    it('cannot be widened by a caller supplying another workspace', () => {
      // The caller's own workspaceId survives in the AND, but so does the
      // scope — so the query matches nothing rather than crossing the boundary.
      // This is the case that matters: a compromised or careless caller must
      // not be able to read another tenant by asking nicely.
      const result = scopedWhere({ workspaceId: 'ws-other' }, 'ws-1');
      expect(result).toEqual({
        AND: [{ workspaceId: 'ws-other' }, { workspaceId: 'ws-1' }],
      });
    });

    it('preserves an OR without letting it escape the scope', () => {
      const result = scopedWhere({ OR: [{ type: 'a' }, { type: 'b' }] }, 'ws-1');
      expect(result).toEqual({
        AND: [{ OR: [{ type: 'a' }, { type: 'b' }] }, { workspaceId: 'ws-1' }],
      });
    });
  });

  describe('scopedData', () => {
    it('stamps a single record', () => {
      expect(scopedData({ type: 'example.thing' }, 'ws-1')).toEqual({
        type: 'example.thing',
        workspaceId: 'ws-1',
      });
    });

    it('stamps every record of a bulk insert', () => {
      expect(scopedData([{ type: 'a' }, { type: 'b' }], 'ws-1')).toEqual([
        { type: 'a', workspaceId: 'ws-1' },
        { type: 'b', workspaceId: 'ws-1' },
      ]);
    });

    it('overrides a workspace the caller tried to set', () => {
      expect(scopedData({ workspaceId: 'ws-other' }, 'ws-1')).toEqual({ workspaceId: 'ws-1' });
    });
  });
});
