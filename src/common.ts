import { v5 } from 'uuid'

export const isInLogseq = location.href.includes('v=lsp')

const NAMESPACE_UUID = 'b83c1a7b-50ab-4cd1-b80f-39f5ef6f9dea'

export function id2UUID(id: string): string {
  return v5(id, NAMESPACE_UUID)
}

export function closeMainDialog() {
  logseq?.hideMainUI()
}

export function delay(ms: number = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms))
}