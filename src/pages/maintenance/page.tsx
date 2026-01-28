import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  Box,
  Typography,
  Snackbar,
  Alert,
  Grid,
  Container,
  Skeleton,
  Paper,
  Button,
  Chip,
  Card,
  CardContent
} from "@mui/material";
import { useLayout } from "../../components/LayoutContext";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface Room {
  id: number;
  name: string;
  dynamic_labels: string[] | null;
}

const MAINTENANCE_ISSUES = [
  { label: "Lights", emoji: "💡", color: 'warning' as const },
  { label: "Plugs", emoji: "🔌", color: 'error' as const },
  { label: "Screen", emoji: "🖥️", color: 'info' as const },
];

export default function MaintenancePage() {
  const { setHeaderContent } = useLayout();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string, severity: 'success' | 'error'}>({
    open: false,
    message: '',
    severity: 'success'
  });

  const handleCloseSnackbar = () => setSnackbar({...snackbar, open: false});

  const showMessage = (message: string, severity: 'success' | 'error') => {
      setSnackbar({ open: true, message, severity });
  };

  useEffect(() => {
    setHeaderContent(
      <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
        Room Maintenance
      </Typography>
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name, dynamic_labels")
        .order("name");

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      showMessage("Failed to load rooms", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleIssue = async (roomId: number, issueLabel: string, issueEmoji: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    const fullLabel = `${issueLabel} ${issueEmoji}`;
    const currentLabels = room.dynamic_labels || [];
    const hasIssue = currentLabels.includes(fullLabel);

    let newLabels: string[];
    if (hasIssue) {
      newLabels = currentLabels.filter((l) => l !== fullLabel);
    } else {
      newLabels = [...currentLabels, fullLabel];
    }

    // Optimistic update
    setRooms(rooms.map((r) => (r.id === roomId ? { ...r, dynamic_labels: newLabels } : r)));

    try {
      const { error } = await supabase
        .from("rooms")
        .update({ dynamic_labels: newLabels })
        .eq("id", roomId);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating room:", error);
      showMessage("Failed to update room", "error");
      // Revert on error
      setRooms(rooms.map((r) => (r.id === roomId ? { ...r, dynamic_labels: currentLabels } : r)));
    }
  };

  // Stats
  const totalRooms = rooms.length;
  const roomsWithIssues = rooms.filter(r => r.dynamic_labels && r.dynamic_labels.length > 0).length;
  const totalIssues = rooms.reduce((acc, r) => acc + (r.dynamic_labels?.length || 0), 0);

  if (loading) {
    return (
        <Container maxWidth="xl" sx={{ pt: 2 }}>
             <Skeleton variant="rectangular" height={100} sx={{ mb: 4, borderRadius: 2 }} />
             <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
        </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100%', pb: { xs: 8, md: 12 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 1, md: 3 }, pt: { xs: 2, md: 3 } }}>
        
        {/* Summary Stats */}
        <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
            <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <Box>
                         <Typography color="text.secondary" variant="caption" fontWeight="bold" textTransform="uppercase">Total Rooms</Typography>
                         <Typography variant="h5" fontWeight="bold">{totalRooms}</Typography>
                     </Box>
                     <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                         <Typography variant="h4">🏢</Typography>
                     </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} md={4}>
                 <Card variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: roomsWithIssues > 0 ? 'warning.lighter' : 'success.lighter', borderColor: roomsWithIssues > 0 ? 'warning.light' : 'success.light' }}>
                     <Box>
                         <Typography color={roomsWithIssues > 0 ? "warning.dark" : "success.dark"} variant="caption" fontWeight="bold" textTransform="uppercase">Needs Attention</Typography>
                         <Typography variant="h5" fontWeight="bold" color={roomsWithIssues > 0 ? "warning.main" : "success.main"}>{roomsWithIssues}</Typography>
                     </Box>
                     <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                         {roomsWithIssues > 0 ? <WarningAmberIcon sx={{ fontSize: 32, color: 'warning.main' }} /> : <CheckCircleIcon sx={{ fontSize: 32, color: 'success.main' }} />}
                     </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <Box>
                         <Typography color="text.secondary" variant="caption" fontWeight="bold" textTransform="uppercase">Total Issues</Typography>
                         <Typography variant="h5" fontWeight="bold">{totalIssues}</Typography>
                     </Box>
                     <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                         <Typography variant="h4">🚩</Typography>
                     </CardContent>
                </Card>
            </Grid>
        </Grid>

        <Grid container spacing={2}>
            {rooms.map((room) => {
                const hasIssues = room.dynamic_labels && room.dynamic_labels.length > 0;
                return (
                    <Grid item xs={12} md={6} xl={4} key={room.id}>
                        <Paper variant="outlined" sx={{ p: 1.5, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="body1" fontWeight="bold">{room.name}</Typography>
                                {hasIssues ? (
                                    <Chip 
                                        label="Review" 
                                        color="warning" 
                                        size="small" 
                                        variant="outlined" 
                                        icon={<WarningAmberIcon sx={{ fontSize: '1rem !important' }} />}
                                        sx={{ height: 24, px: 0.5 }}
                                    />
                                ) : (
                                    <Chip 
                                        label="OK" 
                                        color="success" 
                                        size="small" 
                                        variant="outlined" 
                                        icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />}
                                        sx={{ height: 24, px: 0.5 }}
                                    />
                                )}
                            </Box>
                            
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                {MAINTENANCE_ISSUES.map((issue) => {
                                    const fullLabel = `${issue.label} ${issue.emoji}`;
                                    const isChecked = room.dynamic_labels?.includes(fullLabel) || false;
                                    
                                    return (
                                        <Button
                                            key={issue.label}
                                            variant={isChecked ? "contained" : "outlined"}
                                            color={isChecked ? issue.color : "inherit"}
                                            onClick={() => toggleIssue(room.id, issue.label, issue.emoji)}
                                            sx={{ 
                                                minWidth: 36, 
                                                height: 36,
                                                borderRadius: 1,
                                                p: 0,
                                                color: isChecked ? 'white' : 'text.disabled',
                                                borderColor: isChecked ? 'transparent' : 'divider',
                                                '&:hover': {
                                                    borderColor: isChecked ? 'transparent' : 'text.primary',
                                                }
                                            }}
                                            title={issue.label}
                                        >
                                            <Typography sx={{ fontSize: '1.1rem', lineHeight: 1, filter: isChecked ? 'none' : 'grayscale(100%) opacity(0.5)' }}>{issue.emoji}</Typography>
                                        </Button>
                                    );
                                })}
                            </Box>
                        </Paper>
                    </Grid>
                );
            })}
        </Grid>

      </Container>
      
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
