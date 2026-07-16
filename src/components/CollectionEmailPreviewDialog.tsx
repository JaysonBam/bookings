import { useMemo } from 'react'
import {
  Avatar,
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import type { HexForgeCollectionEmailDraft } from '../lib/hexForgeCollectionClient'

export type CollectionEmailPreviewData = {
  draft: HexForgeCollectionEmailDraft
}

type CollectionEmailPreviewDialogProps = {
  data: CollectionEmailPreviewData | null
  onClose: () => void
  onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void
}

const sanitizeEmailHtml = (html: string) => {
  const documentNode = new DOMParser().parseFromString(html, 'text/html')
  documentNode.querySelectorAll('script, iframe, object, embed, form, input, button, img, meta, base, link').forEach((node) => node.remove())
  documentNode.body.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on') || name === 'srcdoc') element.removeAttribute(attribute.name)
      if ((name === 'href' || name === 'src') && !/^(https?:|mailto:|data:image\/)/i.test(value)) element.removeAttribute(attribute.name)
      if (name === 'style' && /(expression\s*\(|javascript:|url\s*\()/i.test(value)) element.removeAttribute(attribute.name)
    })
    if (element.tagName === 'A') {
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noopener noreferrer')
    }
  })
  return documentNode.body.innerHTML
}

const plainTextToHtml = (value: string) => {
  const container = document.createElement('div')
  container.textContent = value
  return container.innerHTML.replace(/\r?\n/g, '<br>')
}

function CopyIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip title={`Copy ${label.toLowerCase()}`}>
      <IconButton aria-label={`Copy ${label.toLowerCase()}`} onClick={onClick} size="small" sx={{ color: '#52637a', '&:hover': { color: '#245db5', bgcolor: '#edf3ff' } }}>
        <ContentCopyOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
}

export default function CollectionEmailPreviewDialog({ data, onClose, onNotify }: CollectionEmailPreviewDialogProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const htmlBody = useMemo(() => {
    if (!data) return ''
    return sanitizeEmailHtml(data.draft.html_body || plainTextToHtml(data.draft.body))
  }, [data])

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      onNotify(`${label} copied.`)
    } catch (error) {
      console.error(`Failed to copy ${label.toLowerCase()}:`, error)
      onNotify(`Could not copy ${label.toLowerCase()}.`, 'error')
    }
  }

  const copyRichBody = async () => {
    if (!data) return
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([htmlBody], { type: 'text/html' }),
          'text/plain': new Blob([data.draft.body], { type: 'text/plain' })
        })])
      } else {
        await navigator.clipboard.writeText(data.draft.body)
      }
      onNotify('Formatted email body copied.')
    } catch (error) {
      console.error('Failed to copy formatted email body:', error)
      onNotify('Could not copy the email body.', 'error')
    }
  }

  return (
    <Dialog
      open={Boolean(data)}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          overflow: 'hidden',
          borderRadius: fullScreen ? 0 : 3,
          maxHeight: fullScreen ? '100dvh' : '90dvh',
          bgcolor: '#e9eef6',
          boxShadow: '0 30px 90px rgba(5, 15, 35, 0.42)'
        }
      }}
    >
      <Box component="header" sx={{ bgcolor: '#17243a', color: '#fff', px: { xs: 2, sm: 3 }, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
          <Avatar sx={{ width: 38, height: 38, bgcolor: '#4f8cff', color: '#fff' }}><EmailOutlinedIcon fontSize="small" /></Avatar>
          <Box minWidth={0}>
            <Typography variant="h6" fontWeight={850} noWrap>Message preview</Typography>
          </Box>
        </Stack>
        <IconButton aria-label="Close email preview" onClick={onClose} sx={{ color: '#fff', bgcolor: alpha('#fff', 0.06), '&:hover': { bgcolor: alpha('#fff', 0.14) } }}><CloseIcon /></IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 0, sm: 2.5 }, overflowY: 'auto' }}>
        {data && (
          <Paper elevation={0} sx={{ maxWidth: 760, mx: 'auto', overflow: 'hidden', borderRadius: { xs: 0, sm: 2.5 }, border: { xs: 0, sm: '1px solid #d7dfeb' }, bgcolor: '#fff', color: '#172033' }}>
            <Box sx={{ px: { xs: 2, sm: 3.5 }, pt: 2.5, pb: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
                <Box minWidth={0}><Typography variant="caption" fontWeight={800} sx={{ color: '#52637a', letterSpacing: '0.06em' }}>TO</Typography><Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>{data.draft.to}</Typography></Box>
                <CopyIconButton label="Recipient" onClick={() => void copyText(data.draft.to, 'Recipient')} />
              </Stack>
            </Box>

            <Box sx={{ position: 'relative', borderTop: '1px dashed #bcc8d8', '&::before, &::after': { content: '""', position: 'absolute', top: -9, width: 18, height: 18, borderRadius: '50%', bgcolor: '#e9eef6' }, '&::before': { left: -9 }, '&::after': { right: -9 } }} />

            <Box sx={{ px: { xs: 2, sm: 3.5 }, py: 2.25, bgcolor: '#fbfcfe' }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
                <Box minWidth={0}><Typography variant="caption" fontWeight={800} sx={{ color: '#52637a', letterSpacing: '0.06em' }}>SUBJECT</Typography><Typography variant="h6" fontWeight={850} sx={{ mt: 0.3, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{data.draft.subject}</Typography></Box>
                <CopyIconButton label="Subject" onClick={() => void copyText(data.draft.subject, 'Subject')} />
              </Stack>
            </Box>

            <Box sx={{ px: { xs: 2, sm: 3.5 }, pt: 2.5, pb: 3.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ mb: 2.25 }}>
                <Typography variant="caption" fontWeight={800} sx={{ color: '#52637a', letterSpacing: '0.06em' }}>BODY</Typography>
                <CopyIconButton label="Formatted body" onClick={() => void copyRichBody()} />
              </Stack>
              <Box
                sx={{
                  color: '#202124',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: 15,
                  lineHeight: 1.62,
                  overflowWrap: 'anywhere',
                  '& p': { mt: 0, mb: 1.6 },
                  '& a': { color: '#1967d2', textDecorationColor: alpha('#1967d2', 0.4), textUnderlineOffset: 2 },
                  '& .email-signature-break': { display: 'none' }
                }}
                dangerouslySetInnerHTML={{ __html: htmlBody }}
              />
            </Box>
          </Paper>
        )}
      </DialogContent>
    </Dialog>
  )
}
