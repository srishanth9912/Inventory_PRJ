# IFB Stock & Sales

Simple cloud-based stock and sales tracker for **2 products only**:
- IFB Liquid Detergent
- IFB Descal

Built for mobile. Designed for non-technical users. Everything is stored in **MongoDB Atlas** (cloud). No offline mode.

## Setup

### 1. MongoDB Atlas (required)
1. Create a free account at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Create a database user + password
4. In Network Access → allow access from anywhere (or your IP)
5. Click **Connect** → Drivers → copy the connection string

### 2. Server
```bash
cd server
cp .env.example .env
# Edit .env and paste your MongoDB URI + set a secret API_KEY
npm install
npm start
```

### 3. Client
```bash
cd client
cp .env.example .env
# Set VITE_API_URL=http://localhost:8787
# Set VITE_API_KEY=same-key-as-server
npm install
npm run dev
```

Open the URL shown (usually http://localhost:5173). Use on mobile for best experience.

## Features
- Clear home dashboard with simple numbers
- Add stock (box or piece) – fully editable
- Create sale with **one or both products** in a single entry
- Optional phone number + sale notes
- Product-wise stock, sales & revenue
- Mobile-friendly clean UI

## Product photos
Replace the SVG files in `client/public/products/` with real product photos (same file names) if you have rights to use them.
