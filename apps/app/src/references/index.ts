/**
 * DRAFT — References has no confirmed nav/route yet in `app`.
 *
 * `components/notes/` (NoteCard, note-input) still targets the old
 * `use-blocks-api.ts` and has not been migrated onto `use-notes.ts`
 * (NoteCard's own edit/delete calls already use `use-notes.ts` directly —
 * its data still arrives as a `Block` via the bridge, is the gap left).
 * That migration is its own piece of work, not bundled into
 * this draft — see the tracking issue this file's directory was opened
 * for. No `ModuleDescriptor` is exported here yet because there is nothing
 * real to register: a descriptor pointing at unmigrated components would be
 * a registry entry, not a face.
 */

export {
  useGetNotes,
  useGetNote,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  type Note,
  type Attachment,
  type AttachmentKind,
  type CreateNoteInput,
  type UpdateNoteInput,
} from './use-notes'
