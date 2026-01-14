import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkspace extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  ownerId: mongoose.Types.ObjectId;
  members: {
    userId: mongoose.Types.ObjectId;
    role: 'owner' | 'admin' | 'member';
    joinedAt: Date;
  }[];
  settings: {
    driveIntegration: boolean;
    driveFolderId?: string;
    autoSync: boolean;
    syncInterval: number; // in minutes
  };
  stats: {
    documentCount: number;
    totalSize: number;
    lastActivity: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<IWorkspace>(
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
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [{
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      role: {
        type: String,
        enum: ['owner', 'admin', 'member'],
        default: 'member',
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    settings: {
      driveIntegration: {
        type: Boolean,
        default: false,
      },
      driveFolderId: String,
      autoSync: {
        type: Boolean,
        default: false,
      },
      syncInterval: {
        type: Number,
        default: 60, // 60 minutes
      },
    },
    stats: {
      documentCount: {
        type: Number,
        default: 0,
      },
      totalSize: {
        type: Number,
        default: 0,
      },
      lastActivity: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  }
);

workspaceSchema.index({ ownerId: 1 });
workspaceSchema.index({ 'members.userId': 1 });

export const Workspace = mongoose.model<IWorkspace>('Workspace', workspaceSchema);
