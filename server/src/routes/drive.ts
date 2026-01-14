import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { DocumentModel } from '../models/Document.js';
import { Workspace } from '../models/Workspace.js';
import {
  getDriveClient,
  listFiles,
  listFolders,
  getFileContent,
  getFileMetadata,
  getMimeTypeCategory,
} from '../services/googleDrive.js';
import { processDocument } from '../services/documentProcessor.js';

const router = Router();

// Check Drive connection status
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);

    if (!user?.googleAccessToken) {
      res.json({ connected: false, message: 'Google Drive not connected' });
      return;
    }

    // Try to list files to verify connection
    try {
      const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);
      await listFiles(drive, undefined, undefined);
      res.json({ connected: true, message: 'Google Drive connected' });
    } catch {
      res.json({ connected: false, message: 'Token expired, please reconnect' });
    }
  } catch (error) {
    console.error('Drive status error:', error);
    res.status(500).json({ error: 'Failed to check drive status' });
  }
});

// List files from Google Drive
router.get('/files', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { folderId, pageToken } = req.query;

    const user = await User.findById(req.userId);

    if (!user?.googleAccessToken) {
      res.status(401).json({ error: 'Google Drive not connected' });
      return;
    }

    const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);

    const result = await listFiles(
      drive,
      folderId as string | undefined,
      pageToken as string | undefined
    );

    res.json(result);
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// List folders from Google Drive
router.get('/folders', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { parentId } = req.query;

    const user = await User.findById(req.userId);

    if (!user?.googleAccessToken) {
      res.status(401).json({ error: 'Google Drive not connected' });
      return;
    }

    const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);
    const folders = await listFolders(drive, parentId as string | undefined);

    res.json({ folders });
  } catch (error) {
    console.error('List folders error:', error);
    res.status(500).json({ error: 'Failed to list folders' });
  }
});

// Import file from Google Drive
router.post('/import', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId, workspaceId } = req.body;

    if (!fileId || !workspaceId) {
      res.status(400).json({ error: 'File ID and workspace ID required' });
      return;
    }

    const user = await User.findById(req.userId);

    if (!user?.googleAccessToken) {
      res.status(401).json({ error: 'Google Drive not connected' });
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

    const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);

    // Get file metadata
    const fileMetadata = await getFileMetadata(drive, fileId);

    if (!fileMetadata) {
      res.status(404).json({ error: 'File not found in Google Drive' });
      return;
    }

    // Check if already imported
    const existing = await DocumentModel.findOne({
      sourceId: fileId,
      workspaceId,
    });

    if (existing) {
      res.status(400).json({
        error: 'File already imported',
        documentId: existing._id,
      });
      return;
    }

    // Get file content
    const { content, exportedMimeType } = await getFileContent(
      drive,
      fileId,
      fileMetadata.mimeType
    );

    // Create document record
    const document = new DocumentModel({
      title: fileMetadata.name,
      type: getMimeTypeCategory(fileMetadata.mimeType),
      source: 'google_drive',
      sourceId: fileId,
      sourceUrl: fileMetadata.webViewLink,
      mimeType: fileMetadata.mimeType,
      size: parseInt(fileMetadata.size, 10) || 0,
      userId: req.userId,
      workspaceId,
      lastSyncedAt: new Date(),
      processingStatus: 'pending',
    });

    await document.save();

    // Update workspace stats
    workspace.stats.documentCount += 1;
    workspace.stats.totalSize += document.size;
    workspace.stats.lastActivity = new Date();
    await workspace.save();

    // Process document
    let contentToProcess: string | Buffer;

    if (exportedMimeType === 'text/plain' || exportedMimeType === 'text/csv') {
      contentToProcess = content;
    } else {
      // Decode base64 for binary files
      contentToProcess = Buffer.from(content, 'base64');
    }

    processDocument(document._id.toString(), contentToProcess, exportedMimeType).catch(
      console.error
    );

    // Emit socket event
    const io = req.app.get('io');
    io.to(workspaceId).emit('document:created', {
      id: document._id,
      title: document.title,
      source: 'google_drive',
      status: 'processing',
    });

    res.status(201).json({
      id: document._id,
      title: document.title,
      type: document.type,
      status: document.processingStatus,
      message: 'Document imported and processing started',
    });
  } catch (error) {
    console.error('Import file error:', error);
    res.status(500).json({ error: 'Failed to import file' });
  }
});

// Batch import multiple files
router.post('/import-batch', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fileIds, workspaceId } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || !workspaceId) {
      res.status(400).json({ error: 'File IDs array and workspace ID required' });
      return;
    }

    const user = await User.findById(req.userId);

    if (!user?.googleAccessToken) {
      res.status(401).json({ error: 'Google Drive not connected' });
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

    const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);
    const results: { fileId: string; status: string; documentId?: string; error?: string }[] = [];

    for (const fileId of fileIds) {
      try {
        // Check if already imported
        const existing = await DocumentModel.findOne({
          sourceId: fileId,
          workspaceId,
        });

        if (existing) {
          results.push({
            fileId,
            status: 'skipped',
            documentId: existing._id.toString(),
            error: 'Already imported',
          });
          continue;
        }

        // Get file metadata
        const fileMetadata = await getFileMetadata(drive, fileId);

        if (!fileMetadata) {
          results.push({ fileId, status: 'failed', error: 'File not found' });
          continue;
        }

        // Get file content
        const { content, exportedMimeType } = await getFileContent(
          drive,
          fileId,
          fileMetadata.mimeType
        );

        // Create document record
        const document = new DocumentModel({
          title: fileMetadata.name,
          type: getMimeTypeCategory(fileMetadata.mimeType),
          source: 'google_drive',
          sourceId: fileId,
          sourceUrl: fileMetadata.webViewLink,
          mimeType: fileMetadata.mimeType,
          size: parseInt(fileMetadata.size, 10) || 0,
          userId: req.userId,
          workspaceId,
          lastSyncedAt: new Date(),
          processingStatus: 'pending',
        });

        await document.save();

        // Process document
        let contentToProcess: string | Buffer;

        if (exportedMimeType === 'text/plain' || exportedMimeType === 'text/csv') {
          contentToProcess = content;
        } else {
          contentToProcess = Buffer.from(content, 'base64');
        }

        processDocument(document._id.toString(), contentToProcess, exportedMimeType).catch(
          console.error
        );

        results.push({
          fileId,
          status: 'imported',
          documentId: document._id.toString(),
        });

        // Update workspace stats
        workspace.stats.documentCount += 1;
        workspace.stats.totalSize += document.size;
      } catch (error) {
        results.push({
          fileId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    workspace.stats.lastActivity = new Date();
    await workspace.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(workspaceId).emit('documents:batch-imported', {
      count: results.filter((r) => r.status === 'imported').length,
    });

    res.json({ results });
  } catch (error) {
    console.error('Batch import error:', error);
    res.status(500).json({ error: 'Failed to import files' });
  }
});

// Sync document from Google Drive (update existing)
router.post('/sync/:documentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { documentId } = req.params;

    const document = await DocumentModel.findById(documentId);

    if (!document || document.source !== 'google_drive' || !document.sourceId) {
      res.status(404).json({ error: 'Document not found or not from Google Drive' });
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

    const user = await User.findById(req.userId);

    if (!user?.googleAccessToken) {
      res.status(401).json({ error: 'Google Drive not connected' });
      return;
    }

    const drive = getDriveClient(user.googleAccessToken, user.googleRefreshToken);

    // Get updated content
    const { content, exportedMimeType } = await getFileContent(
      drive,
      document.sourceId,
      document.mimeType
    );

    // Reset processing status
    document.processingStatus = 'pending';
    document.lastSyncedAt = new Date();
    await document.save();

    // Process document
    let contentToProcess: string | Buffer;

    if (exportedMimeType === 'text/plain' || exportedMimeType === 'text/csv') {
      contentToProcess = content;
    } else {
      contentToProcess = Buffer.from(content, 'base64');
    }

    processDocument(document._id.toString(), contentToProcess, exportedMimeType).catch(
      console.error
    );

    // Emit socket event
    const io = req.app.get('io');
    io.to(document.workspaceId.toString()).emit('document:synced', {
      id: document._id,
      title: document.title,
    });

    res.json({
      id: document._id,
      title: document.title,
      status: 'syncing',
      message: 'Document sync started',
    });
  } catch (error) {
    console.error('Sync document error:', error);
    res.status(500).json({ error: 'Failed to sync document' });
  }
});

export default router;
