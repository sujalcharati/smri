import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Workflow, IWorkflowStep } from '../models/Workflow.js';
import { Workspace } from '../models/Workspace.js';
import { executeWorkflowStep } from '../services/gemini.js';
import { searchDocuments } from '../services/documentProcessor.js';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const router = Router();

// Create workflow
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, name, description, trigger, steps } = req.body;

    if (!workspaceId || !name || !trigger) {
      res.status(400).json({ error: 'Workspace ID, name, and trigger required' });
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

    // Add IDs to steps
    const processedSteps = (steps || []).map((step: Partial<IWorkflowStep>) => ({
      ...step,
      id: step.id || uuidv4(),
      status: 'pending',
    }));

    const workflow = new Workflow({
      name,
      description,
      trigger,
      steps: processedSteps,
      userId: req.userId,
      workspaceId,
      status: 'draft',
    });

    await workflow.save();

    res.status(201).json({
      id: workflow._id,
      name: workflow.name,
      status: workflow.status,
    });
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// Get workflows
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, status } = req.query;

    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID required' });
      return;
    }

    const query: Record<string, unknown> = {
      workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      userId: req.userId,
    };

    if (status) query.status = status;

    const workflows = await Workflow.find(query)
      .select('name description trigger status lastRunAt runCount createdAt updatedAt')
      .sort({ updatedAt: -1 });

    res.json({ workflows });
  } catch (error) {
    console.error('Get workflows error:', error);
    res.status(500).json({ error: 'Failed to get workflows' });
  }
});

// Get single workflow
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workflow = await Workflow.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    res.json(workflow);
  } catch (error) {
    console.error('Get workflow error:', error);
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

// Update workflow
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, trigger, steps, status } = req.body;

    const workflow = await Workflow.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    if (name) workflow.name = name;
    if (description !== undefined) workflow.description = description;
    if (trigger) workflow.trigger = trigger;
    if (steps) {
      workflow.steps = steps.map((step: Partial<IWorkflowStep>) => ({
        ...step,
        id: step.id || uuidv4(),
        status: step.status || 'pending',
      }));
    }
    if (status && ['draft', 'active', 'paused'].includes(status)) {
      workflow.status = status;
    }

    await workflow.save();

    res.json(workflow);
  } catch (error) {
    console.error('Update workflow error:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// Run workflow manually
router.post('/:id/run', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { input } = req.body;

    const workflow = await Workflow.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    // Update status
    workflow.status = 'running';
    workflow.lastRunAt = new Date();
    workflow.runCount += 1;

    // Reset step statuses
    workflow.steps.forEach((step) => {
      step.status = 'pending';
      step.output = undefined;
      step.error = undefined;
    });

    await workflow.save();

    // Emit start event
    const io = req.app.get('io');
    io.to(workflow.workspaceId.toString()).emit('workflow:started', {
      id: workflow._id,
      name: workflow.name,
    });

    // Execute steps sequentially
    let currentInput = input || {};

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      step.status = 'running';
      step.startedAt = new Date();
      await workflow.save();

      io.to(workflow.workspaceId.toString()).emit('workflow:step', {
        workflowId: workflow._id,
        stepId: step.id,
        status: 'running',
      });

      try {
        let output: unknown;

        // Execute based on step type
        switch (step.type) {
          case 'search':
            const searchResults = await searchDocuments(
              workflow.workspaceId.toString(),
              step.config.query as string || JSON.stringify(currentInput),
              step.config.limit as number || 10
            );
            output = searchResults;
            break;

          case 'summarize':
          case 'extract':
          case 'analyze':
            output = await executeWorkflowStep(step.type, step.config, currentInput);
            break;

          case 'notify':
            // Emit notification event
            io.to(workflow.workspaceId.toString()).emit('notification', {
              type: 'workflow',
              title: step.config.title || 'Workflow Notification',
              message: step.config.message || JSON.stringify(currentInput),
            });
            output = { notified: true };
            break;

          default:
            output = { error: `Unknown step type: ${step.type}` };
        }

        step.output = output;
        step.status = 'completed';
        step.completedAt = new Date();
        currentInput = output; // Pass output to next step
      } catch (error) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : 'Unknown error';
        step.completedAt = new Date();

        // Mark workflow as failed
        workflow.status = 'failed';
        await workflow.save();

        io.to(workflow.workspaceId.toString()).emit('workflow:step', {
          workflowId: workflow._id,
          stepId: step.id,
          status: 'failed',
          error: step.error,
        });

        res.json({
          status: 'failed',
          failedStep: step.id,
          error: step.error,
          workflow,
        });
        return;
      }

      await workflow.save();

      io.to(workflow.workspaceId.toString()).emit('workflow:step', {
        workflowId: workflow._id,
        stepId: step.id,
        status: 'completed',
        output: step.output,
      });
    }

    // Mark workflow as completed
    workflow.status = 'completed';
    await workflow.save();

    io.to(workflow.workspaceId.toString()).emit('workflow:completed', {
      id: workflow._id,
      name: workflow.name,
    });

    res.json({
      status: 'completed',
      workflow,
    });
  } catch (error) {
    console.error('Run workflow error:', error);
    res.status(500).json({ error: 'Failed to run workflow' });
  }
});

// Delete workflow
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await Workflow.deleteOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    res.json({ message: 'Workflow deleted' });
  } catch (error) {
    console.error('Delete workflow error:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// Get workflow templates
router.get('/templates/list', authenticate, async (_req: AuthRequest, res: Response) => {
  const templates = [
    {
      id: 'daily-summary',
      name: 'Daily Document Summary',
      description: 'Summarize all documents added in the last 24 hours',
      trigger: { type: 'scheduled', config: { cron: '0 9 * * *' } },
      steps: [
        { type: 'search', name: 'Find Recent Docs', config: { query: 'recent', limit: 20 } },
        { type: 'summarize', name: 'Generate Summary', config: {} },
        { type: 'notify', name: 'Send Summary', config: { title: 'Daily Summary' } },
      ],
    },
    {
      id: 'keyword-alert',
      name: 'Keyword Alert',
      description: 'Get notified when specific keywords appear in new documents',
      trigger: { type: 'document_added', config: {} },
      steps: [
        { type: 'search', name: 'Search Keywords', config: { query: 'TODO: set keywords' } },
        { type: 'analyze', name: 'Check Relevance', config: { analysisType: 'relevance' } },
        { type: 'notify', name: 'Alert', config: { title: 'Keyword Match Found' } },
      ],
    },
    {
      id: 'onboarding-helper',
      name: 'New Employee Onboarding',
      description: 'Compile relevant documents for new team members',
      trigger: { type: 'manual', config: {} },
      steps: [
        { type: 'search', name: 'Find Onboarding Docs', config: { query: 'onboarding guide policy' } },
        { type: 'summarize', name: 'Create Overview', config: {} },
        { type: 'extract', name: 'Extract Action Items', config: { extract: ['tasks', 'contacts', 'links'] } },
      ],
    },
  ];

  res.json({ templates });
});

export default router;
