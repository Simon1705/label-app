i# Label App - Dataset Labeling Tool

Aplikasi web untuk memudahkan labeling dataset berupa ulasan dari suatu aplikasi. Dibuat dengan Next.js dan Supabase.

## Fitur

### User Biasa
- Upload dataset dalam format CSV dengan kolom text (ulasan) dan score (rating 1-5)
- Mengundang user lain untuk melabeli dataset yang diupload
- Memantau progress label dari setiap user yang diundang
- Melihat hasil label dari dataset sebagai perbandingan
- Mengekspor hasil labeling dalam format CSV

### Admin
- Mengelola user (CRUD)
- Melihat dataset yang diupload oleh user

## Teknologi

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth, Database, Storage)

## Setup Supabase

### 1. Buat Project Supabase

1. Buat akun di [Supabase](https://supabase.com)
2. Buat project baru
3. Catat URL dan anon key dari project yang dibuat

### 2. Setup Database Tables

Jalankan SQL berikut di Supabase SQL Editor:

```sql
-- Create tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE
);

CREATE TABLE datasets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_entries INTEGER NOT NULL,
  invite_code TEXT NOT NULL
);

CREATE TABLE dataset_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5)
);

CREATE TABLE dataset_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  entry_id UUID REFERENCES dataset_entries(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL CHECK (label IN ('positive', 'negative', 'neutral')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (entry_id, user_id)
);

CREATE TABLE label_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  UNIQUE (dataset_id, user_id)
);

-- Create initial admin user
INSERT INTO users (username, is_admin)
VALUES ('admin', TRUE);
```

### 3. Setup Bucket untuk Storage

1. Buka tab "Storage" di Supabase Dashboard
2. Buat bucket baru bernama "csvfiles"
3. Set bucket menjadi private

### 4. Atur Access Policies (Row-Level Security)

Buka tab SQL Editor dan jalankan SQL berikut:

```sql
-- Users table policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all users" ON users
  FOR SELECT USING (true);
  
CREATE POLICY "Only admins can insert users" ON users
  FOR INSERT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_admin = true
    )
  );
  
CREATE POLICY "Only admins can update users" ON users
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_admin = true
    )
  );
  
CREATE POLICY "Only admins can delete users" ON users
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Datasets table policies
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own datasets" ON datasets
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid()
  );
  
CREATE POLICY "Admins can view all datasets" ON datasets
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_admin = true
    )
  );
  
CREATE POLICY "Users can insert their own datasets" ON datasets
  FOR INSERT TO authenticated WITH CHECK (
    owner_id = auth.uid()
  );
  
CREATE POLICY "Users can update their own datasets" ON datasets
  FOR UPDATE TO authenticated USING (
    owner_id = auth.uid()
  );
  
CREATE POLICY "Users can delete their own datasets" ON datasets
  FOR DELETE TO authenticated USING (
    owner_id = auth.uid()
  );

-- Dataset entries policies
ALTER TABLE dataset_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view entries of their own datasets" ON dataset_entries
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = dataset_entries.dataset_id
      AND datasets.owner_id = auth.uid()
    )
  );
  
CREATE POLICY "Users can view entries of datasets they are labeling" ON dataset_entries
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM label_progress
      WHERE label_progress.dataset_id = dataset_entries.dataset_id
      AND label_progress.user_id = auth.uid()
    )
  );
  
CREATE POLICY "Admins can view all entries" ON dataset_entries
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_admin = true
    )
  );
  
CREATE POLICY "Users can insert entries to their own datasets" ON dataset_entries
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = dataset_entries.dataset_id
      AND datasets.owner_id = auth.uid()
    )
  );

-- Dataset labels policies
ALTER TABLE dataset_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view labels for their own datasets" ON dataset_labels
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = dataset_labels.dataset_id
      AND datasets.owner_id = auth.uid()
    )
  );
  
CREATE POLICY "Users can view their own labels" ON dataset_labels
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
  );
  
CREATE POLICY "Users can insert their own labels" ON dataset_labels
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
  );
  
CREATE POLICY "Users can update their own labels" ON dataset_labels
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid()
  );

-- Label progress policies
ALTER TABLE label_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view progress for their own datasets" ON label_progress
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = label_progress.dataset_id
      AND datasets.owner_id = auth.uid()
    )
  );
  
CREATE POLICY "Users can view their own progress" ON label_progress
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
  );
  
CREATE POLICY "Users can insert their own progress" ON label_progress
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
  );
  
CREATE POLICY "Users can update their own progress" ON label_progress
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid()
  );
```

## Setup Aplikasi

1. Clone repository ini
2. Install dependensi:
```bash
npm install
```
3. Buat file `.env.local` di root folder dan tambahkan:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```
4. Jalankan aplikasi:
```bash
npm run dev
```
5. Buka `http://localhost:3000` di browser
6. Login dengan username `admin` (default admin account)

## Penggunaan

### Sebagai Admin
1. Login dengan username `admin`
2. Buat user baru di halaman Users
3. Anda bisa melihat semua dataset yang dibuat user

### Sebagai User Biasa
1. Login dengan username yang dibuat admin
2. Upload dataset CSV di menu "Upload Dataset"
3. Bagikan invite code ke user lain untuk mulai melabeli dataset
4. Monitor progress labeling
5. Export dataset yang telah dilabeli

## Format Dataset CSV

Dataset harus dalam format CSV dengan kolom berikut:
- **text**: Berisi teks ulasan/review
- **score**: Nilai rating (1-5)
