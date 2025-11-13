import { v5 } from 'uuid'
import { appState, type ZoteroItemEntity } from './store.ts'
import type { Immutable } from '@hookstate/core'

export const isInLogseq = location.href.includes('v=lsp')

const NAMESPACE_UUID = 'b83c1a7b-50ab-4cd1-b80f-39f5ef6f9dea'

export function id2UUID(id: string): string {
  return v5(id, NAMESPACE_UUID)
}

export function closeMainDialog() {
  if (appState.isPushing.get()) return
  logseq?.hideMainUI()
}

export function delay(ms: number = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function removeHtmlTags(str: string): string {
  if (!str) return str
  return str.replace(/<[^>]*>/g, '')
}

export function truncateString(str: string, maxLength: number = 64): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}

export function getItemTitle(
  item: Immutable<ZoteroItemEntity>
) {
  let title = item.title || item.caseName || item.note || 'Untitled'
  title = removeHtmlTags(title)
  title = truncateString(title, 100)
  return title
}