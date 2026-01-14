import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: {
    documentId: mongoose.Types.ObjectId;
    documentTitle: string;
    relevantChunk: string;
    confidence: number;
  }[];
  timestamp: Date;
}

export interface IChat extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  messages: IChatMessage[];
  context: {
    documentIds: mongoose.Types.ObjectId[];
    searchQuery?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sources: [{
      documentId: { type: Schema.Types.ObjectId, ref: 'Document' },
      documentTitle: String,
      relevantChunk: String,
      confidence: Number,
    }],
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatSchema = new Schema<IChat>(
  {
    title: {
      type: String,
      default: 'New Chat',
    },
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
    messages: [chatMessageSchema],
    context: {
      documentIds: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
      searchQuery: String,
    },
  },
  {
    timestamps: true,
  }
);

chatSchema.index({ userId: 1, workspaceId: 1 });
chatSchema.index({ updatedAt: -1 });

export const Chat = mongoose.model<IChat>('Chat', chatSchema);
