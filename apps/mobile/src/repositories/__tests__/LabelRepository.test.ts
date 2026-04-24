/**
 * LabelRepository unit tests.
 *
 * LabelRepository manages CRUD for labels and keeps post.tags (a JSON array
 * stored as a string) in sync when a label is renamed or deleted.
 *
 * The SQLite helpers (executeSql, runSql) are mocked — no real database file
 * is created. This lets us verify the query logic and tag synchronisation
 * without needing an Expo environment or a physical device.
 *
 * Key behaviours under test:
 *   - getAllLabels: simple SELECT ordered by name COLLATE NOCASE
 *   - createLabel: trims whitespace before insert
 *   - updateLabel: renames the label AND updates affected posts' tags JSON
 *   - deleteLabel: deletes the label AND removes the tag from affected posts
 */

// Mock the db module before importing the repository
jest.mock('../../db', () => ({
  executeSql: jest.fn(),
  runSql: jest.fn().mockResolvedValue(1),
}))

import * as db from '../../db'
import {
  getAllLabels,
  createLabel,
  updateLabel,
  deleteLabel,
} from '../LabelRepository'

const execSql = db.executeSql as jest.Mock
const runSql = db.runSql as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getAllLabels', () => {
  it('queries all labels ordered case-insensitively', async () => {
    execSql.mockResolvedValue([{ id: 1, name: 'Alpha', createdAt: '2024-01-01' }])
    const result = await getAllLabels()
    expect(execSql).toHaveBeenCalledWith(
      'SELECT * FROM labels ORDER BY name COLLATE NOCASE ASC',
    )
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alpha')
  })
})

describe('createLabel', () => {
  it('inserts a trimmed label name', async () => {
    runSql.mockResolvedValue(42)
    const id = await createLabel('  My Label  ')
    expect(runSql).toHaveBeenCalledWith('INSERT INTO labels (name) VALUES (?)', ['My Label'])
    expect(id).toBe(42)
  })
})

describe('updateLabel', () => {
  it('does nothing when label does not exist', async () => {
    execSql.mockResolvedValueOnce([]) // label lookup returns empty
    await updateLabel(99, 'New Name')
    expect(runSql).not.toHaveBeenCalled()
  })

  it('renames the label and updates tags in affected posts', async () => {
    // First call: fetch old label name
    execSql.mockResolvedValueOnce([{ name: 'OldName' }])
    // Second call: fetch posts containing OldName in their tags
    execSql.mockResolvedValueOnce([
      { id: 1, tags: JSON.stringify(['OldName', 'Other']) },
      { id: 2, tags: JSON.stringify(['OldName']) },
    ])

    await updateLabel(1, 'NewName')

    // UPDATE labels
    expect(runSql).toHaveBeenCalledWith('UPDATE labels SET name = ? WHERE id = ?', ['NewName', 1])
    // UPDATE post 1 tags
    expect(runSql).toHaveBeenCalledWith('UPDATE posts SET tags = ? WHERE id = ?', [
      JSON.stringify(['NewName', 'Other']),
      1,
    ])
    // UPDATE post 2 tags
    expect(runSql).toHaveBeenCalledWith('UPDATE posts SET tags = ? WHERE id = ?', [
      JSON.stringify(['NewName']),
      2,
    ])
  })
})

describe('deleteLabel', () => {
  it('does nothing when label does not exist', async () => {
    execSql.mockResolvedValueOnce([])
    await deleteLabel(99)
    expect(runSql).not.toHaveBeenCalled()
  })

  it('deletes the label and removes tag from affected posts', async () => {
    execSql.mockResolvedValueOnce([{ name: 'ToDelete' }])
    execSql.mockResolvedValueOnce([
      { id: 5, tags: JSON.stringify(['ToDelete', 'Keep']) },
    ])

    await deleteLabel(1)

    expect(runSql).toHaveBeenCalledWith('DELETE FROM labels WHERE id = ?', [1])
    expect(runSql).toHaveBeenCalledWith('UPDATE posts SET tags = ? WHERE id = ?', [
      JSON.stringify(['Keep']),
      5,
    ])
  })
})
