import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { DocumentModel } from '../models/Document.js';
import { Workspace } from '../models/Workspace.js';
import { analyzeRelations } from '../services/gemini.js';
import { findRelatedDocuments } from '../services/documentProcessor.js';
import mongoose from 'mongoose';

const router = Router();

// Get knowledge graph data
router.get('/graph', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.query;

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

    // Get all documents with entities
    const documents = await DocumentModel.find({
      workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      processingStatus: 'completed',
    }).select('title entities relations tags type');

    // Build nodes and edges for the graph
    const nodes: {
      id: string;
      label: string;
      type: 'document' | 'entity';
      entityType?: string;
      docType?: string;
      size: number;
    }[] = [];

    const edges: {
      source: string;
      target: string;
      type: string;
      weight: number;
    }[] = [];

    const entityMap = new Map<string, { mentions: number; type: string }>();

    // Add document nodes and collect entities
    documents.forEach((doc) => {
      nodes.push({
        id: doc._id.toString(),
        label: doc.title,
        type: 'document',
        docType: doc.type,
        size: 30,
      });

      // Collect entities
      doc.entities.forEach((entity) => {
        const key = `entity:${entity.name.toLowerCase()}`;
        const existing = entityMap.get(key);
        if (existing) {
          existing.mentions += entity.mentions;
        } else {
          entityMap.set(key, { mentions: entity.mentions, type: entity.type });
        }

        // Add edge from document to entity
        edges.push({
          source: doc._id.toString(),
          target: key,
          type: 'mentions',
          weight: entity.mentions,
        });
      });

      // Add relation edges
      doc.relations.forEach((rel) => {
        edges.push({
          source: doc._id.toString(),
          target: rel.documentId.toString(),
          type: rel.relationType,
          weight: rel.strength * 10,
        });
      });
    });

    // Add entity nodes
    entityMap.forEach((value, key) => {
      nodes.push({
        id: key,
        label: key.replace('entity:', ''),
        type: 'entity',
        entityType: value.type,
        size: Math.min(10 + value.mentions * 2, 50),
      });
    });

    res.json({
      nodes,
      edges,
      stats: {
        documentCount: documents.length,
        entityCount: entityMap.size,
        edgeCount: edges.length,
      },
    });
  } catch (error) {
    console.error('Get knowledge graph error:', error);
    res.status(500).json({ error: 'Failed to get knowledge graph' });
  }
});

// Get entities list
router.get('/entities', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, type, search, limit = '50' } = req.query;

    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID required' });
      return;
    }

    // Get all documents
    const documents = await DocumentModel.find({
      workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      processingStatus: 'completed',
    }).select('title entities');

    // Aggregate entities
    const entityMap = new Map<
      string,
      {
        name: string;
        type: string;
        mentions: number;
        documents: { id: string; title: string }[];
      }
    >();

    documents.forEach((doc) => {
      doc.entities.forEach((entity) => {
        const key = entity.name.toLowerCase();

        // Apply filters
        if (type && entity.type !== type) return;
        if (search && !key.includes((search as string).toLowerCase())) return;

        const existing = entityMap.get(key);
        if (existing) {
          existing.mentions += entity.mentions;
          existing.documents.push({ id: doc._id.toString(), title: doc.title });
        } else {
          entityMap.set(key, {
            name: entity.name,
            type: entity.type,
            mentions: entity.mentions,
            documents: [{ id: doc._id.toString(), title: doc.title }],
          });
        }
      });
    });

    // Convert to array and sort
    const entities = Array.from(entityMap.values())
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, parseInt(limit as string, 10));

    res.json({ entities });
  } catch (error) {
    console.error('Get entities error:', error);
    res.status(500).json({ error: 'Failed to get entities' });
  }
});

// Get related documents for a document
router.get('/related/:documentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { documentId } = req.params;

    const document = await DocumentModel.findById(documentId);
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

    // Find related documents
    const relatedIds = await findRelatedDocuments(
      documentId,
      document.workspaceId.toString(),
      10
    );

    const relatedDocs = await DocumentModel.find({
      _id: { $in: relatedIds },
    }).select('title type summary tags entities');

    res.json({ related: relatedDocs });
  } catch (error) {
    console.error('Get related documents error:', error);
    res.status(500).json({ error: 'Failed to get related documents' });
  }
});

// Analyze relationship between two documents
router.post('/analyze-relation', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { documentId1, documentId2 } = req.body;

    if (!documentId1 || !documentId2) {
      res.status(400).json({ error: 'Both document IDs required' });
      return;
    }

    const [doc1, doc2] = await Promise.all([
      DocumentModel.findById(documentId1),
      DocumentModel.findById(documentId2),
    ]);

    if (!doc1 || !doc2) {
      res.status(404).json({ error: 'Document(s) not found' });
      return;
    }

    // Verify workspace access
    const workspace = await Workspace.findOne({
      _id: doc1.workspaceId,
      'members.userId': req.userId,
    });

    if (!workspace || doc1.workspaceId.toString() !== doc2.workspaceId.toString()) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Analyze relationship using Gemini
    const analysis = await analyzeRelations(
      doc1.content.substring(0, 5000),
      doc2.content.substring(0, 5000)
    );

    // Store the relationship
    const existingRelation = doc1.relations.find(
      (r) => r.documentId.toString() === documentId2
    );

    if (existingRelation) {
      existingRelation.relationType = analysis.relationType as 'references' | 'related_to' | 'depends_on' | 'part_of';
      existingRelation.strength = analysis.strength;
    } else {
      doc1.relations.push({
        documentId: new mongoose.Types.ObjectId(documentId2),
        relationType: analysis.relationType as 'references' | 'related_to' | 'depends_on' | 'part_of',
        strength: analysis.strength,
      });
    }

    await doc1.save();

    res.json({
      document1: { id: doc1._id, title: doc1.title },
      document2: { id: doc2._id, title: doc2.title },
      relation: analysis,
    });
  } catch (error) {
    console.error('Analyze relation error:', error);
    res.status(500).json({ error: 'Failed to analyze relationship' });
  }
});

// Get insights/analytics
router.get('/insights', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.query;

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

    const wsId = new mongoose.Types.ObjectId(workspaceId as string);

    // Get various analytics
    const [
      totalDocs,
      docsByType,
      docsByStatus,
      recentDocs,
      topEntities,
    ] = await Promise.all([
      DocumentModel.countDocuments({ workspaceId: wsId }),

      DocumentModel.aggregate([
        { $match: { workspaceId: wsId } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),

      DocumentModel.aggregate([
        { $match: { workspaceId: wsId } },
        { $group: { _id: '$processingStatus', count: { $sum: 1 } } },
      ]),

      DocumentModel.find({ workspaceId: wsId })
        .select('title createdAt')
        .sort({ createdAt: -1 })
        .limit(5),

      DocumentModel.aggregate([
        { $match: { workspaceId: wsId, processingStatus: 'completed' } },
        { $unwind: '$entities' },
        {
          $group: {
            _id: { name: '$entities.name', type: '$entities.type' },
            mentions: { $sum: '$entities.mentions' },
          },
        },
        { $sort: { mentions: -1 } },
        { $limit: 10 },
      ]),
    ]);

    res.json({
      totalDocuments: totalDocs,
      documentsByType: docsByType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>),
      documentsByStatus: docsByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>),
      recentDocuments: recentDocs,
      topEntities: topEntities.map((e) => ({
        name: e._id.name,
        type: e._id.type,
        mentions: e.mentions,
      })),
      workspace: {
        name: workspace.name,
        memberCount: workspace.members.length,
        totalSize: workspace.stats.totalSize,
      },
    });
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

export default router;
