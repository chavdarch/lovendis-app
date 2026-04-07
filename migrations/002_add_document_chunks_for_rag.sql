-- Create document_chunks table for RAG system
-- Stores chunked content from documents with embeddings for semantic search

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  tokens INT,
  doc_type VARCHAR(50), -- 'invoice', 'receipt', 'therapy_report', 'plan_review', 'other'
  doc_date DATE,
  provider_name TEXT,
  support_category VARCHAR(10),
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT chunk_unique UNIQUE(document_id, chunk_index)
);

-- Index for fast semantic similarity search
CREATE INDEX document_chunks_embedding_idx 
ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Index for user-based queries
CREATE INDEX document_chunks_user_idx ON document_chunks(user_id);

-- Index for document-based queries
CREATE INDEX document_chunks_document_idx ON document_chunks(document_id);

-- RLS: Users can only see their own chunks
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own chunks"
ON document_chunks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chunks"
ON document_chunks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chunks"
ON document_chunks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chunks"
ON document_chunks FOR DELETE
USING (auth.uid() = user_id);

-- Create a table for RAG conversation history (optional enhancement for multi-turn)
CREATE TABLE rag_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE rag_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20), -- 'user' or 'assistant'
  content TEXT NOT NULL,
  sources JSONB, -- Array of {chunk_id, doc_id, doc_name, date, excerpt}
  created_at TIMESTAMP DEFAULT now()
);

-- RLS for conversations
ALTER TABLE rag_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own conversations"
ON rag_conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
ON rag_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS for messages
ALTER TABLE rag_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read messages from their conversations"
ON rag_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert messages to their conversations"
ON rag_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);
