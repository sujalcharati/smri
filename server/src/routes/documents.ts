import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { DocumentModel } from '../models/Document.js';
import { Workspace } from '../models/Workspace.js';
import { processDocument } from '../services/documentProcessor.js';
import mongoose from 'mongoose';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for memory efficiency
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Get mime type category
const getMimeTypeCategory = (mimeType: string): string => {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'text/plain': 'txt',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slide',
  };
  return mimeMap[mimeType] || 'unknown';
};

// Upload document
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { workspaceId } = req.body;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

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

      // Create document record
      const document = new DocumentModel({
        title: file.originalname,
        type: getMimeTypeCategory(file.mimetype),
        source: 'upload',
        mimeType: file.mimetype,
        size: file.size,
        userId: req.userId,
        workspaceId,
        processingStatus: 'pending',
      });

      await document.save();

      // Update workspace stats
      workspace.stats.documentCount += 1;
      workspace.stats.totalSize += file.size;
      workspace.stats.lastActivity = new Date();
      await workspace.save();

      // Process document asynchronously - copy buffer to allow original to be GC'd
      const bufferCopy = Buffer.from(file.buffer);
      setImmediate(() => {
        processDocument(document._id.toString(), bufferCopy, file.mimetype).catch(console.error);
      });

      // Emit socket event
      const io = req.app.get('io');
      io.to(workspaceId).emit('document:created', {
        id: document._id,
        title: document.title,
        status: 'processing',
      });

      res.status(201).json({
        id: document._id,
        title: document.title,
        type: document.type,
        status: document.processingStatus,
        message: 'Document uploaded and processing started',
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// Get documents for workspace
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, status, type, search, page = '1', limit = '20' } = req.query;

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

    // Build query
    const query: Record<string, unknown> = {
      workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
    };

    if (status) query.processingStatus = status;
    if (type) query.type = type;
    if (search) {
      query.$text = { $search: search as string };
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [documents, total] = await Promise.all([
      DocumentModel.find(query)
        .select('title type source summary tags processingStatus createdAt updatedAt size')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      DocumentModel.countDocuments(query),
    ]);

    res.json({
      documents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

// Get single document
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const document = await DocumentModel.findOne({
      _id: req.params.id,
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Verify workspace access
    const workspace = await Workspace.findOne({
      _id: document.workspaceId,
      'members.userId': req.userId,
    });

    if (!workspace) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

// Delete document
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const document = await DocumentModel.findById(req.params.id);

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Verify ownership or admin access
    const workspace = await Workspace.findOne({
      _id: document.workspaceId,
      $or: [
        { 'members.userId': req.userId, 'members.role': { $in: ['owner', 'admin'] } },
        { 'members.userId': req.userId },
      ],
    });

    if (!workspace) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check if user owns document or is admin
    const isOwner = document.userId.toString() === req.userId;
    const member = workspace.members.find((m) => m.userId.toString() === req.userId);
    const isAdmin = member && ['owner', 'admin'].includes(member.role);

    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Update workspace stats
    workspace.stats.documentCount -= 1;
    workspace.stats.totalSize -= document.size;
    await workspace.save();

    await DocumentModel.deleteOne({ _id: req.params.id });

    // Emit socket event
    const io = req.app.get('io');
    io.to(document.workspaceId.toString()).emit('document:deleted', { id: req.params.id });

    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Update document tags
router.patch('/:id/tags', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      res.status(400).json({ error: 'Tags must be an array' });
      return;
    }

    const document = await DocumentModel.findById(req.params.id);

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Verify workspace access
    const workspace = await Workspace.findOne({
      _id: document.workspaceId,
      'members.userId': req.userId,
    });

    if (!workspace) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    document.tags = tags;
    await document.save();

    res.json({ tags: document.tags });
  } catch (error) {
    console.error('Update tags error:', error);
    res.status(500).json({ error: 'Failed to update tags' });
  }
});

export default router;
