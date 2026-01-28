import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkflowStep {
  id: string;
  name: string;
  type: 'search' | 'summarize' | 'extract' | 'analyze' | 'notify' | 'custom';
  config: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface IWorkflow extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  trigger: {
    type: 'manual' | 'scheduled' | 'document_added' | 'keyword_mention';
    config: Record<string, unknown>;
  };
  steps: IWorkflowStep[];
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  status: 'draft' | 'active' | 'paused' | 'running' | 'completed' | 'failed';
  lastRunAt?: Date;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const workflowStepSchema = new Schema<IWorkflowStep>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['search', 'summarize', 'extract', 'analyze', 'notify', 'custom'],
      required: true,
    },
    config: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    output: Schema.Types.Mixed,
    error: String,
    startedAt: Date,
    completedAt: Date,
  },
  { _id: false }
);

const workflowSchema = new Schema<IWorkflow>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    trigger: {
      type: {
        type: String,
        enum: ['manual', 'scheduled', 'document_added', 'keyword_mention'],
        required: true,
      },
      config: { type: Schema.Types.Mixed, default: {} },
    },
    steps: [workflowStepSchema],
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'running', 'completed', 'failed'],
      default: 'draft',
    },
    lastRunAt: Date,
    runCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

workflowSchema.index({ userId: 1, workspaceId: 1 });
workflowSchema.index({ status: 1 });

export const Workflow = mongoose.model<IWorkflow>('Workflow', workflowSchema);
