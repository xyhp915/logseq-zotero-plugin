// src/hooks/useTableSort.ts
import { useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'

export default function useTableSort(
  items: any,
  initialKey: string | null = null,
  initialDir: SortDir = 'asc',
  accessors?: Record<string, (it: any) => any>,
) {
  const [sortKey, setSortKey] = useState<string | null>(initialKey)
  const [sortDir, setSortDir] = useState<SortDir>(initialDir)

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedItems = useMemo(() => {
    const list: any[] = items
      ? (Array.isArray(items) ? items.slice() : Array.from(items as any))
      : []

    if (!sortKey) return list

    const getValue = (it: any) => {
      if (accessors?.[sortKey]) return accessors[sortKey](it)

      switch (sortKey) {
        case 'title':
        case 'itemType':
          return String(it?.[sortKey] || '').toLowerCase()
        case 'dateModified': {
          const t = Date.parse(it?.dateModified || '')
          return Number.isNaN(t) ? 0 : t
        }
        case 'collections':
          return (it?.collections || []).map((c: any) => String(c)).join(',').toLowerCase()
        default: {
          const v = it?.[sortKey]
          return (v == null ? '' : String(v)).toLowerCase()
        }
      }
    }

    list.sort((a, b) => {
      const va = getValue(a)
      const vb = getValue(b)

      if (va === vb) return 0

      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va
      }

      // string comparison using localeCompare for consistent ordering
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va))
    })

    return list
  }, [items, sortKey, sortDir, accessors])

  return {
    sortedItems,
    sortKey,
    sortDir,
    toggleSort,
    setSortKey,
    setSortDir,
  }
}
