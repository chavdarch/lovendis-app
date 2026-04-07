/**
 * Text chunking utilities for RAG
 * Splits documents into semantic chunks optimized for retrieval
 */

// Rough token counter - for production, use proper tokenizer
export function estimateTokens(text: string): number {
  // ~4 characters per token average for English
  return Math.ceil(text.length / 4)
}

export interface Chunk {
  content: string
  tokens: number
  startIndex: number
}

/**
 * Split text into chunks based on token count
 * Aims for 500-1000 tokens per chunk with some overlap
 * 
 * @param text - Full text to chunk
 * @param minTokens - Minimum tokens per chunk (default: 400)
 * @param maxTokens - Maximum tokens per chunk (default: 1000)
 * @param overlapTokens - Tokens to overlap between chunks (default: 100)
 * @returns Array of chunks with content and token count
 */
export function chunkText(
  text: string,
  minTokens: number = 400,
  maxTokens: number = 1000,
  overlapTokens: number = 100
): Chunk[] {
  if (!text || text.trim().length === 0) return []

  const chunks: Chunk[] = []
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  
  let currentChunk = ''
  let currentTokens = 0
  let startIndex = 0

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence)
    
    // If adding this sentence would exceed max tokens
    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      // Save current chunk if it meets minimum
      if (currentTokens >= minTokens) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          startIndex,
        })
        
        // Create overlap for next chunk
        const overlapContent = currentChunk.slice(-Math.ceil(maxTokens / 2))
        currentChunk = overlapContent
        currentTokens = estimateTokens(overlapContent)
        startIndex = Math.max(0, text.indexOf(overlapContent))
      } else {
        // Continue filling current chunk if below minimum
        currentChunk += sentence
        currentTokens += sentenceTokens
      }
    } else {
      currentChunk += sentence
      currentTokens += sentenceTokens
    }
  }

  // Add remaining chunk if it meets minimum
  if (currentChunk.length > 0 && currentTokens >= minTokens) {
    chunks.push({
      content: currentChunk.trim(),
      tokens: currentTokens,
      startIndex,
    })
  } else if (currentChunk.length > 0 && chunks.length === 0) {
    // Ensure at least one chunk even if below minimum
    chunks.push({
      content: currentChunk.trim(),
      tokens: currentTokens,
      startIndex,
    })
  }

  return chunks
}

/**
 * Format chunks for RAG prompt
 */
export function formatChunksForPrompt(chunks: Array<{ content: string; doc_name?: string; doc_date?: string }>) {
  return chunks
    .map((chunk, i) => {
      const source = chunk.doc_name ? ` [Source: ${chunk.doc_name}${chunk.doc_date ? ` (${chunk.doc_date})` : ''}]` : ''
      return `${i + 1}. ${chunk.content}${source}`
    })
    .join('\n\n')
}
