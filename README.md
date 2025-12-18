## Bookings App

### Tech Stack
- **Frontend:** React (TypeScript, Vite)
- **Authentication:** Google Auth (via Supabase)
- **Backend/Database:** Supabase
- **Deployment:** Vercel

---

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher)
- Supabase project (with Google Auth enabled)
- Vercel account (for deployment)

---

### Setup & Run Locally
1. **Clone the repository:**
	```bash
	git clone <repo-url>
	cd bookings
	```
2. **Install dependencies:**
	```bash
	npm install
	```
3. **Configure environment variables:**
	- Create a `.env` file in the root directory.
	- Add your Supabase project URL and anon/public key, e.g.:
	  ```env
	  VITE_SUPABASE_URL=your-supabase-url
	  VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
	  ```
4. **Run the development server:**
	```bash
	npm run dev
	```
5. **Access the app:**
	- Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Google Auth & Supabase
- Google authentication is handled via Supabase Auth.
- Ensure you have enabled Google Auth in your Supabase project and configured the correct redirect URLs.

---

### Deployment
- The app is deployed on [Vercel](https://vercel.com/).
- Push to the main branch to trigger deployment (if connected to Vercel).