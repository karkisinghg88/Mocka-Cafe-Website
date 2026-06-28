# ☕ Mocka Cafe

A mobile-first web app for **Mocka Cafe**, Delhi. Three logins — **Admin (owner)**, **Chef (kitchen)**, and **Customer** — covering menu, billing, kitchen flow, inventory, delivery and reports.

- **Frontend:** React + Vite + Tailwind (installable PWA)
- **Backend:** Supabase (database, login/auth, image storage, live updates)

---

## What each login can do

### 👑 Admin (owner)
- **Menu** — add/edit items (name, price, photo, category, availability, stock).
- **Billing** — take dine-in orders, send to kitchen, edit mid-order, mark done, mark **paid** (goes into today's sales).
- **Inventory** — track kitchen & fridge stock, record daily purchases with cost.
- **Delivery** — accept/reject customer orders, mark items unavailable, set a **changeable delivery charge**, send packed orders to kitchen, track to delivered, mark payment received, upload **UPI QR**.
- **Reports** — today's sales, monthly **profit/loss** (sales − purchases), dine-in vs delivery split.
- **Settings** — default delivery charge, UPI QR + UPI ID.

### 👨‍🍳 Chef (kitchen)
- Sees orders sent by the admin **live**, in order number sequence (#1, #2 … resets daily).
- Tick each item ready; "Order complete" / "Order packed" sends it back to admin.
- Delivery orders are clearly marked **PACKING**.

### 🧑 Customer
- Browse the full menu, add to a basket.
- See totals including delivery, choose **Pay now (UPI QR)** or **Cash on delivery**.
- Track order status live and **call the cafe** with one tap.

---

## One-time setup (about 15 minutes)

### Step 1 — Create the Supabase project (free)
1. Go to **https://supabase.com** → sign up → **New project**.
2. Give it a name (e.g. `mocka-cafe`) and a database password (save it). Region: **Mumbai / Singapore** (closest to Delhi).
3. Wait ~2 minutes for it to finish provisioning.

### Step 2 — Create the database
1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open the file **`supabase/schema.sql`** from this project, copy **everything**, paste it in, and click **Run**.
3. You should see *"Success. No rows returned"*. This creates all tables, security rules, image storage and live updates.

### Step 3 — Connect the app to Supabase
1. In Supabase: **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
2. In this project, copy `.env.example` to a new file named **`.env`**.
3. Paste your values:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhb....
   ```

### Step 4 — Run it
```bash
npm install
npm run dev
```
Open the link it prints (e.g. `http://localhost:5173`) on your laptop **or your phone** (same Wi-Fi, use the Network URL).

### Step 5 — Create accounts and assign roles
Everyone who signs up is a **customer** by default (this is the secure default). You promote your own and your chef's accounts:

1. Open the app → **Create account** for yourself, and have your chef do the same.
2. In Supabase → **Table editor → `profiles`**, find each row and change **`role`**:
   - your row → `admin`
   - chef's row → `chef`
3. Sign out and back in — the app now opens the right panel for each.

> **Email confirmation:** by default Supabase emails a confirmation link. To skip it while testing: Supabase → **Authentication → Providers → Email** → turn **off** "Confirm email".

> Want signup to also collect role requests, or an in-app "promote staff" button for the owner? That can be added — just ask.

---

## Going live (free hosting)
1. Put this folder on **GitHub**.
2. Go to **https://vercel.com** → **New Project** → import the repo.
3. Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Vercel.
4. Deploy. You get a free `https://...vercel.app` link. You can add a custom domain (e.g. `mockacafe.in`) later.

---

## Changing cafe details
Name, tagline, city and phone number live in **`src/lib/format.js`** (the `CAFE` object). Delivery charge and UPI QR are managed from **Admin → Settings**.

## Security
- **Roles are locked down:** signup always creates a `customer`; only you (via the Supabase table) can grant `admin`/`chef`. Enforced both in the app and in the database trigger.
- **Row-Level Security** is on for every table — customers can only see their own orders, chefs/admins see the kitchen, inventory & reports are admin-only.
- **Demo mode** (no `.env`) keeps all data in the browser only; nothing leaves your device.

---

Built for Mocka Cafe — *stay where your heart belongs to.* ☕
