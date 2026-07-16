import type {
  HexForgeCollectionBoardItem,
  HexForgeCollectionProject
} from './hexForgeCollectionClient'

export const collectionCompletedStatuses = new Set(['PRINTED', 'POST_PROCESSING', 'COLLECTED'])

export const searchCollectionBoard = (items: HexForgeCollectionBoardItem[], query: string) => {
  const raw = query.trim()
  const lower = raw.toLowerCase()
  const studentNumber = raw.match(/\d{8}/)?.[0] || ''

  return items
    .filter((item) =>
      item.project_code.toLowerCase().includes(lower) ||
      (studentNumber ? item.student_number === studentNumber : item.student_number.includes(raw)) ||
      item.student_name.toLowerCase().includes(lower) ||
      (item.print_label || '').toLowerCase().includes(lower)
    )
    .sort((a, b) => (b.last_activity_at || '').localeCompare(a.last_activity_at || ''))
}

export const mergeCollectionBoardItems = (
  current: HexForgeCollectionBoardItem[],
  incoming: HexForgeCollectionBoardItem[]
) => {
  const byCode = new Map(current.map((item) => [item.project_code, item]))
  incoming.forEach((item) => byCode.set(item.project_code, item))
  return [...byCode.values()].sort((a, b) => (b.last_activity_at || '').localeCompare(a.last_activity_at || ''))
}

export const boardItemFromProject = (project: HexForgeCollectionProject): HexForgeCollectionBoardItem => {
  const completedParts = project.parts.filter((part) => collectionCompletedStatuses.has(part.print_status)).length
  const collectedParts = project.parts.filter((part) => part.print_status === 'COLLECTED').length
  const leadPart = [...project.parts].sort((a, b) => {
    const aWeight = Number(a.primary_estimated_weight || 0) + Number(a.secondary_estimated_weight || 0)
    const bWeight = Number(b.primary_estimated_weight || 0) + Number(b.secondary_estimated_weight || 0)
    return bWeight - aWeight || a.part_number - b.part_number
  })[0]
  const group = project.state === 'READY_FOR_COLLECTION' || project.state === 'PARTIALLY_COLLECTED'
    ? 'help_desk'
    : project.state === 'IN_PRODUCTION' && completedParts > 0
      ? 'partially_ready'
      : null
  const savedReceipt = project.collection?.receipt_number || project.payment.receipt_number

  return {
    project_code: project.project_code,
    student_name: project.collection?.student_name || 'Unavailable',
    student_number: project.collection?.student_number || '',
    state: project.state,
    group,
    print_label: project.collection?.print_label || null,
    total_parts: project.parts.length,
    completed_parts: completedParts,
    collected_parts: collectedParts,
    remaining_parts: Math.max(project.parts.length - collectedParts, 0),
    all_parts_completed: project.parts.length > 0 && completedParts === project.parts.length,
    thumbnail_url: leadPart?.thumbnail_url || null,
    thumbnail_part_name: leadPart?.part_name || null,
    thumbnail_weight: leadPart
      ? Number(leadPart.primary_estimated_weight || 0) + Number(leadPart.secondary_estimated_weight || 0)
      : 0,
    payment_outstanding: Boolean(project.payment.needs_payment && !project.payment.module_paid && !project.payment.override_applied && !savedReceipt?.trim()),
    last_activity_at: project.collection?.created_at || project.created_at || null
  }
}
