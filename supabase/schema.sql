-- loveNDIS Database Schema
-- Run this in your Supabase SQL editor

-- Users are handled by Supabase Auth

-- NDIS Participants (a family may support multiple participants)
CREATE TABLE participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ndis_number TEXT,
  plan_start_date DATE,
  plan_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NDIS Support Categories (reference table)
CREATE TABLE support_categories (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT -- hex color for UI
);

-- Insert standard NDIS support categories
INSERT INTO support_categories (code, name, color) VALUES
('01', 'Daily Activities', '#7c3aed'),
('02', 'Health & Wellbeing', '#0d9488'),
('03', 'Home Living', '#d97706'),
('04', 'Lifelong Learning', '#2563eb'),
('05', 'Work', '#16a34a'),
('06', 'Social & Community', '#dc2626'),
('07', 'Relationships', '#db2777'),
('08', 'Choice & Control', '#7c3aed'),
('09', 'Daily Activities (CB)', '#6d28d9'),
('10', 'Plan Management', '#4f46e5'),
('11', 'Support Coordination', '#0891b2'),
('12', 'Improved Living', '#ca8a04'),
('13', 'Improved Health', '#16a34a'),
('14', 'Improved Learning', '#2563eb'),
('15', 'Increased Work', '#059669');

-- Documents (receipts, invoices, therapy reports)
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT, -- 'receipt', 'invoice', 'therapy_report', 'plan_review', 'other'
  doc_date DATE,
  provider_name TEXT,
  amount DECIMAL(10,2),
  support_category TEXT REFERENCES support_categories(code), -- NDIS support category code
  support_item_number TEXT,
  description TEXT,
  ai_extracted BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(3,2), -- 0-1 confidence score
  raw_ai_response JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget tracking
CREATE TABLE budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  support_category_code TEXT REFERENCES support_categories(code),
  allocated_amount DECIMAL(10,2) NOT NULL,
  plan_year INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, support_category_code, plan_year)
);

-- RLS Policies
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_categories ENABLE ROW LEVEL SECURITY;

-- Participants: users see only their own
CREATE POLICY "Users can only see their own participants" ON participants
  FOR ALL USING (auth.uid() = user_id);

-- Documents: users see only their own
CREATE POLICY "Users can only see their own documents" ON documents
  FOR ALL USING (auth.uid() = user_id);

-- Budgets: users see only their own (via participant)
CREATE POLICY "Users can only see their own budgets" ON budgets
  FOR ALL USING (
    auth.uid() = (
      SELECT user_id FROM participants WHERE id = budgets.participant_id
    )
  );

-- Support categories: public read-only reference data
CREATE POLICY "Support categories are publicly readable" ON support_categories
  FOR SELECT USING (true);
