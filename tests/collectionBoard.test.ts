import assert from 'node:assert/strict'
import test from 'node:test'
import {
  boardItemFromProject,
  collectionCompletedStatuses,
  mergeCollectionBoardItems,
  searchCollectionBoard
} from '../src/lib/collectionBoard.ts'
import type { HexForgeCollectionProject } from '../src/lib/hexForgeCollectionClient.ts'

const baseProject: HexForgeCollectionProject = {
  project_code: 'ABCDE',
  priority_number: 110,
  collection_code: null,
  state: 'IN_PRODUCTION',
  state_label: 'In production',
  state_description: '',
  created_at: '2026-07-01T00:00:00.000Z',
  course: 'EPR 400',
  lecturer: 'Dr Example',
  cost_total: 100,
  currency: 'ZAR',
  payment: {
    needs_payment: false,
    payment_state_label: 'NOT_REQUIRED',
    receipt_number: null,
    module_paid: false,
    override_applied: false
  },
  part_summary: { total_parts: 2, completed_parts: 1, printing_parts: 0, queued_parts: 1 },
  collection: {
    student_name: 'Student One',
    student_number: '12345678',
    print_label: null,
    receipt_number: null,
    needs_payment: false,
    module_or_lecturer_pays: false,
    created_at: '2026-07-01T00:00:00.000Z'
  },
  parts: [
    {
      part_id: 'part-1',
      part_number: 1,
      part_name: 'Large body',
      print_status: 'PRINTED',
      print_status_label: 'Printed',
      thumbnail_url: 'large.png',
      printer_name: null,
      primary_material: 'PLA',
      primary_brand: null,
      primary_estimated_weight: 80,
      secondary_material: null,
      secondary_brand: null,
      secondary_estimated_weight: null,
      total_cost: 80
    },
    {
      part_id: 'part-2',
      part_number: 2,
      part_name: 'Small cap',
      print_status: 'READY',
      print_status_label: 'Queued',
      thumbnail_url: 'small.png',
      printer_name: null,
      primary_material: 'PLA',
      primary_brand: null,
      primary_estimated_weight: 20,
      secondary_material: null,
      secondary_brand: null,
      secondary_estimated_weight: null,
      total_cost: 20
    }
  ]
}

test('partially ready is derived from in-production work with a completed part', () => {
  const item = boardItemFromProject(baseProject)
  assert.equal(item.group, 'partially_ready')
  assert.equal(item.completed_parts, 1)
  assert.equal(item.all_parts_completed, false)
})

test('legacy post-processing remains completed and compatible', () => {
  assert.equal(collectionCompletedStatuses.has('POST_PROCESSING'), true)
  const project = {
    ...baseProject,
    parts: baseProject.parts.map((part) => ({ ...part, print_status: 'POST_PROCESSING' }))
  }
  const item = boardItemFromProject(project)
  assert.equal(item.completed_parts, 2)
  assert.equal(item.all_parts_completed, true)
})

test('heaviest part supplies the board thumbnail', () => {
  const item = boardItemFromProject(baseProject)
  assert.equal(item.thumbnail_url, 'large.png')
  assert.equal(item.thumbnail_part_name, 'Large body')
  assert.equal(item.thumbnail_weight, 80)
})

test('ready and partially collected projects stay at the help desk', () => {
  assert.equal(boardItemFromProject({ ...baseProject, state: 'READY_FOR_COLLECTION' }).group, 'help_desk')
  assert.equal(boardItemFromProject({ ...baseProject, state: 'PARTIALLY_COLLECTED' }).group, 'help_desk')
})

test('search matches cached project, student, name, and label fields', () => {
  const item = { ...boardItemFromProject(baseProject), print_label: 'Tray A1' }
  assert.equal(searchCollectionBoard([item], 'ABCDE').length, 1)
  assert.equal(searchCollectionBoard([item], '12345678').length, 1)
  assert.equal(searchCollectionBoard([item], 'student one').length, 1)
  assert.equal(searchCollectionBoard([item], 'tray a1').length, 1)
})

test('merging cache results replaces an existing project without duplicates', () => {
  const item = boardItemFromProject(baseProject)
  const merged = mergeCollectionBoardItems([item], [{ ...item, print_label: 'Tray B2' }])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].print_label, 'Tray B2')
})
