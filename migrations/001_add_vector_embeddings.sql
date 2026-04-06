-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to documents table (1536 dimensions for Anthropic embeddings)
ALTER TABLE documents 
ADD COLUMN embedding vector(1536);

-- Create index for fast similarity search using cosine distance
-- This enables queries like: ORDER BY embedding <-> query_embedding LIMIT 5
CREATE INDEX documents_embedding_idx 
ON documents USING ivfflat (embedding vector_cosine_ops);

-- Add search_text column for hybrid search (combines semantic + keyword)
ALTER TABLE documents 
ADD COLUMN search_text TEXT;

-- Function to automatically populate search_text on insert/update
-- Concatenates searchable fields to improve hybrid search quality
CREATE OR REPLACE FUNCTION documents_update_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := COALESCE(NEW.provider_name, '') || ' ' ||
                     COALESCE(NEW.description, '') || ' ' ||
                     COALESCE(NEW.file_name, '') || ' ' ||
                     COALESCE(NEW.support_category, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search_text
CREATE TRIGGER documents_search_text_trigger
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION documents_update_search_text();

-- Populate search_text for existing documents
UPDATE documents 
SET search_text = COALESCE(provider_name, '') || ' ' ||
                  COALESCE(description, '') || ' ' ||
                  COALESCE(file_name, '') || ' ' ||
                  COALESCE(support_category, '')
WHERE search_text IS NULL;
