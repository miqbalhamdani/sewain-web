/**
 * Checklist templates per vehicle type -- constants in code, not data
 * (PRD §6.5, docs/ideas/vehicle-attributes.md). Equipment rental has none yet:
 * the free-text condition note covers it.
 */
export type ChecklistItem = { key: string; label: string; options: string[] }

const BENSIN: ChecklistItem = { key: 'bensin', label: 'Bensin', options: ['Penuh', '3/4', '1/2', '1/4', 'Hampir habis'] }
const STNK: ChecklistItem = { key: 'stnk', label: 'STNK', options: ['Ada', 'Tidak ada'] }

export const CHECKLISTS: Record<string, ChecklistItem[]> = {
  car: [
    BENSIN,
    { key: 'ban_serep', label: 'Ban serep', options: ['Ada', 'Tidak ada'] },
    { key: 'dongkrak', label: 'Dongkrak', options: ['Ada', 'Tidak ada'] },
    STNK,
  ],
  motorcycle: [
    BENSIN,
    { key: 'helm', label: 'Helm', options: ['0', '1', '2'] },
    { key: 'jas_hujan', label: 'Jas hujan', options: ['0', '1', '2'] },
    STNK,
  ],
}
