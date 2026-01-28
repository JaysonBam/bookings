import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Container,
  Snackbar,
  Alert,
  Grid,
  Switch,
  IconButton,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  LinearProgress
} from "@mui/material";
import { useLayout } from "../../components/LayoutContext";
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BuildIcon from '@mui/icons-material/Build';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import SchoolIcon from '@mui/icons-material/School';

type RoomRow = {
  id: number;
  name: string;
  max_people: number | null;
  min_people: number | null;
  borrowable_items?: string[] | null;
  dynamic_labels?: string[] | null;
  is_available?: boolean | null;
};

type CourseRow = {
  id: number;
  name: string;
  color_hex?: string | null;
};

export default function SettingsPage() {
  const { setHeaderContent } = useLayout();
  
  const [savingAll, setSavingAll] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  
  const [deletedRoomIds, setDeletedRoomIds] = useState<number[]>([]);
  const [deletedCourseIds, setDeletedCourseIds] = useState<number[]>([]);
  
  // Raw input map for array-like fields
  const [borrowableInputs, setBorrowableInputs] = useState<Record<number, string>>({});

  // Settings state
  const [opStart, setOpStart] = useState("08:00");
  const [opEnd, setOpEnd] = useState("17:00");
  const [testingEnabled, setTestingEnabled] = useState(false);
  const [testingDate, setTestingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [testingTime, setTestingTime] = useState(() => new Date().toTimeString().slice(0, 5));

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    setHeaderContent(
      <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
        System Settings
      </Typography>
    );
    loadAll();
  }, [setHeaderContent]);

  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

  async function loadAll() {
    await Promise.all([fetchRooms(), fetchCourses(), fetchSettings()]);
  }

  async function fetchRooms() {
    setLoadingRooms(true);
    const { data, error } = await supabase.from("rooms").select("*");
    setLoadingRooms(false);
    if (error) {
      setSnackbar({ open: true, message: "Failed to load rooms: " + error.message, severity: "error" });
      return;
    }
    const rows = ((data ?? []) as RoomRow[]).sort((a, b) => a.name.localeCompare(b.name));
    setRooms(rows);

    const borrowMap: Record<number, string> = {};
    rows.forEach((r) => {
      borrowMap[r.id] = (r.borrowable_items ?? []).join(", ");
    });
    setBorrowableInputs(borrowMap);
  }

  async function fetchCourses() {
    setLoadingCourses(true);
    const { data, error } = await supabase.from("courses").select("*");
    setLoadingCourses(false);
    if (error) {
       setSnackbar({ open: true, message: "Failed to load courses: " + error.message, severity: "error" });
      return;
    }
    setCourses(((data ?? []) as CourseRow[]).sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function fetchSettings() {
    const { data: hoursData } = await supabase.from("settings").select("value").eq("key", "operation_hours").single();
    if (hoursData?.value) {
      const v = hoursData.value as any;
      if (v.start) setOpStart(v.start);
      if (v.end) setOpEnd(v.end);
    }

    const { data: testData } = await supabase.from("settings").select("value").eq("key", "testing_clock").single();
    if (testData?.value) {
      const v = testData.value as any;
      if (typeof v.enabled === "boolean") setTestingEnabled(!!v.enabled);
      if (v.date) setTestingDate(v.date);
      if (v.time) setTestingTime(v.time);
    }
  }

  async function createCourse(name: string, color_hex?: string) {
    const tempId = -Date.now() - Math.floor(Math.random() * 1000);
    setCourses((s) => [...s, { id: tempId, name, color_hex: color_hex ?? null }]);
  }

  async function deleteCourse(id: number) {
    setCourses((s) => s.filter((c) => c.id !== id));
    if (id > 0) setDeletedCourseIds((s) => [...s, id]);
  }

  async function deleteRoom(id: number) {
    setRooms((s) => s.filter((r) => r.id !== id));
    setBorrowableInputs((s) => {
      const copy = { ...s };
      delete copy[id];
      return copy;
    });
    if (id > 0) setDeletedRoomIds((s) => [...s, id]);
  }

  function handleToggleRoomField(id: number, field: "is_available", value: boolean) {
    setRooms((s) => s.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function createRoom(payload: {
    name: string;
    max_people?: number | null;
    min_people?: number | null;
    borrowable_items?: string[] | null;
    dynamic_labels?: string[] | null;
    is_available?: boolean | null;
  }) {
    const tempId = -Date.now() - Math.floor(Math.random() * 1000);
    const newRoom: RoomRow = {
      id: tempId,
      name: payload.name,
      max_people: payload.max_people ?? null,
      min_people: payload.min_people ?? null,
      borrowable_items: payload.borrowable_items ?? null,
      dynamic_labels: payload.dynamic_labels ?? null,
      is_available: payload.is_available ?? null,
    };
    setRooms((s) => [...s, newRoom]);
    setBorrowableInputs((s) => ({ ...s, [newRoom.id]: (newRoom.borrowable_items ?? []).join(", ") }));
  }

  async function saveAllRooms() {
    setSavingAll(true);
    try {
      if (deletedRoomIds.length) await supabase.from("rooms").delete().in("id", deletedRoomIds);
      if (deletedCourseIds.length) await supabase.from("courses").delete().in("id", deletedCourseIds);

      const newRooms = rooms.filter((r) => r.id < 0);
      const existingRooms = rooms.filter((r) => r.id > 0);

      await Promise.all(
        existingRooms.map(async (row) => {
          const rawBorrow = borrowableInputs[row.id];
          const parsedBorrow = rawBorrow !== undefined
              ? rawBorrow.split(",").map((s) => s.trim()).filter(Boolean)
              : row.borrowable_items ?? null;
          
          const payload: any = {
            name: row.name,
            max_people: row.max_people ?? null,
            min_people: row.min_people ?? null,
            borrowable_items: Array.isArray(parsedBorrow) ? (parsedBorrow.length ? parsedBorrow : null) : null,
            dynamic_labels: row.dynamic_labels ?? null,
            is_available: row.is_available ?? null,
          };
          await supabase.from("rooms").update(payload).eq("id", row.id);
        })
      );

      if (newRooms.length) {
        const insertPayloads = newRooms.map((row) => {
          const rawBorrow = borrowableInputs[row.id];
          const parsedBorrow = rawBorrow !== undefined
              ? rawBorrow.split(",").map((s) => s.trim()).filter(Boolean)
              : row.borrowable_items ?? null;
          return {
            name: row.name,
            max_people: row.max_people ?? null,
            min_people: row.min_people ?? null,
            borrowable_items: Array.isArray(parsedBorrow) ? (parsedBorrow.length ? parsedBorrow : null) : null,
            dynamic_labels: row.dynamic_labels ?? null,
            is_available: row.is_available ?? null,
          };
        });
        await supabase.from("rooms").insert(insertPayloads);
      }

      const newCourses = courses.filter((c) => c.id < 0);
      const existingCourses = courses.filter((c) => c.id > 0);

      await Promise.all(
        existingCourses.map(async (course) => {
           await supabase.from("courses").update({ name: course.name, color_hex: course.color_hex ?? null }).eq("id", course.id);
        })
      );

      if (newCourses.length) {
         await supabase.from("courses").insert(newCourses.map((c) => ({ name: c.name, color_hex: c.color_hex ?? null })));
      }

      const hoursPayload = { start: opStart, end: opEnd };
      await supabase.from("settings").upsert({ key: "operation_hours", value: hoursPayload });

      const testingPayload = { enabled: testingEnabled, date: testingDate, time: testingTime };
      await supabase.from("settings").upsert({ key: "testing_clock", value: testingPayload });

      await Promise.all([fetchRooms(), fetchCourses()]);
      setDeletedRoomIds([]);
      setDeletedCourseIds([]);
      setSnackbar({ open: true, message: "All settings saved successfully", severity: "success" });
    } catch (err: any) {
      setSnackbar({ open: true, message: "Error saving settings: " + err.message, severity: "error" });
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100%", pb: { xs: 8, md: 12 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 1, md: 3 }, pt: { xs: 2, md: 3 } }}>
        {/* Sticky Utility Bar */}
        <Paper 
          sx={{ 
            p: { xs: 1.5, md: 2 }, 
            position: 'sticky', 
            top: 0, 
            zIndex: 10, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: { xs: 2, md: 3 },
            mt: 0 
          }}
          elevation={2}
          square
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold">Configuration</Typography>
            {savingAll && <Typography variant="caption" color="text.secondary">Saving changes...</Typography>}
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={saveAllRooms}
            disabled={savingAll}
          >
            Save All Changes
          </Button>
        </Paper>

        <Grid container spacing={3}>
          {/* General Settings */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <AccessTimeIcon color="action" />
                <Typography variant="h6">Operation Hours</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  label="Start Time"
                  type="time"
                  value={opStart}
                  onChange={(e) => setOpStart(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="End Time"
                  type="time"
                  value={opEnd}
                  onChange={(e) => setOpEnd(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  size="small"
                />
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
               <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <BuildIcon color="action" />
                <Typography variant="h6">Clock Testing Mode</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Enable Testing Clock</Typography>
                    <Switch 
                        checked={testingEnabled} 
                        onChange={(e) => setTestingEnabled(e.target.checked)} 
                    />
                </Box>
                <Stack direction="row" spacing={2}>
                    <TextField
                    label="Test Date"
                    type="date"
                    value={testingDate}
                    onChange={(e) => setTestingDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    disabled={!testingEnabled}
                    fullWidth
                    size="small"
                    />
                    <TextField
                    label="Test Time"
                    type="time"
                    value={testingTime}
                    onChange={(e) => setTestingTime(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    disabled={!testingEnabled}
                    fullWidth
                    size="small"
                    />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                    Use this to override the system clock for testing scheduling features.
                </Typography>
              </Stack>
            </Paper>
          </Grid>

          {/* Rooms Management */}
          <Grid item xs={12}>
             <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <MeetingRoomIcon />
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>Rooms Management</Typography>
                </Box>
                <Divider />
                {loadingRooms && <LinearProgress />}
                <TableContainer sx={{ maxHeight: 600 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell width={100}>Max People</TableCell>
                                <TableCell width={100}>Min People</TableCell>
                                <TableCell>Borrowable Items</TableCell>
                                <TableCell align="center" width={100}>Available</TableCell>
                                <TableCell align="right" width={80}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rooms.map((r) => (
                                <TableRow key={r.id} hover>
                                    <TableCell>
                                        <TextField 
                                            value={r.name} 
                                            onChange={(e) => setRooms((s) => s.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))}
                                            size="small" 
                                            variant="standard"
                                            fullWidth
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField 
                                            type="number"
                                            value={r.max_people ?? ""} 
                                            onChange={(e) => setRooms((s) => s.map((x) => (x.id === r.id ? { ...x, max_people: e.target.value ? Number(e.target.value) : null } : x)))}
                                            size="small" 
                                            variant="standard"
                                            fullWidth
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField 
                                            type="number"
                                            value={r.min_people ?? ""} 
                                            onChange={(e) => setRooms((s) => s.map((x) => (x.id === r.id ? { ...x, min_people: e.target.value ? Number(e.target.value) : null } : x)))}
                                            size="small" 
                                            variant="standard"
                                            fullWidth
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            value={borrowableInputs[r.id] ?? (r.borrowable_items ?? []).join(", ")}
                                            onChange={(e) => setBorrowableInputs((s) => ({ ...s, [r.id]: e.target.value }))}
                                            onBlur={(e) => {
                                                const parsed = e.target.value
                                                .split(",")
                                                .map((s) => s.trim())
                                                .filter(Boolean);
                                                setRooms((s) => s.map((x) => (x.id === r.id ? { ...x, borrowable_items: parsed.length ? parsed : null } : x)));
                                                setBorrowableInputs((s) => ({ ...s, [r.id]: parsed.join(", ") }));
                                            }}
                                            placeholder="e.g. Projector, PC"
                                            size="small"
                                            variant="standard"
                                            fullWidth
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Checkbox 
                                            checked={!!r.is_available} 
                                            onChange={(e) => handleToggleRoomField(r.id, "is_available", e.target.checked)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" color="error" onClick={() => deleteRoom(r.id)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            <NewRoomRow onCreate={createRoom} />
                        </TableBody>
                    </Table>
                </TableContainer>
             </Paper>
          </Grid>

          {/* Courses Management */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ width: '100%', overflow: 'hidden', height: '100%' }}>
                <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                     <SchoolIcon />
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>Courses</Typography>
                </Box>
                <Divider />
                {loadingCourses && <LinearProgress />}
                <TableContainer sx={{ maxHeight: 400 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Course Name</TableCell>
                                <TableCell width={100}>Color</TableCell>
                                <TableCell align="right" width={80}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {courses.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell>
                                        <TextField
                                            value={c.name}
                                            onChange={(e) => setCourses((s) => s.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                                            size="small"
                                            variant="standard"
                                            fullWidth
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <input 
                                                type="color" 
                                                value={c.color_hex ?? "#000000"} 
                                                onChange={(e) => setCourses((s) => s.map((x) => (x.id === c.id ? { ...x, color_hex: e.target.value } : x)))}
                                                style={{ border: 'none', width: '30px', height: '30px', cursor: 'pointer', backgroundColor: 'transparent' }}
                                            />
                                            <Typography variant="caption">{c.color_hex}</Typography>
                                        </Box>
                                    </TableCell>
                                     <TableCell align="right">
                                        <IconButton size="small" color="error" onClick={() => deleteCourse(c.id)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            <NewCourseRow onCreate={createCourse} />
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
          </Grid>
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

function NewRoomRow({ onCreate }: { onCreate: (payload: any) => Promise<void> }) {
  const [name, setName] = useState("");
  const [maxPeople, setMaxPeople] = useState<string>("");
  const [minPeople, setMinPeople] = useState<string>("");
  const [borrowable, setBorrowable] = useState<string>("");
  const [isAvailable, setIsAvailable] = useState<boolean>(true);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await onCreate({
      name: name.trim(),
      max_people: maxPeople ? Number(maxPeople) : null,
      min_people: minPeople ? Number(minPeople) : null,
      borrowable_items: borrowable ? borrowable.split(",").map((s) => s.trim()).filter(Boolean) : null,
      is_available: isAvailable,
    });
    setName("");
    setMaxPeople("");
    setMinPeople("");
    setBorrowable("");
    setIsAvailable(true);
  };

  return (
    <TableRow sx={{ bgcolor: 'action.hover' }}>
        <TableCell>
            <TextField 
                placeholder="New Room Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                size="small"
                variant="outlined"
                fullWidth
            />
        </TableCell>
        <TableCell>
            <TextField
                type="number"
                placeholder="Max"
                value={maxPeople}
                onChange={(e) => setMaxPeople(e.target.value)}
                size="small"
                variant="outlined"
                fullWidth
            />
        </TableCell>
        <TableCell>
            <TextField
                type="number"
                placeholder="Min"
                value={minPeople}
                onChange={(e) => setMinPeople(e.target.value)}
                size="small"
                variant="outlined"
                fullWidth
            />
        </TableCell>
         <TableCell>
            <TextField
                placeholder="Items (comma separated)"
                value={borrowable}
                onChange={(e) => setBorrowable(e.target.value)}
                size="small"
                variant="outlined"
                fullWidth
            />
        </TableCell>
        <TableCell align="center">
            <Checkbox checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} size="small" />
        </TableCell>
        <TableCell align="right">
            <Button 
                variant="contained" 
                size="small" 
                onClick={handleCreate}
                disabled={!name.trim()}
                sx={{ minWidth: 0, p: 1 }}
            >
                <AddIcon fontSize="small" />
            </Button>
        </TableCell>
    </TableRow>
  );
}

function NewCourseRow({ onCreate }: { onCreate: (name: string, color?: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#000000");

  const handleCreate = () => {
     if (name.trim()) { 
        onCreate(name.trim(), color); 
        setName(""); 
        setColor("#000000"); 
    }
  };

  return (
    <TableRow sx={{ bgcolor: 'action.hover' }}>
         <TableCell>
            <TextField 
                placeholder="New Course Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                size="small"
                variant="outlined"
                fullWidth
            />
        </TableCell>
        <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input 
                    type="color" 
                    value={color} 
                    onChange={(e) => setColor(e.target.value)}
                    style={{ border: 'none', width: '30px', height: '30px', cursor: 'pointer', backgroundColor: 'transparent' }}
                />
            </Box>
        </TableCell>
        <TableCell align="right">
            <Button 
                variant="contained" 
                size="small" 
                onClick={handleCreate}
                disabled={!name.trim()}
                sx={{ minWidth: 0, p: 1 }}
            >
                <AddIcon fontSize="small" />
            </Button>
        </TableCell>
    </TableRow>
  );
}
