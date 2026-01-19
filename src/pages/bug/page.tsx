import { useState, useEffect, FormEvent } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Snackbar,
  Alert,
  Grid,
  Stack,
  Container
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { useLayout } from "../../components/LayoutContext";

interface Bug {
  id: number;
  created_at: string;
  description: string;
  reporter_name: string;
  upvotes: number;
  status: "new" | "acknowledged" | "fixed";
  admin_update: string | null;
}

export default function BugPage() {
  const { setHeaderContent } = useLayout();
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("not_fixed");
  
  // Form state
  const [description, setDescription] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const fetchBugs = async () => {
    setLoading(true);
    let query = supabase
      .from("bugs")
      .select("*")
      .order("upvotes", { ascending: false });

    if (filterStatus === "not_fixed") {
      query = query.in("status", ["new", "acknowledged"]);
    } else if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching bugs:", error);
      showMessage("Failed to load bugs.", "error");
    } else {
      setBugs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    setHeaderContent(
      <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
        Report a Bug
      </Typography>
    );
    return () => setHeaderContent(null);
  }, []);

  useEffect(() => {
    fetchBugs();
  }, [filterStatus]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !reporterName.trim()) {
      showMessage("Please fill in all fields.", "error");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("bugs").insert([
      {
        description: description.trim(),
        reporter_name: reporterName.trim(),
      },
    ]);

    if (error) {
        console.error("Error reporting bug:", error);
        showMessage("Failed to report bug.", "error");
    } else {
        showMessage("Bug reported successfully.", "success");
        setDescription("");
        setReporterName("");
        fetchBugs();
    }
    setSubmitting(false);
  };

  const handleUpvote = async (bugId: number) => {
    const { error } = await supabase.rpc("increment_bug_upvotes", {
      bug_id: bugId,
    });

    if (error) {
      console.error("Error upvoting:", error);
      showMessage("Failed to upvote.", "error");
    } else {
      showMessage("Thank you for your feedback!", "success");
      fetchBugs();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "fixed":
        return "success";
      case "acknowledged":
        return "warning";
      default:
        return "default"; // or "primary" for new
    }
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100%' }}>
      
      <Container maxWidth="xl">
        <Grid container spacing={4} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                    <CardHeader title="Feedback" />
                    <CardContent>
                         <Typography variant="body1" paragraph color="text.secondary">
                            Feel free to report any logic errors, glitches, or general issues
                            you encounter. I also welcome suggestions for improvements or new
                            features you'd like to see.
                        </Typography>
                        <Typography variant="body1" paragraph color="text.secondary">
                            Before submitting a new report, please check if the issue has
                            already been listed below and upvote it if you'd like to
                            prioritize it.
                        </Typography>
                        <Typography variant="body1" paragraph color="text.secondary">
                            I ask for your name so that I can reach out for more details if
                            needed. If you find it difficult to explain the issue here, you
                            can also speak directly to Jayson.
                        </Typography>
                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                            Note: Some feature requests and suggested changes will be evaluated by
                            management and staff for consideration.
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                    <CardHeader title="Submit a New Bug Report" />
                    <CardContent>
                        <form onSubmit={handleSubmit}>
                            <Stack spacing={3}>
                                <TextField
                                    label="Your Name"
                                    placeholder="Enter your name"
                                    value={reporterName}
                                    onChange={(e) => setReporterName(e.target.value)}
                                    fullWidth
                                    variant="outlined"
                                />
                                <TextField
                                    label="Bug Description"
                                    placeholder="Describe the bug..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    multiline
                                    rows={4}
                                    fullWidth
                                    variant="outlined"
                                />
                                <Button 
                                    type="submit" 
                                    variant="contained" 
                                    disabled={submitting}
                                >
                                    {submitting ? "Submitting..." : "Submit Report"}
                                </Button>
                            </Stack>
                        </form>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>

        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h5" fontWeight="bold">Existing Issues</Typography>
            <FormControl sx={{ width: 200 }} size="small">
                <InputLabel>Filter by status</InputLabel>
                <Select
                    value={filterStatus}
                    label="Filter by status"
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <MenuItem value="not_fixed">New & Acknowledged</MenuItem>
                    <MenuItem value="all">All Statuses</MenuItem>
                    <MenuItem value="new">New</MenuItem>
                    <MenuItem value="acknowledged">Acknowledged</MenuItem>
                    <MenuItem value="fixed">Fixed</MenuItem>
                </Select>
            </FormControl>
        </Box>

        <TableContainer component={Paper} variant="outlined">
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell width={50}>ID</TableCell>
                        <TableCell width={100}>Upvotes</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell width={150}>Reporter</TableCell>
                        <TableCell width={200}>Admin Update</TableCell>
                        <TableCell width={100}>Status</TableCell>
                        <TableCell width={120}>Action</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                                Loading...
                            </TableCell>
                        </TableRow>
                    ) : bugs.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                                No bugs found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        bugs.map((bug) => (
                            <TableRow key={bug.id}>
                                <TableCell>{bug.id}</TableCell>
                                <TableCell>{bug.upvotes}</TableCell>
                                <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{bug.description}</TableCell>
                                <TableCell>{bug.reporter_name}</TableCell>
                                <TableCell sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                    {bug.admin_update || "-"}
                                </TableCell>
                                <TableCell>
                                    <Chip 
                                        label={bug.status} 
                                        color={getStatusColor(bug.status) as any} 
                                        size="small" 
                                        variant="outlined"
                                        sx={{ textTransform: 'capitalize' }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="text"
                                        size="small"
                                        onClick={() => handleUpvote(bug.id)}
                                        disabled={bug.status === "fixed"}
                                        startIcon={<ArrowUpwardIcon />}
                                    >
                                        Upvote
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </TableContainer>

      </Container>
      
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
