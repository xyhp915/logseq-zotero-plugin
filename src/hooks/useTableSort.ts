// src/hooks/useTableSort.ts
import { useMemo } from 'react'
import { hookstate, useHookstate } from '@hookstate/core'

export type SortDir = 'asc' | 'desc'

export default function useTableSort(
  items: any,
  initialKey: string | null = null,
  initialDir: SortDir = 'asc',
  accessors?: Record<string, (it: any) => any>,
) {
  const sortKey = useHookstate<string | null>(initialKey)
  const sortDir = useHookstate<SortDir>(initialDir)

  const toggleSort = (key: string) => {
    if (sortKey.get() === key) {
      sortDir.set(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      sortKey.set(key)
      sortDir.set('asc')
    }
  }

  const sortedItems = useMemo(() => {
    const list: any[] = items
      ? (Array.isArray(items) ? items.slice() : Array.from(items as any))
      : []

    const currentSortKey = sortKey.get()
    if (!currentSortKey) return list

    const getValue = (it: any) => {
      if (accessors?.[currentSortKey]) return accessors[currentSortKey](it)

      switch (currentSortKey) {
        case 'title':
        case 'itemType':
          return String(it?.[currentSortKey] || '').toLowerCase()
        case 'dateModified': {
          const t = Date.parse(it?.dateModified || '')
          return Number.isNaN(t) ? 0 : t
        }
        case 'collections':
          return (it?.collections || []).map((c: any) => String(c)).join(',').toLowerCase()
        default: {
          const v = it?.[currentSortKey]
          return (v == null ? '' : String(v)).toLowerCase()
        }
      }
    }

    const currentSortDir = sortDir.get()
    list.sort((a, b) => {
      const va = getValue(a)
      const vb = getValue(b)

      if (va === vb) return 0

      if (typeof va === 'number' && typeof vb === 'number') {
        return currentSortDir === 'asc' ? va - vb : vb - va
      }

      return currentSortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va))
    })

    return list
  }, [items, sortKey.get(), sortDir.get(), accessors])

  return {
    sortedItems,
    sortKey: sortKey.get(),
    sortDir: sortDir.get(),
    toggleSort,
    setSortKey: sortKey.set,
    setSortDir: sortDir.set,
  }
}
