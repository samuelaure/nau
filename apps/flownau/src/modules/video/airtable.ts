import Airtable from 'airtable'

if (!process.env.AIRTABLE_TOKEN) {
  throw new Error('AIRTABLE_TOKEN is not defined')
}

Airtable.configure({
  apiKey: process.env.AIRTABLE_TOKEN,
})

export const base = Airtable.base(process.env.AIRTABLE_BASE_ID || '')

export async function getTableData(tableId: string) {
  const records = await base(tableId).select().all()
  return records.map((record) => ({
    id: record.id,
    ...record.fields,
  }))
}
