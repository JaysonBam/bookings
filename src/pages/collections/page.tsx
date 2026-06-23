import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { useLayout } from '../../components/LayoutContext'
import {
  collectHexForgeParts,
  fetchHexForgeCollectionIndex,
  fetchHexForgeCollectionProject,
  saveHexForgeCollectionReceipt,
  type HexForgeCollectionIndexItem,
  type HexForgeCollectionPart,
  type HexForgeCollectionProject
} from '../../lib/hexForgeCollectionClient'

type SnackbarState = {
  open: boolean
  message: string
  severity: 'success' | 'error' | 'info'
}

const collectableStatuses = new Set(['PRINTED', 'POST_PROCESSING'])

const stateTone = (state: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
  if (state === 'READY_FOR_COLLECTION' || state === 'CLOSED') return 'success'
  if (state === 'PARTIALLY_COLLECTED') return 'info'
  if (state === 'IN_PRODUCTION') return 'primary'
  if (state === 'CANCELLED') return 'default'
  return 'warning'
}

const printTone = (status: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
  if (status === 'COLLECTED') return 'success'
  if (status === 'PRINTED' || status === 'POST_PROCESSING') return 'info'
  if (status === 'PRINTING') return 'primary'
  if (status === 'FAILED') return 'error'
  return 'default'
}

const formatMoney = (value: number, currency = 'ZAR') => {
  const symbol = currency === 'ZAR' ? 'R' : currency
  return `${symbol} ${Number(value || 0).toFixed(2)}`
}

const formatDateTime = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const normalizeProjectCode = (value: string) => value.trim().toUpperCase()
const extractStudentNumber = (value: string) => value.match(/\d{8}/)?.[0] || ''

const getSavedReceipt = (project: HexForgeCollectionProject | null) =>
  project?.collection?.receipt_number || project?.payment.receipt_number || ''

const projectNeedsReceipt = (project: HexForgeCollectionProject | null) =>
  Boolean(project?.payment.needs_payment && !project.payment.module_paid)

const projectIsPaid = (project: HexForgeCollectionProject | null) => {
  if (!project) return false
  if (!project.payment.needs_payment) return true
  if (project.payment.module_paid) return true
  return Boolean(getSavedReceipt(project).trim())
}

const canCollectPart = (part: HexForgeCollectionPart) =>
  collectableStatuses.has(part.print_status)

const isCollectedPart = (part: HexForgeCollectionPart) =>
  part.print_status === 'COLLECTED'

export default function CollectionsPage() {
  const theme = useTheme()
  const { setHeaderContent } = useLayout()
  const scanInputRef = useRef<HTMLInputElement | null>(null)

  const [indexItems, setIndexItems] = useState<HexForgeCollectionIndexItem[]>([])
  const [indexLoading, setIndexLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<HexForgeCollectionIndexItem[]>([])
  const [project, setProject] = useState<HexForgeCollectionProject | null>(null)
  const [projectLoading, setProjectLoading] = useState(false)
  const [indexError, setIndexError] = useState('')
  const [receiptDraft, setReceiptDraft] = useState('')
  const [receiptSaving, setReceiptSaving] = useState(false)
  const [collectorName, setCollectorName] = useState('')
  const [collectedByStudentNumber, setCollectedByStudentNumber] = useState('')
  const [collectingPartIds, setCollectingPartIds] = useState<string[]>([])
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success'
  })

  const showToast = useCallback((message: string, severity: SnackbarState['severity'] = 'success') => {
    setSnackbar({ open: true, message, severity })
  }, [])

  const focusScanner = useCallback(() => {
    window.setTimeout(() => scanInputRef.current?.focus(), 0)
  }, [])

  const clearCollectionWorkspace = useCallback(() => {
    setQuery('')
    setMatches([])
    setProject(null)
    setProjectLoading(false)
    setReceiptDraft('')
    setReceiptSaving(false)
    setCollectorName('')
    setCollectedByStudentNumber('')
    setCollectingPartIds([])
  }, [])

  const loadIndex = useCallback(async (reset = false) => {
    if (reset) clearCollectionWorkspace()
    setIndexLoading(true)
    setIndexError('')
    try {
      const data = await fetchHexForgeCollectionIndex()
      setIndexItems(data || [])
    } catch (error) {
      console.error('Failed to load HexForge collection index:', error)
      setIndexError(error instanceof Error ? error.message : 'Failed to load collection index.')
    } finally {
      setIndexLoading(false)
      focusScanner()
    }
  }, [clearCollectionWorkspace, focusScanner])

  useEffect(() => {
    setHeaderContent(
      <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
        3D Print Collection
      </Typography>
    )
    return () => setHeaderContent(null)
  }, [setHeaderContent])

  useEffect(() => {
    loadIndex()
  }, [loadIndex])

  useEffect(() => {
    setReceiptDraft(getSavedReceipt(project))
    setCollectedByStudentNumber('')
  }, [project])

  const openProject = useCallback(async (projectCode: string) => {
    const code = normalizeProjectCode(projectCode)
    if (!/^[A-Z0-9]{5}$/.test(code)) {
      showToast('Enter a valid five-character project code.', 'error')
      return
    }

    setProjectLoading(true)
    try {
      const data = await fetchHexForgeCollectionProject(code)
      setProject(data)
      setMatches([])
      setQuery(code)
    } catch (error) {
      console.error('Failed to load HexForge collection project:', error)
      setProject(null)
      showToast(error instanceof Error ? error.message : 'Project not found.', 'error')
    } finally {
      setProjectLoading(false)
      focusScanner()
    }
  }, [focusScanner, showToast])

  const runSearch = useCallback(() => {
    const rawQuery = query.trim()
    const studentNumber = extractStudentNumber(rawQuery)
    const normalizedCode = normalizeProjectCode(rawQuery)

    if (studentNumber) {
      const studentMatches = indexItems
        .filter((item) => item.student_number === studentNumber)
        .sort((a, b) => (b.last_part_updated_at || '').localeCompare(a.last_part_updated_at || ''))
      setMatches(studentMatches)

      if (studentMatches.length === 1) {
        openProject(studentMatches[0].project_code)
      } else if (studentMatches.length === 0) {
        setProject(null)
        showToast('No active HexForge project was found for that student number.', 'info')
      }
      return
    }

    if (/^[A-Z0-9]{5}$/.test(normalizedCode)) {
      openProject(normalizedCode)
      return
    }

    const lowerQuery = rawQuery.toLowerCase()
    const fuzzyMatches = indexItems
      .filter((item) =>
        item.project_code.toLowerCase().includes(lowerQuery) ||
        item.student_number.includes(rawQuery) ||
        item.student_name.toLowerCase().includes(lowerQuery) ||
        (item.print_label || '').toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => (b.last_part_updated_at || '').localeCompare(a.last_part_updated_at || ''))

    setMatches(fuzzyMatches)
    if (fuzzyMatches.length === 0) {
      setProject(null)
      showToast('No active projects matched that search.', 'info')
    }
  }, [indexItems, openProject, query, showToast])

  const handleSaveReceipt = async () => {
    if (!project) return
    const receiptNumber = receiptDraft.trim()

    if (!receiptNumber) {
      showToast('Enter a receipt number before saving.', 'error')
      return
    }

    setReceiptSaving(true)
    try {
      const refreshedProject = await saveHexForgeCollectionReceipt(project.project_code, receiptNumber)
      setProject(refreshedProject)
      showToast('Receipt number saved.', 'success')
    } catch (error) {
      console.error('Failed to save receipt:', error)
      showToast(error instanceof Error ? error.message : 'Could not save receipt number.', 'error')
    } finally {
      setReceiptSaving(false)
      focusScanner()
    }
  }

  const collectParts = async (partIds: string[]) => {
    if (!project) return

    if (!collectorName.trim()) {
      showToast('Enter the assisting staff member before collecting.', 'error')
      return
    }

    if (!projectIsPaid(project)) {
      showToast('Save a receipt number before collecting paid parts.', 'error')
      return
    }

    const normalizedStudentNumber = extractStudentNumber(collectedByStudentNumber)
    if (!normalizedStudentNumber) {
      showToast('Enter the eight-digit student number of the person collecting.', 'error')
      return
    }

    setCollectingPartIds(partIds)
    try {
      const result = await collectHexForgeParts(
        project.project_code,
        partIds,
        collectorName.trim(),
        normalizedStudentNumber
      )
      setProject(result.project)
      await loadIndex()
      showToast(partIds.length === 1 ? 'Part collected.' : 'Collectable parts collected.', 'success')
    } catch (error) {
      console.error('Failed to collect HexForge parts:', error)
      showToast(error instanceof Error ? error.message : 'Collection failed.', 'error')
    } finally {
      setCollectingPartIds([])
      focusScanner()
    }
  }

  const collectableParts = useMemo(
    () => project?.parts.filter((part) => canCollectPart(part) && !isCollectedPart(part)) || [],
    [project]
  )

  const collectionBlocked = projectNeedsReceipt(project) && !getSavedReceipt(project).trim()
  const savedReceipt = getSavedReceipt(project)

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100%', pb: { xs: 8, md: 12 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 1, md: 3 }, pt: { xs: 2, md: 3 } }}>
        <Stack spacing={2.5}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField
                  inputRef={scanInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') runSearch()
                  }}
                  placeholder="Scan student card, scan project code, or search"
                  fullWidth
                  autoFocus
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <QrCodeScannerIcon color="action" />
                      </InputAdornment>
                    )
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={runSearch}
                  sx={{ minHeight: 56, px: 3, whiteSpace: 'nowrap' }}
                >
                  Search
                </Button>
                <Tooltip title="Refresh active HexForge projects">
                  <span>
                    <IconButton
                      onClick={() => loadIndex(true)}
                      disabled={indexLoading}
                      sx={{ width: 56, height: 56, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}
                    >
                      {indexLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>

              {indexError && (
                <Alert severity="error" variant="outlined">
                  {indexError}
                </Alert>
              )}
            </Stack>
          </Paper>

          {matches.length > 1 && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                Matching active projects
              </Typography>
              <Stack spacing={1}>
                {matches.map((item) => (
                  <Button
                    key={item.project_code}
                    variant="outlined"
                    onClick={() => openProject(item.project_code)}
                    sx={{ justifyContent: 'space-between', minHeight: 64, textAlign: 'left', gap: 2 }}
                  >
                    <Box>
                      <Typography fontWeight={800}>{item.project_code}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.student_name} | {item.student_number}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Label: {item.print_label || 'Not set'} | Updated: {formatDateTime(item.last_part_updated_at) || 'No part activity'}
                      </Typography>
                    </Box>
                    <Chip size="small" label={item.state.replace(/_/g, ' ')} color={stateTone(item.state)} />
                  </Button>
                ))}
              </Stack>
            </Paper>
          )}

          {projectLoading && (
            <Paper variant="outlined" sx={{ p: 5, borderRadius: 2, textAlign: 'center' }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                Loading collection details
              </Typography>
            </Paper>
          )}

          {!projectLoading && project && (
            <Stack spacing={2.5}>
              <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    spacing={2}
                  >
                    <Box>
                      <Typography variant="overline" color="text.secondary" fontWeight={800}>
                        Project
                      </Typography>
                      <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
                        {project.project_code}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip label={project.state_label || project.state.replace(/_/g, ' ')} color={stateTone(project.state)} />
                      <Chip
                        label={projectIsPaid(project) ? 'Payment clear' : 'Receipt required'}
                        color={projectIsPaid(project) ? 'success' : 'warning'}
                        variant={projectIsPaid(project) ? 'filled' : 'outlined'}
                      />
                    </Stack>
                  </Stack>

                  <Divider />

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
                      gap: 2
                    }}
                  >
                    <InfoBlock label="Student" value={project.collection?.student_name || 'Unavailable'} detail={project.collection?.student_number} />
                    <InfoBlock label="Location label" value={project.collection?.print_label || 'Not set'} />
                    <InfoBlock label="Course" value={project.course || 'Not set'} detail={project.lecturer || undefined} />
                    <InfoBlock label="Total" value={formatMoney(project.cost_total, project.currency)} detail={`${project.part_summary.total_parts} parts`} />
                  </Box>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ xs: 'stretch', lg: 'flex-end' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={800}>
                        Collection details
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Receipt changes are saved to HexForge before collection is enabled.
                      </Typography>
                    </Box>

                    <TextField
                      label="Assisted by"
                      value={collectorName}
                      onChange={(event) => setCollectorName(event.target.value)}
                      sx={{ minWidth: { xs: '100%', lg: 280 } }}
                    />

                    <TextField
                      label="Collected by student number"
                      value={collectedByStudentNumber}
                      onChange={(event) => setCollectedByStudentNumber(event.target.value.replace(/\D/g, '').slice(0, 8))}
                      inputProps={{ inputMode: 'numeric', maxLength: 8 }}
                      sx={{ minWidth: { xs: '100%', lg: 280 } }}
                    />

                    {projectNeedsReceipt(project) && (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ minWidth: { xs: '100%', lg: 420 } }}>
                        <TextField
                          label="Receipt number"
                          value={receiptDraft}
                          onChange={(event) => setReceiptDraft(event.target.value)}
                          fullWidth
                          color={collectionBlocked ? 'warning' : 'primary'}
                        />
                        <Button
                          variant="contained"
                          startIcon={receiptSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                          onClick={handleSaveReceipt}
                          disabled={receiptSaving || !receiptDraft.trim()}
                          sx={{ minHeight: 56, whiteSpace: 'nowrap' }}
                        >
                          Save receipt
                        </Button>
                      </Stack>
                    )}
                  </Stack>

                  {projectNeedsReceipt(project) ? (
                    <Alert severity={collectionBlocked ? 'warning' : 'success'} variant="outlined">
                      {collectionBlocked
                        ? 'Payment is required. Save the receipt number before collecting any parts.'
                        : `Receipt ${savedReceipt} is saved. Collection is enabled.`}
                    </Alert>
                  ) : (
                    <Alert severity="success" variant="outlined">
                      No receipt is required for this project.
                    </Alert>
                  )}
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      Parts for collection
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {collectableParts.length} part{collectableParts.length === 1 ? '' : 's'} currently collectable
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<DoneAllIcon />}
                    onClick={() => collectParts(collectableParts.map((part) => part.part_id))}
                    disabled={collectableParts.length === 0 || collectionBlocked || collectingPartIds.length > 0}
                    sx={{ minHeight: 44 }}
                  >
                    Collect all
                  </Button>
                </Stack>

                <Stack spacing={1.5}>
                  {project.parts.length === 0 ? (
                    <Box sx={{ py: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: 2 }}>
                      <Typography fontWeight={800}>No parts found for this project.</Typography>
                    </Box>
                  ) : (
                    project.parts.map((part) => (
                      <PartRow
                        key={part.part_id}
                        part={part}
                        currency={project.currency}
                        disabled={collectionBlocked || collectingPartIds.length > 0}
                        collecting={collectingPartIds.includes(part.part_id)}
                        onCollect={() => collectParts([part.part_id])}
                      />
                    ))
                  )}
                </Stack>
              </Paper>
            </Stack>
          )}
        </Stack>
      </Container>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar((current) => ({ ...current, open: false }))}>
        <Alert
          onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

function InfoBlock({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={800}>
        {label}
      </Typography>
      <Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
      {detail && (
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {detail}
        </Typography>
      )}
    </Box>
  )
}

function PartRow({
  part,
  currency,
  disabled,
  collecting,
  onCollect
}: {
  part: HexForgeCollectionPart
  currency: string
  disabled: boolean
  collecting: boolean
  onCollect: () => void
}) {
  const collected = isCollectedPart(part)
  const collectable = canCollectPart(part) && !collected
  const materials = [
    part.primary_material
      ? `${part.primary_material}${part.primary_brand ? ` (${part.primary_brand})` : ''}: ${part.primary_estimated_weight || 0}g`
      : 'Material not listed',
    part.secondary_material
      ? `${part.secondary_material}${part.secondary_brand ? ` (${part.secondary_brand})` : ''}: ${part.secondary_estimated_weight || 0}g`
      : ''
  ].filter(Boolean)

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        display: 'grid',
        gridTemplateColumns: { xs: '64px minmax(0, 1fr)', md: '72px minmax(0, 1fr) auto' },
        gap: 1.5,
        alignItems: 'center',
        bgcolor: collected ? 'success.lighter' : 'background.paper'
      }}
    >
      <Box
        sx={{
          width: { xs: 64, md: 72 },
          height: { xs: 64, md: 72 },
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'action.hover',
          display: 'grid',
          placeItems: 'center'
        }}
      >
        {part.thumbnail_url ? (
          <Box
            component="img"
            src={part.thumbnail_url}
            alt={`${part.part_name} thumbnail`}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Inventory2OutlinedIcon color="disabled" />
        )}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Typography fontWeight={900} sx={{ overflowWrap: 'anywhere' }}>
            {part.part_name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            #{part.part_number}
          </Typography>
          <Chip size="small" label={part.print_status_label || part.print_status} color={printTone(part.print_status)} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
          {materials.join(' | ')}
        </Typography>
        {part.collection?.special_instruction && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Note: {part.collection.special_instruction}
          </Typography>
        )}
        {collected && (
          <Typography variant="caption" color="success.dark" display="block" sx={{ mt: 0.5, fontWeight: 700 }}>
            Assisted by {part.collection?.collected_by || 'Unknown'} {formatDateTime(part.collection?.collected_at)}
            {part.collection?.collected_by_student_number ? ` | Collected by student ${part.collection.collected_by_student_number}` : ''}
          </Typography>
        )}
      </Box>

      <Stack
        direction={{ xs: 'row', md: 'column' }}
        spacing={1}
        alignItems={{ xs: 'center', md: 'flex-end' }}
        justifyContent="space-between"
        sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
      >
        <Typography fontWeight={900}>{formatMoney(part.total_cost, currency)}</Typography>
        {collected ? (
          <Chip icon={<CheckCircleIcon />} label="Collected" color="success" />
        ) : collectable ? (
          <Button
            variant="contained"
            color="success"
            startIcon={collecting ? <CircularProgress size={16} color="inherit" /> : <LocalShippingIcon />}
            onClick={onCollect}
            disabled={disabled || collecting}
          >
            Collect
          </Button>
        ) : (
          <Chip label="Not collectable" variant="outlined" />
        )}
      </Stack>
    </Paper>
  )
}
