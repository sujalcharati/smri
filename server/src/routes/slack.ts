import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Workspace } from '../models/Workspace.js';
import {
  isSlackConfigured,
  listChannels,
  importChannelAsDocument,
  syncChannels,
} from '../services/slack.js';

const router = Router();

// Check if Slack is configured
router.get('/status', authenticate, async (_req: AuthRequest, res: Response) => {
  res.json({
    configured: isSlackConfigured(),
    message: isSlackConfigured()
      ? 'Slack integration is configured'
      : 'SLACK_BOT_TOKEN not set in environment',
  });
});

// List available Slack channels
router.get('/channels', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    if (!isSlackConfigured()) {
      res.status(400).json({ error: 'Slack not configured. Add SLACK_BOT_TOKEN to .env' });
      return;
    }

    const channels = await listChannels();
    res.json({ channels });
  } catch (error) {
    console.error('List Slack channels error:', error);
    res.status(500).json({
      error: 'Failed to list Slack channels',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Import a single channel
router.post('/import', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!isSlackConfigured()) {
      res.status(400).json({ error: 'Slack not configured. Add SLACK_BOT_TOKEN to .env' });
      return;
    }

    const { channelId, channelName, workspaceId } = req.body;

    if (!channelId || !channelName || !workspaceId) {
      res.status(400).json({ error: 'channelId, channelName, and workspaceId are required' });
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

    const document = await importChannelAsDocument(
      channelId,
      channelName,
      workspaceId,
      req.userId!
    );

    // Update workspace stats
    workspace.stats.documentCount += 1;
    workspace.stats.lastActivity = new Date();
    await workspace.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(workspaceId).emit('document:created', {
      id: document._id,
      title: document.title,
      status: 'completed',
      source: 'slack',
    });

    res.status(201).json({
      id: document._id,
      title: document.title,
      type: document.type,
      status: document.processingStatus,
      messageCount: document.content?.split('\n\n').length || 0,
      message: `Successfully imported #${channelName}`,
    });
  } catch (error) {
    console.error('Import Slack channel error:', error);
    res.status(500).json({
      error: 'Failed to import Slack channel',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Sync multiple channels
router.post('/sync', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!isSlackConfigured()) {
      res.status(400).json({ error: 'Slack not configured. Add SLACK_BOT_TOKEN to .env' });
      return;
    }

    const { channelIds, workspaceId } = req.body;

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      res.status(400).json({ error: 'channelIds array is required' });
      return;
    }

    if (!workspaceId) {
      res.status(400).json({ error: 'workspaceId is required' });
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

    const result = await syncChannels(channelIds, workspaceId, req.userId!);

    // Update workspace stats
    workspace.stats.documentCount += result.success.length;
    workspace.stats.lastActivity = new Date();
    await workspace.save();

    res.json({
      message: `Synced ${result.success.length} channels`,
      success: result.success,
      failed: result.failed,
    });
  } catch (error) {
    console.error('Sync Slack channels error:', error);
    res.status(500).json({
      error: 'Failed to sync Slack channels',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
