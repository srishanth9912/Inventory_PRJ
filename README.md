# IFB Stock & Sales

Simple cloud-based stock and sales tracker for **2 products only**:
- IFB Liquid Detergent
- IFB Descal

Built for mobile. Designed for non-technical users. Exclusively web-based: all data is stored directly in **MongoDB Atlas** (cloud). Local databases are not used.

## Features
- **Cloud Database (MongoDB Atlas)**: All data lives securely in the cloud, accessible across multiple devices.
- **Real-Time Live Auto-Update**: Background sync automatically updates inventory, sales, and analytics every 8 seconds and whenever the app/tab gains focus.
- **Atomic Stock Management**: Safe piece-level stock deductions with automated rollback protection.
- **Home Dashboard**: Total pieces, product breakdown, and monthly revenue at a glance.
- **Add Stock**: Fast piece-based quantity additions with auto-calculated stock totals.
- **Create Sale**: Multiple products in a single receipt with custom prices, phone, and notes.
- **Sales Analytics**: Visual SVG revenue chart with rupee gridlines and recent transactions.

## Cloud Database Setup (MongoDB Atlas)

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Create or select your free **Cluster0**.
3. **Database Access** (Security tab):
   - Add a database user (e.g. `srishanth9912_db_user`).
   - Assign the **"Read and write to any database"** role.
   - Note down the exact password.
4. **Network Access** (Security tab):
   - Click **Add IP Address** → choose **Allow Access From Anywhere** (`0.0.0.0/0`) or add your current IP address.
5. In `server/.env`, set:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.yxgjcbf.mongodb.net/ifb?appName=Cluster0
   API_KEY=
   PORT=8787
   ```
   Keep the API key blank unless you want to allow a non-browser client or a different trusted origin. The browser app uses the same-origin frontend flow and does not need a secret in `client/.env`.

## Product photos
Replace the SVG files in `client/public/products/` with real product photos (same file names) if you have rights to use them.
