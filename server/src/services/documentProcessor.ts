import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { generateEmbedding, summarizeDocument, extractEntities } from './gemini.js';
import { DocumentModel, IDocumentChunk } from '../models/Document.js';
import mongoose from 'mongoose';

const CHUNK_SIZE = 1000; // characters
const CHUNK_OVERLAP = 200; // characters

export const chunkText = (text: string): IDocumentChunk[] => {
  const chunks: IDocumentChunk[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + CHUNK_SIZE, text.length);
    let chunkEnd = endIndex;

    // Try to break at sentence boundary
    if (endIndex < text.length) {
      const lastPeriod = text.lastIndexOf('.', endIndex);
      const lastNewline = text.lastIndexOf('\n', endIndex);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > startIndex + CHUNK_SIZE / 2) {
        chunkEnd = breakPoint + 1;
      }
    }

    chunks.push({
      content: text.slice(startIndex, chunkEnd).trim(),
      metadata: {
        startIndex,
        endIndex: chunkEnd,
      },
    });

    startIndex = chunkEnd - CHUNK_OVERLAP;
    if (startIndex >= text.length) break;
  }

  return chunks;
};

export const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

export const extractTextFromDOCX = async (buffer: Buffer): Promise<string> => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX');
  }
};

export const processDocument = async (
  documentId: string,
  content: string | Buffer,
  mimeType: string
): Promise<void> => {
  const document = await DocumentModel.findById(documentId);
  if (!document) {
    throw new Error('Document not found');
  }

  try {
    // Update status to processing
    document.processingStatus = 'processing';
    await document.save();

    let textContent: string;

    // Extract text based on mime type
    if (mimeType === 'application/pdf' && Buffer.isBuffer(content)) {
      textContent = await extractTextFromPDF(content);
    } else if (
      (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword') &&
      Buffer.isBuffer(content)
    ) {
      textContent = await extractTextFromDOCX(content);
    } else if (typeof content === 'string') {
      // Already text (Google Docs export or plain text)
      textContent = content;
    } else if (Buffer.isBuffer(content)) {
      // Try to decode as UTF-8
      textContent = content.toString('utf-8');
    } else {
      throw new Error('Unsupported content type');
    }

    // Store full content
    document.content = textContent;

    // Create chunks
    const chunks = chunkText(textContent);

    // Generate embeddings for chunks (if Gemini is configured)
    try {
      for (const chunk of chunks) {
        chunk.embedding = await generateEmbedding(chunk.content);
      }
    } catch (error) {
      console.warn('Embedding generation skipped:', error);
    }

    document.chunks = chunks;

    // Generate summary
    try {
      document.summary = await summarizeDocument(textContent, document.title);
    } catch (error) {
      console.warn('Summary generation skipped:', error);
    }

    // Extract entities
    try {
      document.entities = await extractEntities(textContent);
    } catch (error) {
      console.warn('Entity extraction skipped:', error);
    }

    // Mark as completed
    document.processingStatus = 'completed';
    await document.save();

    console.log(`✅ Document processed: ${document.title}`);
  } catch (error) {
    console.error(`❌ Document processing failed: ${document.title}`, error);
    document.processingStatus = 'failed';
    document.processingError = error instanceof Error ? error.message : 'Unknown error';
    await document.save();
  }
};

export const searchDocuments = async (
  workspaceId: string,
  query: string,
  limit: number = 10
): Promise<{
  documentId: mongoose.Types.ObjectId;
  title: string;
  relevantChunk: string;
  score: number;
}[]> => {
  // Text search in MongoDB
  const documents = await DocumentModel.find({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    processingStatus: 'completed',
    $text: { $search: query },
  })
    .select('title chunks summary')
    .limit(limit * 2);

  const results: {
    documentId: mongoose.Types.ObjectId;
    title: string;
    relevantChunk: string;
    score: number;
  }[] = [];

  // Simple keyword matching for relevance scoring
  const queryTerms = query.toLowerCase().split(/\s+/);

  for (const doc of documents) {
    let bestChunk = doc.summary || '';
    let bestScore = 0;

    for (const chunk of doc.chunks) {
      const chunkLower = chunk.content.toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        if (chunkLower.includes(term)) {
          score += (chunkLower.match(new RegExp(term, 'g')) || []).length;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestChunk = chunk.content;
      }
    }

    if (bestScore > 0 || doc.summary) {
      results.push({
        documentId: doc._id,
        title: doc.title,
        relevantChunk: bestChunk.substring(0, 500),
        score: bestScore,
      });
    }
  }

  // Sort by score and limit
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
};

export const findRelatedDocuments = async (
  documentId: string,
  workspaceId: string,
  limit: number = 5
): Promise<mongoose.Types.ObjectId[]> => {
  const document = await DocumentModel.findById(documentId);
  if (!document) return [];

  // Find documents with similar entities
  const entityNames = document.entities.map((e) => e.name);

  const related = await DocumentModel.find({
    _id: { $ne: documentId },
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    processingStatus: 'completed',
    'entities.name': { $in: entityNames },
  })
    .select('_id')
    .limit(limit);

  return related.map((d) => d._id);
};
