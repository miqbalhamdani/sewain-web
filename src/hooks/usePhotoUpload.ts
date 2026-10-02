'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from 'lib/api/client'
import type { components } from 'lib/api/schema'

type UploadKind = components['schemas']['UploadKind']
type ContentType = components['schemas']['PresignRequest']['content_type']

export type PhotoUpload = {
  id: string
  file: File
  /** Local object URL for the thumbnail -- shown before the upload finishes. */
  preview: string
  /** 0..1, from the PUT's own progress events. */
  progress: number
  status: 'uploading' | 'done' | 'error'
  /** The pending key to hand to the domain endpoint once done. */
  key?: string
}

const IMAGES: ContentType[] = ['image/jpeg', 'image/png', 'image/webp']
// A transfer proof may be a bank's PDF e-statement; a photo never is (S1-046).
const ALLOWED: Record<UploadKind, ContentType[]> = {
  handover_photo: IMAGES,
  identity_photo: IMAGES,
  payment_proof: [...IMAGES, 'application/pdf'],
}
const MAX_BYTES = 10 * 1024 * 1024

/**
 * Presign → PUT straight to object storage, one photo at a time in parallel
 * (BR-093). The bytes never touch the API.
 *
 * XMLHttpRequest, not fetch: fetch has no upload progress, and S1-037 asks for
 * the real progress of the PUT, not a spinner. Uploads run beside the form and
 * never block it -- the submit button only waits for the photos it sends.
 */
export function usePhotoUpload(kind: UploadKind) {
  const [photos, setPhotos] = useState<PhotoUpload[]>([])
  const xhrs = useRef(new Map<string, XMLHttpRequest>())

  const patch = useCallback((id: string, p: Partial<PhotoUpload>) => {
    setPhotos((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x)))
  }, [])

  const start = useCallback(
    async (photo: PhotoUpload) => {
      patch(photo.id, { status: 'uploading', progress: 0 })
      const type = photo.file.type as ContentType
      const { data, error } = await api.POST('/uploads/presign', {
        body: { kind, content_type: type, bytes: photo.file.size },
      })
      if (error || !data) return patch(photo.id, { status: 'error' })

      const xhr = new XMLHttpRequest()
      xhrs.current.set(photo.id, xhr)
      xhr.open('PUT', data.upload_url)
      Object.entries(data.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) patch(photo.id, { progress: e.loaded / e.total })
      }
      xhr.onload = () =>
        patch(photo.id, xhr.status < 300 ? { status: 'done', progress: 1, key: data.object_key } : { status: 'error' })
      xhr.onerror = () => patch(photo.id, { status: 'error' })
      xhr.send(photo.file)
    },
    [kind, patch],
  )

  /** Returns the files it refused (wrong type or over 10 MB) so the screen can say so. */
  const add = useCallback(
    (files: FileList | File[]): File[] => {
      const refused: File[] = []
      const fresh: PhotoUpload[] = []
      for (const file of Array.from(files)) {
        if (!ALLOWED[kind].includes(file.type as ContentType) || file.size > MAX_BYTES) {
          refused.push(file)
          continue
        }
        fresh.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), progress: 0, status: 'uploading' })
      }
      setPhotos((all) => [...all, ...fresh])
      fresh.forEach((p) => void start(p))
      return refused
    },
    [kind, start],
  )

  const retry = useCallback((id: string) => {
    setPhotos((all) => {
      const p = all.find((x) => x.id === id)
      if (p) void start(p)
      return all
    })
  }, [start])

  /** Only before the handover is saved -- after that, evidence is immutable (BR-037). */
  const remove = useCallback((id: string) => {
    xhrs.current.get(id)?.abort()
    setPhotos((all) => {
      const p = all.find((x) => x.id === id)
      if (p) URL.revokeObjectURL(p.preview)
      return all.filter((x) => x.id !== id)
    })
  }, [])

  useEffect(() => () => xhrs.current.forEach((x) => x.abort()), [])

  const keys = photos.filter((p) => p.status === 'done').map((p) => p.key!)
  const pending = photos.some((p) => p.status === 'uploading')
  return { photos, add, retry, remove, keys, pending }
}
