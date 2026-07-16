import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import CloseIcon from '@mui/icons-material/Close'
import SaveIcon from '@mui/icons-material/Save'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import { useLayout } from '../../components/LayoutContext'
import {
  collectHexForgeParts,
  fetchHexForgeCollectionBoard,
  fetchHexForgeCollectionProject,
  prepareHexForgeCollectionEmail,
  releaseHexForgeCollectionProject,
  saveHexForgeCollectionReceipt,
  searchHexForgeCollection,
  type HexForgeCollectionBoardItem,
  type HexForgeCollectionPart,
  type HexForgeCollectionProject
} from '../../lib/hexForgeCollectionClient'
import {
  boardItemFromProject,
  mergeCollectionBoardItems,
  searchCollectionBoard
} from '../../lib/collectionBoard'
import CollectionEmailPreviewDialog, { type CollectionEmailPreviewData } from '../../components/CollectionEmailPreviewDialog'

type SnackbarState = {
  open: boolean
  message: string
  severity: 'success' | 'error' | 'info'
}

const collectableStatuses = new Set(['PRINTED', 'POST_PROCESSING'])

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

const normalizeProjectCode = (value: string) => value.trim().toUpperCase()
const extractStudentNumber = (value: string) => value.match(/\d{8}/)?.[0] || ''

const getSavedReceipt = (project: HexForgeCollectionProject | null) =>
  project?.collection?.receipt_number || project?.payment.receipt_number || ''

const projectNeedsReceipt = (project: HexForgeCollectionProject | null) =>
  Boolean(project?.payment.needs_payment && !project.payment.module_paid)

const projectIsPaid = (project: HexForgeCollectionProject | null) => {
  if (!project) return false
  if (!project.payment.needs_payment || project.payment.module_paid) return true
  return Boolean(getSavedReceipt(project).trim())
}

const canCollectPart = (part: HexForgeCollectionPart) => collectableStatuses.has(part.print_status)
const isCollectedPart = (part: HexForgeCollectionPart) => part.print_status === 'COLLECTED'

const formatPrintStatus = (status: string) => {
  if (status === 'POST_PROCESSING') return 'Printed'
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const collectionStatusLabel = (part: HexForgeCollectionPart) => {
  if (isCollectedPart(part)) return 'Collected'
  if (canCollectPart(part)) return 'Ready to collect'
  return part.print_status === 'POST_PROCESSING'
    ? 'Printed'
    : part.print_status_label || formatPrintStatus(part.print_status)
}

export default function CollectionsPage() {
  const theme = useTheme()
  const { setHeaderContent } = useLayout()
  const scanInputRef = useRef<HTMLInputElement | null>(null)
  const previousProjectCodeRef = useRef<string | null>(null)
  const projectCacheRef = useRef(new Map<string, HexForgeCollectionProject>())
  const collectionSubmittingRef = useRef(false)

  const [boardItems, setBoardItems] = useState<HexForgeCollectionBoardItem[]>([])
  const [boardLoading, setBoardLoading] = useState(true)
  const [boardError, setBoardError] = useState('')
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<HexForgeCollectionBoardItem[]>([])
  const [searching, setSearching] = useState(false)
  const [activeProjectCode, setActiveProjectCode] = useState<string | null>(null)
  const [project, setProject] = useState<HexForgeCollectionProject | null>(null)
  const [projectLoading, setProjectLoading] = useState(false)
  const [receiptDraft, setReceiptDraft] = useState('')
  const [receiptSaving, setReceiptSaving] = useState(false)
  const [collectorName, setCollectorName] = useState('')
  const [collectedByStudentNumber, setCollectedByStudentNumber] = useState('')
  const [collectingPartIds, setCollectingPartIds] = useState<string[]>([])
  const [pendingCollectionPartIds, setPendingCollectionPartIds] = useState<string[]>([])
  const [imagePreviewPart, setImagePreviewPart] = useState<HexForgeCollectionPart | null>(null)
  const [releaseItem, setReleaseItem] = useState<HexForgeCollectionBoardItem | null>(null)
  const [releaseLabel, setReleaseLabel] = useState('')
  const [releasing, setReleasing] = useState(false)
  const [emailingCodes, setEmailingCodes] = useState<string[]>([])
  const [emailPreview, setEmailPreview] = useState<CollectionEmailPreviewData | null>(null)
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' })

  const showToast = useCallback((message: string, severity: SnackbarState['severity'] = 'success') => {
    setSnackbar({ open: true, message, severity })
  }, [])

  const focusScanner = useCallback(() => {
    window.setTimeout(() => scanInputRef.current?.focus(), 0)
  }, [])

  const updateBoardFromProject = useCallback((updatedProject: HexForgeCollectionProject) => {
    projectCacheRef.current.set(updatedProject.project_code, updatedProject)
    const updatedItem = boardItemFromProject(updatedProject)
    setBoardItems((current) => {
      const withoutProject = current.filter((item) => item.project_code !== updatedProject.project_code)
      if (!updatedItem.group || (updatedItem.group === 'help_desk' && updatedItem.remaining_parts === 0)) return withoutProject
      return mergeCollectionBoardItems(withoutProject, [updatedItem])
    })
    setMatches((current) => current.map((item) => item.project_code === updatedItem.project_code ? updatedItem : item))
    setProject(updatedProject)
  }, [])

  const loadBoard = useCallback(async () => {
    setBoardLoading(true)
    setBoardError('')
    try {
      const data = await fetchHexForgeCollectionBoard()
      setBoardItems(data || [])
    } catch (error) {
      console.error('Failed to load HexForge collection board:', error)
      setBoardError(error instanceof Error ? error.message : 'Failed to load the collection board.')
    } finally {
      setBoardLoading(false)
      focusScanner()
    }
  }, [focusScanner])

  useEffect(() => {
    setHeaderContent(
      <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
        3D Print Collection
      </Typography>
    )
    return () => setHeaderContent(null)
  }, [setHeaderContent])

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  useEffect(() => {
    setReceiptDraft(getSavedReceipt(project))
    const projectCode = project?.project_code || null
    if (projectCode && previousProjectCodeRef.current && previousProjectCodeRef.current !== projectCode) {
      setCollectorName('')
      setCollectedByStudentNumber('')
    }
    if (projectCode) previousProjectCodeRef.current = projectCode
  }, [project])

  const openProject = useCallback(async (projectCode: string) => {
    const code = normalizeProjectCode(projectCode)
    if (!/^[A-Z0-9]{5}$/.test(code)) {
      showToast('Enter a valid five-character project code.', 'error')
      return
    }

    setMatches([])
    setActiveProjectCode(code)
    const cached = projectCacheRef.current.get(code)
    if (cached) {
      setProject(cached)
      return
    }

    setProject(null)
    setProjectLoading(true)
    try {
      const data = await fetchHexForgeCollectionProject(code)
      projectCacheRef.current.set(code, data)
      setProject(data)
    } catch (error) {
      console.error('Failed to load HexForge collection project:', error)
      setActiveProjectCode(null)
      showToast(error instanceof Error ? error.message : 'Project not found.', 'error')
    } finally {
      setProjectLoading(false)
    }
  }, [showToast])

  const runSearch = useCallback(async () => {
    if (projectLoading || searching) return
    const rawQuery = query.trim()
    if (!rawQuery) {
      showToast('Enter a project code, student number, name, or collection label.', 'info')
      return
    }

    setMatches([])
    const localMatches = searchCollectionBoard(boardItems, rawQuery)
    const exactCode = normalizeProjectCode(rawQuery)
    const exactLocal = /^[A-Z0-9]{5}$/.test(exactCode)
      ? localMatches.find((item) => item.project_code === exactCode)
      : undefined
    if (exactLocal) {
      await openProject(exactLocal.project_code)
      return
    }
    if (localMatches.length === 1) {
      await openProject(localMatches[0].project_code)
      return
    }
    if (localMatches.length > 1) {
      setMatches(localMatches)
      return
    }

    setSearching(true)
    try {
      const remoteMatches = await searchHexForgeCollection(extractStudentNumber(rawQuery) || rawQuery)
      setBoardItems((current) => mergeCollectionBoardItems(current, remoteMatches || []))
      if (!remoteMatches?.length) {
        showToast('No active HexForge projects matched that search.', 'info')
      } else {
        const exactRemote = /^[A-Z0-9]{5}$/.test(exactCode)
          ? remoteMatches.find((item) => item.project_code === exactCode)
          : undefined
        if (exactRemote || remoteMatches.length === 1) {
          await openProject((exactRemote || remoteMatches[0]).project_code)
        } else {
          setMatches(remoteMatches)
        }
      }
    } catch (error) {
      console.error('Failed to search HexForge:', error)
      showToast(error instanceof Error ? error.message : 'Could not search HexForge.', 'error')
    } finally {
      setSearching(false)
      focusScanner()
    }
  }, [boardItems, focusScanner, openProject, projectLoading, query, searching, showToast])

  const closeProject = () => {
    if (collectingPartIds.length > 0 || receiptSaving) return
    setActiveProjectCode(null)
    setProject(null)
    setPendingCollectionPartIds([])
    setImagePreviewPart(null)
    focusScanner()
  }

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
      updateBoardFromProject(refreshedProject)
      showToast('Receipt number saved.')
    } catch (error) {
      console.error('Failed to save receipt:', error)
      showToast(error instanceof Error ? error.message : 'Could not save receipt number.', 'error')
    } finally {
      setReceiptSaving(false)
    }
  }

  const validateCollection = useCallback((partIds: string[]) => {
    if (!project) return false
    if (!collectorName.trim()) {
      showToast('Enter the assisting staff member before collecting.', 'error')
      return false
    }
    if (!extractStudentNumber(collectedByStudentNumber)) {
      showToast('Enter the eight-digit student number of the person collecting.', 'error')
      return false
    }
    if (!projectIsPaid(project)) {
      showToast('Save a receipt number before collecting paid parts.', 'error')
      return false
    }
    if (partIds.length === 0) {
      showToast('Select at least one ready part before collecting.', 'error')
      return false
    }
    return true
  }, [collectedByStudentNumber, collectorName, project, showToast])

  const requestCollectionConfirmation = useCallback((partIds: string[]) => {
    if (validateCollection(partIds)) setPendingCollectionPartIds(partIds)
  }, [validateCollection])

  const collectParts = async (partIds: string[]) => {
    if (!project || !validateCollection(partIds) || collectionSubmittingRef.current) return false
    setCollectingPartIds(partIds)
    collectionSubmittingRef.current = true
    try {
      const result = await collectHexForgeParts(
        project.project_code,
        partIds,
        collectorName.trim(),
        extractStudentNumber(collectedByStudentNumber)
      )
      updateBoardFromProject(result.project)
      showToast(partIds.length === 1 ? 'Part collected.' : 'Collectable parts collected.')
      return true
    } catch (error) {
      console.error('Failed to collect HexForge parts:', error)
      showToast(error instanceof Error ? error.message : 'Collection failed.', 'error')
      return false
    } finally {
      setCollectingPartIds([])
      collectionSubmittingRef.current = false
    }
  }

  const confirmCollection = async () => {
    if (collectingPartIds.length > 0) return
    if (await collectParts(pendingCollectionPartIds)) setPendingCollectionPartIds([])
  }

  const openRelease = (item: HexForgeCollectionBoardItem) => {
    setReleaseItem(item)
    setReleaseLabel(item.print_label || '')
  }

  const confirmRelease = async () => {
    if (!releaseItem || releasing) return
    setReleasing(true)
    try {
      const result = await releaseHexForgeCollectionProject(releaseItem.project_code, releaseLabel.trim() || undefined)
      updateBoardFromProject(result.project)
      setReleaseItem(null)
      showToast('Project moved to the help desk.')
    } catch (error) {
      console.error('Failed to release project:', error)
      showToast(error instanceof Error ? error.message : 'Could not move the project to the help desk.', 'error')
    } finally {
      setReleasing(false)
    }
  }

  const openEmail = async (item: HexForgeCollectionBoardItem) => {
    if (emailingCodes.includes(item.project_code)) return
    setEmailingCodes((current) => [...current, item.project_code])
    try {
      const email = await prepareHexForgeCollectionEmail(item.project_code)
      setEmailPreview({ draft: email })
    } catch (error) {
      console.error('Failed to prepare collection email:', error)
      showToast(error instanceof Error ? error.message : 'Could not prepare the collection email.', 'error')
    } finally {
      setEmailingCodes((current) => current.filter((code) => code !== item.project_code))
    }
  }


  const helpDeskItems = useMemo(
    () => boardItems.filter((item) => item.group === 'help_desk' && item.remaining_parts > 0),
    [boardItems]
  )
  const partiallyReadyItems = useMemo(
    () => boardItems.filter((item) => item.group === 'partially_ready'),
    [boardItems]
  )
  const collectableParts = useMemo(
    () => project?.parts.filter((part) => canCollectPart(part) && !isCollectedPart(part)) || [],
    [project]
  )
  const partStatusSummary = useMemo(() => {
    const parts = project?.parts || []
    const collected = parts.filter(isCollectedPart).length
    const ready = parts.filter((part) => canCollectPart(part) && !isCollectedPart(part)).length
    return { shown: parts.length, ready, collected, notReady: parts.length - ready - collected }
  }, [project])
  const pendingCollectionParts = useMemo(
    () => pendingCollectionPartIds
      .map((partId) => project?.parts.find((part) => part.part_id === partId))
      .filter((part): part is HexForgeCollectionPart => Boolean(part)),
    [pendingCollectionPartIds, project]
  )
  const collectionBlocked = projectNeedsReceipt(project) && !getSavedReceipt(project).trim()
  const savedReceipt = getSavedReceipt(project)

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100%', pb: { xs: 8, md: 12 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 1, md: 3 }, pt: { xs: 2, md: 3 } }}>
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
            <Stack spacing={2}>
              <Box>
                <Typography color="text.secondary">
                  Scan or search without hiding the projects currently expected at the desk.
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField
                  inputRef={scanInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void runSearch() }}
                  placeholder="Scan project code or student card, or search"
                  fullWidth
                  autoFocus
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><QrCodeScannerIcon color="action" /></InputAdornment>
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={searching ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
                  onClick={() => void runSearch()}
                  disabled={searching || projectLoading}
                  sx={{ minHeight: 56, px: 3, whiteSpace: 'nowrap' }}
                >
                  {searching ? 'Searching HexForge' : 'Search'}
                </Button>
              </Stack>
              {boardError && (
                <Alert
                  severity="error"
                  variant="outlined"
                  action={<Button color="inherit" size="small" onClick={() => void loadBoard()}>Try again</Button>}
                >
                  {boardError}
                </Alert>
              )}
            </Stack>
          </Paper>

          {matches.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>Choose a project</Typography>
                  <Typography variant="body2" color="text.secondary">More than one project matched this search.</Typography>
                </Box>
                <IconButton aria-label="Close search results" onClick={() => setMatches([])}><CloseIcon /></IconButton>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
                {matches.map((item) => (
                  <Button
                    key={item.project_code}
                    variant="outlined"
                    onClick={() => void openProject(item.project_code)}
                    sx={{ justifyContent: 'space-between', minHeight: 72, textAlign: 'left', gap: 2 }}
                  >
                    <Box>
                      <Typography fontWeight={900}>{item.project_code}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.student_name} · {item.student_number}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{item.print_label || 'No collection label'}</Typography>
                    </Box>
                    <Chip size="small" label={item.group === 'help_desk' ? 'Help desk' : item.group === 'partially_ready' ? 'Partially ready' : 'Active'} />
                  </Button>
                ))}
              </Box>
            </Paper>
          )}

          {boardLoading ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 2 }}>Loading the collection board</Typography>
            </Paper>
          ) : (
            <Stack spacing={4}>
              <BoardSection
                title="At help desk"
                count={helpDeskItems.length}
                tone="success"
                items={helpDeskItems}
                emailingCodes={emailingCodes}
                onOpen={openProject}
                onEmail={openEmail}
              />
              <BoardSection
                title="Partially ready"
                count={partiallyReadyItems.length}
                tone="primary"
                items={partiallyReadyItems}
                emailingCodes={emailingCodes}
                onOpen={openProject}
                onEmail={openEmail}
                onRelease={openRelease}
              />
            </Stack>
          )}
        </Stack>
      </Container>

      <Dialog
        open={Boolean(activeProjectCode)}
        onClose={closeProject}
        fullWidth
        maxWidth="xl"
        PaperProps={{ sx: { position: 'relative', height: { xs: '96vh', md: '92vh' }, maxHeight: '96vh', borderRadius: { xs: 1, md: 2 } } }}
        BackdropProps={{ sx: { bgcolor: alpha(theme.palette.common.black, 0.68) } }}
      >
        <DialogTitle component="div" sx={{ minHeight: 56, p: { xs: 1, md: 1.5 }, display: 'flex', justifyContent: 'flex-end', bgcolor: 'background.default' }}>
          <IconButton aria-label="Close collection workspace" onClick={closeProject}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 1.5, md: 3 }, pb: { xs: 1.5, md: 3 }, pt: 0, bgcolor: 'background.default' }}>
          {projectLoading && (
            <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <Box><CircularProgress /><Typography color="text.secondary" sx={{ mt: 2 }}>Loading collection details</Typography></Box>
            </Box>
          )}
          {!projectLoading && project && (
            <Stack spacing={2.5}>
              <Box sx={{ px: { xs: 1, md: 2 }, pb: 2.5, borderBottom: 1, borderColor: 'divider' }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="overline" color="text.secondary" fontWeight={800}>Project</Typography>
                    <Typography variant="h4" component="h2" fontWeight={900}>{project.project_code}</Typography>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
                    <InfoBlock label="Student" value={project.collection?.student_name || 'Unavailable'} detail={project.collection?.student_number} />
                    <InfoBlock label="Location label" value={project.collection?.print_label || 'No collection label assigned'} />
                    <InfoBlock label="Course" value={project.course || 'Not set'} detail={project.lecturer || undefined} />
                    <InfoBlock label="Total" value={formatMoney(project.cost_total, project.currency)} detail={`${project.part_summary.total_parts} parts`} />
                  </Box>
                </Stack>
              </Box>

              <Box sx={{ px: { xs: 1, md: 2 } }}>
                <Stack spacing={2}>
                  <Typography variant="h6" fontWeight={800}>Collection details</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr)' }, gap: 2, alignItems: 'end' }}>
                    <TextField label="Assisted by" value={collectorName} onChange={(event) => setCollectorName(event.target.value)} fullWidth />
                    <TextField
                      label="Collected by student number"
                      value={collectedByStudentNumber}
                      onChange={(event) => setCollectedByStudentNumber(event.target.value.replace(/\D/g, '').slice(0, 8))}
                      inputProps={{ inputMode: 'numeric', maxLength: 8 }}
                      fullWidth
                    />
                    {projectNeedsReceipt(project) && (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField label="Receipt number" value={receiptDraft} onChange={(event) => setReceiptDraft(event.target.value)} fullWidth color={collectionBlocked ? 'warning' : 'primary'} />
                        <Button variant="contained" startIcon={receiptSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />} onClick={() => void handleSaveReceipt()} disabled={receiptSaving || !receiptDraft.trim()} sx={{ minHeight: 56, whiteSpace: 'nowrap' }}>Save receipt</Button>
                      </Stack>
                    )}
                  </Box>
                  {projectNeedsReceipt(project) ? (
                    <Alert severity={collectionBlocked ? 'warning' : 'success'} variant="outlined">
                      {collectionBlocked ? 'Payment is required. Save the receipt number before collecting any parts.' : `Receipt ${savedReceipt} is saved. Collection is enabled.`}
                    </Alert>
                  ) : <Alert severity="success" variant="outlined">No receipt is required for this project.</Alert>}
                </Stack>
              </Box>

              <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
                <Stack spacing={1.5} sx={{ mb: 2 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
                    <Box>
                      <Typography variant="h6" fontWeight={800}>Parts for collection</Typography>
                    </Box>
                    <Button variant="contained" color="success" startIcon={<DoneAllIcon />} onClick={() => requestCollectionConfirmation(collectableParts.map((part) => part.part_id))} disabled={collectableParts.length === 0 || collectionBlocked || collectingPartIds.length > 0} sx={{ minHeight: 44 }}>
                      Review collection of {collectableParts.length} ready parts
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip size="small" label={`Total ${partStatusSummary.shown}`} variant="outlined" />
                    <Chip size="small" label={`Ready to collect ${partStatusSummary.ready}`} color="info" />
                    <Chip size="small" label={`Collected ${partStatusSummary.collected}`} color="success" />
                    <Chip size="small" label={`Not ready ${partStatusSummary.notReady}`} variant="outlined" />
                  </Stack>
                </Stack>
                <Stack spacing={1.5}>
                  {project.parts.length === 0 ? (
                    <Box sx={{ py: 5, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: 2 }}><Typography fontWeight={800}>No parts found for this project.</Typography></Box>
                  ) : project.parts.map((part) => (
                    <PartRow
                      key={part.part_id}
                      part={part}
                      currency={project.currency}
                      disabled={collectionBlocked || collectingPartIds.length > 0}
                      collecting={collectingPartIds.includes(part.part_id)}
                      onCollect={() => requestCollectionConfirmation([part.part_id])}
                      onPreview={() => setImagePreviewPart(part)}
                    />
                  ))}
                </Stack>
              </Paper>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(releaseItem)} onClose={releasing ? undefined : () => setReleaseItem(null)} fullWidth maxWidth="sm">
        <DialogTitle>Move {releaseItem?.project_code} to the help desk</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info" variant="outlined">All {releaseItem?.total_parts || 0} parts are complete. This releases the project using HexForge’s existing collection transition.</Alert>
            <TextField
              autoFocus
              label="Tray / location label (optional)"
              value={releaseLabel}
              onChange={(event) => setReleaseLabel(event.target.value)}
              placeholder="Tray A1"
              helperText="Leave this empty to keep the current label unchanged."
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReleaseItem(null)} disabled={releasing}>Cancel</Button>
          <Button variant="contained" startIcon={releasing ? <CircularProgress size={16} color="inherit" /> : <MoveToInboxOutlinedIcon />} onClick={() => void confirmRelease()} disabled={releasing}>
            {releasing ? 'Moving' : 'Move to help desk'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pendingCollectionPartIds.length > 0} onClose={collectingPartIds.length > 0 ? undefined : () => setPendingCollectionPartIds([])} fullWidth maxWidth="sm">
        <DialogTitle>Confirm part collection</DialogTitle>
        <DialogContent dividers>
          {project && (
            <Stack spacing={2}>
              <Typography color="text.secondary">This will mark the listed parts as collected in HexForge.</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                <InfoBlock label="Project" value={project.project_code} />
                <InfoBlock label="Collection location" value={project.collection?.print_label || 'No collection label assigned'} />
                <InfoBlock label="Student" value={project.collection?.student_name || 'Unavailable'} detail={project.collection?.student_number} />
                <InfoBlock label="Collected by" value={collectedByStudentNumber} />
                <InfoBlock label="Assisted by" value={collectorName} />
                <InfoBlock label="Receipt status" value={projectNeedsReceipt(project) ? (getSavedReceipt(project) ? `Receipt ${getSavedReceipt(project)} saved` : 'Receipt required') : 'No receipt required'} />
              </Box>
              <Typography fontWeight={800}>{pendingCollectionParts.length} part{pendingCollectionParts.length === 1 ? '' : 's'} selected for collection</Typography>
              <Stack spacing={1}>
                {pendingCollectionParts.map((part) => (
                  <Paper key={part.part_id} variant="outlined" sx={{ p: 1, display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr)', gap: 1.25, alignItems: 'center' }}>
                    {part.thumbnail_url ? <Box component="img" src={part.thumbnail_url} alt={`${part.part_name} thumbnail`} sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1 }} /> : <Box sx={{ width: 56, height: 56, borderRadius: 1, bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}><Typography variant="caption" color="text.secondary">No image</Typography></Box>}
                    <Box sx={{ minWidth: 0 }}><Typography fontWeight={800}>#{part.part_number} · {part.part_name}</Typography><Chip size="small" label={collectionStatusLabel(part)} color={printTone(part.print_status)} sx={{ mt: 0.5 }} /></Box>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setPendingCollectionPartIds([])} disabled={collectingPartIds.length > 0}>Cancel</Button>
          <Button variant="contained" color="success" onClick={() => void confirmCollection()} disabled={collectingPartIds.length > 0 || pendingCollectionPartIds.length === 0}>{collectingPartIds.length > 0 ? 'Collecting…' : 'Confirm collection'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(imagePreviewPart)} onClose={() => setImagePreviewPart(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 7 }}>{imagePreviewPart?.part_name} · #{imagePreviewPart?.part_number}<IconButton aria-label="Close image preview" onClick={() => setImagePreviewPart(null)} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton></DialogTitle>
        <DialogContent>{imagePreviewPart?.thumbnail_url && <Box component="img" src={imagePreviewPart.thumbnail_url} alt={`${imagePreviewPart.part_name} preview`} sx={{ display: 'block', width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 1 }} />}</DialogContent>
      </Dialog>

      <CollectionEmailPreviewDialog data={emailPreview} onClose={() => setEmailPreview(null)} onNotify={showToast} />

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar((current) => ({ ...current, open: false }))}>
        <Alert onClose={() => setSnackbar((current) => ({ ...current, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}

function BoardSection({
  title,
  count,
  tone,
  items,
  emailingCodes,
  onOpen,
  onEmail,
  onRelease
}: {
  title: string
  count: number
  tone: 'success' | 'primary'
  items: HexForgeCollectionBoardItem[]
  emailingCodes: string[]
  onOpen: (projectCode: string) => void
  onEmail: (item: HexForgeCollectionBoardItem) => void
  onRelease?: (item: HexForgeCollectionBoardItem) => void
}) {
  return (
    <Box component="section" aria-labelledby={`${tone}-collection-section`}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} spacing={1} sx={{ mb: 1.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography id={`${tone}-collection-section`} variant="h5" fontWeight={900}>{title}</Typography>
            <Chip label={count} color={tone} size="small" />
          </Stack>
        </Box>
      </Stack>
      {items.length === 0 ? (
        <Paper variant="outlined" sx={{ py: 5, px: 2, textAlign: 'center', borderStyle: 'dashed', borderRadius: 2 }}>
          <Inventory2OutlinedIcon color="disabled" sx={{ fontSize: 36 }} />
          <Typography fontWeight={800} sx={{ mt: 1 }}>No projects in this section</Typography>
          <Typography variant="body2" color="text.secondary">The board will place projects here when their print progress qualifies.</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
          {items.map((item) => (
            <CollectionBoardCard
              key={item.project_code}
              item={item}
              emailing={emailingCodes.includes(item.project_code)}
              onOpen={() => onOpen(item.project_code)}
              onEmail={() => onEmail(item)}
              onRelease={onRelease ? () => onRelease(item) : undefined}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

function CollectionBoardCard({ item, emailing, onOpen, onEmail, onRelease }: {
  item: HexForgeCollectionBoardItem
  emailing: boolean
  onOpen: () => void
  onEmail: () => void
  onRelease?: () => void
}) {
  const isHelpDesk = item.group === 'help_desk'
  const progress = item.total_parts > 0 ? Math.round((item.completed_parts / item.total_parts) * 100) : 0
  const statusLabel = item.state === 'PARTIALLY_COLLECTED'
    ? `${item.remaining_parts} part${item.remaining_parts === 1 ? '' : 's'} remaining`
    : isHelpDesk
      ? `${item.remaining_parts} part${item.remaining_parts === 1 ? '' : 's'} at desk`
      : `${item.completed_parts} of ${item.total_parts} printed`

  return (
    <Paper
      variant="outlined"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}
      sx={{
        p: 2,
        borderRadius: 2,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        '&:hover, &:focus-visible': { borderColor: isHelpDesk ? 'success.main' : 'primary.main', boxShadow: 3, outline: 'none' },
        '@media (prefers-reduced-motion: no-preference)': { '&:hover': { transform: 'translateY(-2px)' }, '&:hover .print-stack-image': { transform: 'rotate(-1deg) scale(1.02)' } }
      }}
    >
      <Stack spacing={1.75}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr)', gap: 2 }}>
          <Box sx={{ position: 'relative', width: 104, height: 104 }}>
            {item.total_parts > 1 && <><Box sx={{ position: 'absolute', inset: '7px -5px -5px 7px', borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }} /><Box sx={{ position: 'absolute', inset: '3px -2px -2px 3px', borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }} /></>}
            <Box className="print-stack-image" sx={{ position: 'relative', width: 104, height: 104, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'action.hover', display: 'grid', placeItems: 'center', transition: 'transform 180ms ease' }}>
              {item.thumbnail_url ? <Box component="img" src={item.thumbnail_url} alt={`${item.thumbnail_part_name || item.project_code} thumbnail`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Stack alignItems="center" spacing={0.5}><Inventory2OutlinedIcon color="disabled" /><Typography variant="caption" color="text.secondary">No image</Typography></Stack>}
            </Box>
            {item.total_parts > 1 && <Chip icon={<LayersOutlinedIcon />} label={item.total_parts} size="small" sx={{ position: 'absolute', right: -8, bottom: -8, fontWeight: 900 }} />}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Box>
                <Typography variant="overline" color="text.secondary" fontWeight={800}>Reference code</Typography>
                <Typography variant="h5" fontWeight={900}>{item.project_code}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={800}>Priority #{item.priority_number}</Typography>
              </Box>
              <Chip size="small" color={isHelpDesk ? (item.state === 'PARTIALLY_COLLECTED' ? 'info' : 'success') : 'primary'} label={isHelpDesk ? (item.state === 'PARTIALLY_COLLECTED' ? 'Partially collected' : 'At help desk') : 'Partially ready'} />
            </Stack>
            <Typography fontWeight={800} noWrap title={item.student_name}>{item.student_name}</Typography>
            <Typography variant="body2" color="text.secondary">{item.student_number}</Typography>
            {isHelpDesk && <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75, color: item.print_label ? 'success.dark' : 'warning.main' }}><LocationOnOutlinedIcon fontSize="small" /><Typography variant="body2" fontWeight={800} noWrap>{item.print_label || 'No location assigned'}</Typography></Stack>}
          </Box>
        </Box>
        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}><Typography variant="body2" fontWeight={800}>{statusLabel}</Typography><Typography variant="body2" color="text.secondary">{progress}% complete</Typography></Stack>
          <LinearProgress variant="determinate" value={progress} color={isHelpDesk ? 'success' : 'primary'} sx={{ height: 7, borderRadius: 99 }} />
        </Box>
        {item.payment_outstanding && <Alert severity="warning" variant="outlined" sx={{ py: 0 }}><Typography variant="caption" fontWeight={800}>Payment still needs attention</Typography></Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <Button variant="outlined" onClick={onOpen} fullWidth>Open details</Button>
          {isHelpDesk && <Button variant="contained" color="success" startIcon={emailing ? <CircularProgress size={15} color="inherit" /> : <EmailOutlinedIcon />} onClick={onEmail} disabled={emailing} fullWidth>{emailing ? 'Preparing' : 'Show email detail'}</Button>}
          {!isHelpDesk && item.all_parts_completed && onRelease && <Button variant="contained" startIcon={<MoveToInboxOutlinedIcon />} onClick={onRelease} fullWidth>Move to help desk</Button>}
        </Stack>
      </Stack>
    </Paper>
  )
}

function InfoBlock({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <Box sx={{ minWidth: 0 }}><Typography variant="caption" color="text.secondary" fontWeight={800}>{label}</Typography><Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>{detail && <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{detail}</Typography>}</Box>
}

function PartRow({ part, currency, disabled, collecting, onCollect, onPreview }: {
  part: HexForgeCollectionPart
  currency: string
  disabled: boolean
  collecting: boolean
  onCollect: () => void
  onPreview: () => void
}) {
  const collected = isCollectedPart(part)
  const collectable = canCollectPart(part) && !collected
  const hasMaterials = Boolean(part.primary_material || part.secondary_material)
  const hasIncompleteRecord = !part.thumbnail_url && !hasMaterials
  const materials = [
    part.primary_material ? `${part.primary_material}${part.primary_brand ? ` (${part.primary_brand})` : ''}: ${part.primary_estimated_weight || 0}g` : '',
    part.secondary_material ? `${part.secondary_material}${part.secondary_brand ? ` (${part.secondary_brand})` : ''}: ${part.secondary_estimated_weight || 0}g` : ''
  ].filter(Boolean)

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, display: 'grid', gridTemplateColumns: { xs: '72px minmax(0, 1fr)', md: '104px minmax(0, 1fr) auto' }, gap: 1.5, alignItems: 'center', bgcolor: collected ? 'success.lighter' : 'background.paper' }}>
      <Box component={part.thumbnail_url ? 'button' : 'div'} type={part.thumbnail_url ? 'button' : undefined} onClick={part.thumbnail_url ? onPreview : undefined} aria-label={part.thumbnail_url ? `Preview image for ${part.part_name}` : undefined} sx={{ width: { xs: 72, md: 104 }, height: { xs: 72, md: 104 }, p: 0, border: 0, cursor: part.thumbnail_url ? 'pointer' : 'default', borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
        {part.thumbnail_url ? <Box component="img" src={part.thumbnail_url} alt={`${part.part_name} thumbnail`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Stack spacing={0.25} alignItems="center"><Inventory2OutlinedIcon color="disabled" /><Typography variant="caption" color="text.secondary">No image</Typography></Stack>}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap"><Typography fontWeight={900}>{part.part_name}</Typography><Typography variant="caption" color="text.secondary">#{part.part_number}</Typography><Chip size="small" label={collectionStatusLabel(part)} color={printTone(part.print_status)} />{hasIncompleteRecord && <Chip size="small" label="Incomplete part record" color="warning" variant="outlined" />}</Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{hasMaterials ? materials.join(' | ') : 'Material details unavailable'}</Typography>
        {part.collection?.special_instruction && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>Note: {part.collection.special_instruction}</Typography>}
        {collected && <Typography variant="caption" color="success.dark" display="block" sx={{ mt: 0.5, fontWeight: 700 }}>Assisted by {part.collection?.collected_by || 'Unknown'}{part.collection?.collected_by_student_number ? ` · Collected by student ${part.collection.collected_by_student_number}` : ''}</Typography>}
      </Box>
      <Stack spacing={1} alignItems={{ xs: 'stretch', md: 'flex-end' }} sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}><Typography fontWeight={900}>{formatMoney(part.total_cost, currency)}</Typography>{collectable && <Button variant="contained" color="success" startIcon={collecting ? <CircularProgress size={16} color="inherit" /> : <LocalShippingIcon />} onClick={onCollect} disabled={disabled || collecting}>{collecting ? 'Collecting' : 'Collect part'}</Button>}</Stack>
    </Paper>
  )
}
