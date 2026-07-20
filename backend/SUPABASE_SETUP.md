# InvoiceFlow - Supabase Setup Guide

Step-by-step guide to configure Supabase for the InvoiceFlow backend.

---

## Prerequisites

- A Supabase account (free tier works) at https://supabase.com
- Python 3.11+ with pip
- Access to the Supabase Dashboard SQL Editor

---

## Step 1: Create a Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Fill in:
   - Organization: Select or create one
   - Project name: `invoiceflow`
   - Database password: Generate a strong password (save it somewhere safe)
   - Region: Choose the closest to your users
4. Click **Create new project**
5. Wait ~2 minutes for provisioning to complete

---

## Step 2: Get Your API Keys

Once the project is live, go to **Project Settings > API** (left sidebar).

You need these 4 values:

| Key                        | Where to find                      | Used as                  |
|----------------------------|------------------------------------|--------------------------|
| Project URL                | Settings > API > Project URL       | SUPABASE_URL             |
| anon public key            | Settings > API > anon public       | SUPABASE_ANON_KEY        |
| service_role key           | Settings > API > service_role      | SUPABASE_SERVICE_KEY     |
| JWT Secret                 | Settings > API > JWT Secret        | SUPABASE_JWT_SECRET      |

The `service_role` key bypasses Row Level Security. Never expose it in frontend code.
It is only used by the FastAPI backend.

Also get your **database connection string**:

1. Go to **Settings > Database**
2. Under **Connection string**, select **URI**
3. Copy the full postgresql://... string
4. Replace [YOUR-PASSWORD] with your database password
5. Make sure it includes ?sslmode=require at the end

---

## Step 3: Configure Environment Variables

Copy the example env file and fill in your values:

```bash
cd backend
copy .env.example .env
```

Edit .env with your actual values:

```env
# Supabase
SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...your-anon-key
SUPABASE_SERVICE_KEY=eyJhbGciOi...your-service-key
SUPABASE_JWT_SECRET=your-jwt-secret-from-dashboard

# Database
# Format: postgresql+asyncpg://postgres:PASSWORD@db.PROJECT-ID.supabase.co:5432/postgres
DATABASE_URL=postgresql+asyncpg://postgres:your-password@db.your-project-id.supabase.co:5432/postgres

# Database sync driver (for Alembic - same but without +asyncpg)
DATABASE_URL_SYNC=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres

# FastAPI
APP_NAME=InvoiceFlow
APP_ENV=development
SECRET_KEY=any-random-string-here-make-it-long
API_V1_PREFIX=/api/v1

# CORS
FRONTEND_URL=http://localhost:5173
```

### Finding Your Project ID

Your project ID is in the dashboard URL:

```
https://supabase.com/dashboard/project/abcdefghij
                                    ^^^^^^^^^^^
                                    This is your project ID
```

So your database host becomes: db.abcdefghij.supabase.co

---

## Step 4: Run Database SQL Scripts

Go to **SQL Editor** in the Supabase Dashboard (left sidebar).

Run each script **in order**: click **New Query**, paste the SQL content, click **Run**.

### 4.1 - Schema (Tables)

File: `backend/supabase/01_schema.sql`

Creates all 6 tables:

| Table            | Purpose                                  |
|------------------|------------------------------------------|
| departments      | Organizational departments               |
| user_profiles    | App user profiles (links to auth.users)  |
| invoices         | Core invoice records                     |
| invoice_files    | File attachments per invoice             |
| approval_actions | Approve/reject/return/comment actions    |
| audit_logs       | Immutable audit trail                    |

### 4.2 - Indexes

File: `backend/supabase/02_indexes.sql`

Creates performance indexes on:
- Foreign keys (department_id, submitted_by, invoice_id, actor_id)
- Status columns (invoices.status)
- Timestamps (created_at DESC for recent-first queries)

### 4.3 - Row Level Security

File: `backend/supabase/03_rls_policies.sql`

Enables RLS on all tables. Policies ensure:

- All authenticated users can read departments
- Users can read their own profile
- Admins can read/manage all profiles
- Accounts team can read all profiles
- Users can read invoices they submitted
- Approvers (accounts/management) can read all invoices
- Department users and admins can create invoices
- Submitters can update their own draft/returned invoices
- Admins can update any invoice
- Audit logs readable by accounts team and invoice submitters
- No direct INSERT on audit_logs from regular users (prevents tampering)

### 4.4 - Seed Data

File: `backend/supabase/04_seed_data.sql`

Inserts 7 default departments:

| Name                | Code     |
|---------------------|----------|
| CPNM                | CPNM     |
| CONTENT             | CONTENT  |
| NUVERSE             | NUVERSE  |
| MULTIA              | MULTIA   |
| PEOPLE AND CULTURE  | PNC      |
| ACCOUNTS            | ACCOUNTS |
| SYSTEM ADMIN        | SYSADMIN |

### 4.5 - Auth Trigger (Optional)

File: `backend/supabase/05_trigger.sql`

Creates a PostgreSQL trigger that auto-inserts a `user_profiles` row when a new user is created in `auth.users`. This is optional because the backend API (`POST /api/v1/admin/users`) also handles profile creation. Run it if you want Supabase Auth signup to auto-create profiles.

---

## Step 5: Set Up Storage Buckets

InvoiceFlow uses two private Supabase Storage buckets for file uploads.

### 5.1 - Create Buckets

1. Go to **Storage** in the left sidebar
2. Click **New bucket**
3. Create the first bucket:
   - Name: `invoice-originals`
   - Public: **OFF** (private)
   - Click **Create bucket**
4. Create the second bucket:
   - Name: `invoice-approved`
   - Public: **OFF** (private)
   - Click **Create bucket**

### 5.2 - Set Bucket Access Policies

For each bucket, go to the bucket, click the **Policies** tab, then **New policy**.

You can also run this in the SQL Editor:

```sql
-- invoice-originals policies
CREATE POLICY "Authenticated uploads to originals"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoice-originals');

CREATE POLICY "Authenticated reads from originals"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoice-originals');

-- invoice-approved policies
CREATE POLICY "Authenticated uploads to approved"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoice-approved');

CREATE POLICY "Authenticated reads from approved"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoice-approved');
```

---

## Step 6: Configure Auth Settings

1. Go to **Authentication** in the left sidebar
2. Under **Providers**, ensure **Email** is enabled (it is by default)
3. For local development, disable email confirmation:
   - Go to **Authentication > Providers > Email**
   - Toggle **Confirm email** OFF
   - This lets you create and login users without email verification
4. Note the **JWT expiry** under Settings > Auth (default: 3600 seconds = 1 hour)

---

## Step 7: Run Alembic Migration (Optional)

The schema was already created by running the SQL scripts in Step 4.
Alembic is used for version-controlled migrations going forward.

To mark the current schema as the baseline:

```bash
cd backend
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Stamp the current state (no new migration needed since SQL already ran)
alembic stamp head
```

To create a new migration in the future:

```bash
alembic revision --autogenerate -m "description of change"
alembic upgrade head
```

---

## Step 8: Create the Admin User

You have two options:

### Option A - Via the Seed Script (Recommended)

```bash
cd backend
venv\Scripts\activate
python -m app.seed
```

This creates:
- 7 departments (skipped if already seeded by SQL in Step 4)
- Admin user: admin@invoiceflow.com / Admin@12345

**Note:** The seed script needs valid Supabase credentials in .env because it creates
the admin user through Supabase Auth.

### Option B - Via Supabase Dashboard

1. Go to **Authentication > Users** in the Supabase Dashboard
2. Click **Add user**
3. Enter:
   - Email: admin@invoiceflow.com
   - Password: Admin@12345
   - Auto Confirm: ON
4. Click **Create user**
5. Then insert the profile via SQL Editor:

```sql
INSERT INTO user_profiles (id, email, full_name, role)
SELECT
    id,
    email,
    'System Administrator',
    'admin'
FROM auth.users
WHERE email = 'admin@invoiceflow.com';
```

---

## Step 9: Start the Backend

```bash
cd backend
venv\Scripts\activate

# Install dependencies (first time only)
pip install -e .

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify it works:

1. Open http://localhost:8000/health in your browser
   - Should return: `{"status": "healthy", "service": "InvoiceFlow"}`

2. Open http://localhost:8000/docs for the Swagger API docs

3. Test login:
   - Click POST /api/v1/auth/login
   - Click Try it out
   - Enter:
     ```json
     {
       "email": "admin@invoiceflow.com",
       "password": "Admin@12345"
     }
     ```
   - Click Execute
   - You should get back access_token and refresh_token

---

## Troubleshooting

### "create_client() requires arguments"
Your .env file is missing or SUPABASE_URL/SUPABASE_SERVICE_KEY are empty.
Make sure .env is in the backend/ directory and has real values.

### "could not connect to server" (Database)
- Check DATABASE_URL has the correct password
- Make sure ?sslmode=require is at the end
- Verify the project ID matches your Supabase dashboard

### "relation user_profiles does not exist"
You skipped Step 4.1. Run 01_schema.sql in the SQL Editor.

### "permission denied for table"
RLS is blocking access. Make sure you ran 03_rls_policies.sql
and that you are authenticated (have a valid JWT token).

### "jwt malformed" or "invalid signature"
Your SUPABASE_JWT_SECRET does not match what is in the Supabase Dashboard.
Re-copy it from Settings > API > JWT Secret.

### Alembic migration error
If you already ran the SQL scripts, stamp the current state:
```
alembic stamp head
```
This tells Alembic the database is already up to date without running migrations.

### Port 8000 already in use
```
uvicorn app.main:app --reload --port 8001
```
Update FRONTEND_URL in .env to match if you change ports.

---

## Environment Variables Reference

| Variable                | Required | Description                                      |
|-------------------------|----------|--------------------------------------------------|
| SUPABASE_URL            | Yes      | Your Supabase project URL                        |
| SUPABASE_ANON_KEY       | Yes      | Supabase anonymous/public API key                |
| SUPABASE_SERVICE_KEY    | Yes      | Supabase service role key (admin, backend only)  |
| SUPABASE_JWT_SECRET     | Yes      | JWT secret for token verification                |
| DATABASE_URL            | Yes      | Async PostgreSQL connection string (+asyncpg)    |
| DATABASE_URL_SYNC       | Yes      | Sync PostgreSQL connection string (for Alembic)  |
| APP_NAME                | No       | Application name (default: InvoiceFlow)          |
| APP_ENV                 | No       | Environment: development or production           |
| SECRET_KEY              | No       | App-level secret key (default: change-me)        |
| API_V1_PREFIX           | No       | API route prefix (default: /api/v1)              |
| FRONTEND_URL            | No       | Frontend URL for CORS (default: localhost:5173)  |

---

## SQL Scripts Summary

| File | Purpose | When to run |
|------|---------|-------------|
| 01_schema.sql | Create all 6 tables | First time setup |
| 02_indexes.sql | Create performance indexes | After 01_schema.sql |
| 03_rls_policies.sql | Enable and configure RLS | After 01_schema.sql |
| 04_seed_data.sql | Insert 7 departments | After 01_schema.sql |
| 05_trigger.sql | Auto-create profiles on signup | Optional, after 01_schema.sql |

---

## What Next?

After Supabase is set up and the backend starts successfully:

1. Test all API endpoints via Swagger at http://localhost:8000/docs
2. Create test users via POST /api/v1/admin/users
3. Submit test invoices via POST /api/v1/invoices
4. Proceed to Phase 2: workflow engine and approval actions
