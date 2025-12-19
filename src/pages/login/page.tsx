import { Box, Button, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
	const navigate = useNavigate()

	return (
		<Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
			<Typography variant="h5">Please sign in</Typography>
			<Button variant="contained" onClick={() => navigate('/bookings')}>
				Sign in
			</Button>
		</Box>
	)
}
