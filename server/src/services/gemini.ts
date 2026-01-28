import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load env variables first
dotenv.config();

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;
let embeddingModel: GenerativeModel | null = null;

const initializeGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  console.log('🔑 Checking Gemini API key:', apiKey ? 'Found' : 'Not found');

  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY not set. AI features will be limited.');
    return false;
  }

  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    console.log('✅ Gemini AI initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Gemini:', error);
    return false;
  }
};

// Initialize on module load
initializeGemini();

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface DocumentContext {
  title: string;
  content: string;
  documentId: string;
}

export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!embeddingModel) {
    throw new Error('Gemini not initialized');
  }

  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
};

export const generateResponse = async (
  prompt: string,
  context?: DocumentContext[],
  chatHistory?: ChatMessage[]
): Promise<string> => {
  if (!model) {
    // Return mock response if Gemini is not configured
    return `I'm SMRI, your AI workplace assistant. To enable full AI capabilities, please configure your GEMINI_API_KEY in the environment variables.

Your question was: "${prompt}"

Once configured, I'll be able to:
- Search and analyze your documents
- Answer questions based on your knowledge base
- Help with workflow automation
- Generate insights from your data`;
  }

  let systemPrompt = `You are SMRI, an intelligent AI assistant for workplace knowledge management.
You help users find information, understand documents, and work more efficiently.
Be concise, helpful, and accurate. Always cite your sources when referencing documents.
If you don't know something or can't find it in the provided context, say so honestly.`;

  if (context && context.length > 0) {
    systemPrompt += `\n\nRelevant documents for context:\n`;
    context.forEach((doc, index) => {
      systemPrompt += `\n--- Document ${index + 1}: ${doc.title} ---\n${doc.content}\n`;
    });
    systemPrompt += `\nUse the above documents to answer the user's question. Cite document titles when referencing information.`;
  }

  const chat = model.startChat({
    history: chatHistory || [],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  });

  const result = await chat.sendMessage(`${systemPrompt}\n\nUser: ${prompt}`);
  const response = result.response;

  return response.text();
};

export const summarizeDocument = async (content: string, title: string): Promise<string> => {
  if (!model) {
    return `Summary not available - Gemini API not configured. Document: ${title}`;
  }

  const prompt = `Please provide a concise summary (2-3 paragraphs) of the following document titled "${title}":

${content.substring(0, 30000)}

Focus on:
1. Main topics and key points
2. Important findings or conclusions
3. Any actionable items or recommendations`;

  const result = await model.generateContent(prompt);
  return result.response.text();
};

export const extractEntities = async (content: string): Promise<{
  name: string;
  type: 'person' | 'organization' | 'project' | 'technology' | 'concept';
  mentions: number;
}[]> => {
  if (!model) {
    return [];
  }

  const prompt = `Extract key entities from the following text. Return a JSON array with objects containing:
- name: the entity name
- type: one of "person", "organization", "project", "technology", "concept"
- mentions: approximate count of mentions

Text:
${content.substring(0, 15000)}

Return ONLY the JSON array, no other text.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Entity extraction error:', error);
  }

  return [];
};

export const analyzeRelations = async (
  doc1Content: string,
  doc2Content: string
): Promise<{ relationType: string; strength: number; reason: string }> => {
  if (!model) {
    return { relationType: 'related_to', strength: 0.5, reason: 'Analysis unavailable' };
  }

  const prompt = `Analyze the relationship between these two document excerpts:

Document 1:
${doc1Content.substring(0, 5000)}

Document 2:
${doc2Content.substring(0, 5000)}

Return a JSON object with:
- relationType: one of "references", "related_to", "depends_on", "part_of"
- strength: a number between 0 and 1 indicating how strong the relationship is
- reason: brief explanation of the relationship

Return ONLY the JSON object.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Relation analysis error:', error);
  }

  return { relationType: 'related_to', strength: 0.5, reason: 'Analysis failed' };
};

export const generateSearchQuery = async (naturalQuery: string): Promise<string[]> => {
  if (!model) {
    // Simple keyword extraction fallback
    return naturalQuery.toLowerCase().split(/\s+/).filter(word => word.length > 3);
  }

  const prompt = `Convert this natural language search query into relevant search keywords:
"${naturalQuery}"

Return a JSON array of 3-5 search terms that would help find relevant documents.
Return ONLY the JSON array.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Search query generation error:', error);
  }

  return naturalQuery.toLowerCase().split(/\s+/).filter(word => word.length > 3);
};

export const executeWorkflowStep = async (
  stepType: string,
  config: Record<string, unknown>,
  input: unknown
): Promise<unknown> => {
  if (!model) {
    return { error: 'Gemini not configured', input };
  }

  const prompts: Record<string, string> = {
    summarize: `Summarize the following content concisely:\n${JSON.stringify(input)}`,
    extract: `Extract the following information from the content: ${JSON.stringify(config)}\nContent: ${JSON.stringify(input)}`,
    analyze: `Analyze the following content for ${config.analysisType || 'general insights'}:\n${JSON.stringify(input)}`,
  };

  const prompt = prompts[stepType];
  if (!prompt) {
    return { error: `Unknown step type: ${stepType}` };
  }

  const result = await model.generateContent(prompt);
  return { result: result.response.text() };
};

export { genAI, model, embeddingModel };
