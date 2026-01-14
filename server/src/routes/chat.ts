import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Chat } from '../models/Chat.js';
import { DocumentModel } from '../models/Document.js';
import { Workspace } from '../models/Workspace.js';
import { generateResponse, generateSearchQuery, DocumentContext } from '../services/gemini.js';
import { searchDocuments } from '../services/documentProcessor.js';
import mongoose from 'mongoose';

const router = Router();

// Create new chat
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, title } = req.body;

    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID required' });
      return;
    }

    // Verify workspace access
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      'members.userId': req.userId,
    });

    if (!workspace) {
      res.status(403).json({ error: 'Workspace access denied' });
      return;
    }

    const chat = new Chat({
      title: title || 'New Chat',
      userId: req.userId,
      workspaceId,
      messages: [],
    });

    await chat.save();

    res.status(201).json({
      id: chat._id,
      title: chat.title,
      createdAt: chat.createdAt,
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Get user's chats
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, page = '1', limit = '20' } = req.query;

    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID required' });
      return;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [chats, total] = await Promise.all([
      Chat.find({
        userId: req.userId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      })
        .select('title messages.content messages.role createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Chat.countDocuments({
        userId: req.userId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      }),
    ]);

    // Format response to include preview
    const formattedChats = chats.map((chat) => ({
      id: chat._id,
      title: chat.title,
      preview: chat.messages[0]?.content?.substring(0, 100) || '',
      messageCount: chat.messages.length,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    }));

    res.json({
      chats: formattedChats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

// Get single chat
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    res.json(chat);
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to get chat' });
  }
});

// Send message to chat
router.post('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { content, searchDocuments: shouldSearch = true } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Message content required' });
      return;
    }

    const chat = await Chat.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    // Add user message
    chat.messages.push({
      role: 'user',
      content,
      timestamp: new Date(),
    });

    let context: DocumentContext[] = [];
    let sources: {
      documentId: mongoose.Types.ObjectId;
      documentTitle: string;
      relevantChunk: string;
      confidence: number;
    }[] = [];

    // Search for relevant documents if enabled
    if (shouldSearch) {
      // Generate optimized search queries
      const searchTerms = await generateSearchQuery(content);
      const searchQuery = searchTerms.join(' ');

      // Search documents
      const searchResults = await searchDocuments(
        chat.workspaceId.toString(),
        searchQuery,
        5
      );

      if (searchResults.length > 0) {
        // Get full document content for context
        const docIds = searchResults.map((r) => r.documentId);
        const docs = await DocumentModel.find({ _id: { $in: docIds } }).select(
          'title content summary'
        );

        context = docs.map((doc) => ({
          title: doc.title,
          content: doc.summary || doc.content.substring(0, 3000),
          documentId: doc._id.toString(),
        }));

        sources = searchResults.map((r) => ({
          documentId: r.documentId,
          documentTitle: r.title,
          relevantChunk: r.relevantChunk,
          confidence: Math.min(r.score / 10, 1), // Normalize score
        }));

        // Store document IDs in chat context
        chat.context.documentIds = docIds;
        chat.context.searchQuery = content;
      }
    }

    // Convert chat history to Gemini format
    const chatHistory = chat.messages.slice(-10).map((msg) => ({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }],
    }));

    // Generate AI response
    const aiResponse = await generateResponse(content, context, chatHistory);

    // Add assistant message with sources
    chat.messages.push({
      role: 'assistant',
      content: aiResponse,
      sources,
      timestamp: new Date(),
    });

    // Update chat title if first message
    if (chat.messages.length === 2) {
      // Generate title from first user message
      chat.title = content.length > 50 ? content.substring(0, 47) + '...' : content;
    }

    await chat.save();

    // Return the assistant's response
    res.json({
      message: {
        role: 'assistant',
        content: aiResponse,
        sources,
        timestamp: new Date(),
      },
      chatTitle: chat.title,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Quick ask (without creating/storing chat)
router.post('/ask', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { question, workspaceId } = req.body;

    if (!question || !workspaceId) {
      res.status(400).json({ error: 'Question and workspaceId required' });
      return;
    }

    // Verify workspace access
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      'members.userId': req.userId,
    });

    if (!workspace) {
      res.status(403).json({ error: 'Workspace access denied' });
      return;
    }

    // Search for relevant documents
    const searchTerms = await generateSearchQuery(question);
    const searchResults = await searchDocuments(workspaceId, searchTerms.join(' '), 5);

    let context: DocumentContext[] = [];

    if (searchResults.length > 0) {
      const docIds = searchResults.map((r) => r.documentId);
      const docs = await DocumentModel.find({ _id: { $in: docIds } }).select(
        'title content summary'
      );

      context = docs.map((doc) => ({
        title: doc.title,
        content: doc.summary || doc.content.substring(0, 3000),
        documentId: doc._id.toString(),
      }));
    }

    // Generate response
    const response = await generateResponse(question, context);

    res.json({
      answer: response,
      sources: searchResults.map((r) => ({
        documentId: r.documentId,
        title: r.title,
        preview: r.relevantChunk,
      })),
    });
  } catch (error) {
    console.error('Quick ask error:', error);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

// Delete chat
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await Chat.deleteOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    res.json({ message: 'Chat deleted' });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router;
