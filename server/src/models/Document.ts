import mongoose, { Document as MongoDocument, Schema } from 'mongoose';

export interface IDocumentChunk {
  content: string;
  embedding?: number[];
  metadata: {
    pageNumber?: number;
    section?: string;
    startIndex: number;
    endIndex: number;
  };
}

export interface IDocument extends MongoDocument {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  summary?: string;
  type: 'pdf' | 'doc' | 'docx' | 'txt' | 'sheet' | 'slide' | 'gdoc' | 'gsheet' | 'gslide';
  source: 'upload' | 'google_drive';
  sourceId?: string; // Google Drive file ID
  sourceUrl?: string;
  mimeType: string;
  size: number;
  chunks: IDocumentChunk[];
  tags: string[];
  entities: {
    name: string;
    type: 'person' | 'organization' | 'project' | 'technology' | 'concept';
    mentions: number;
  }[];
  relations: {
    documentId: mongoose.Types.ObjectId;
    relationType: 'references' | 'related_to' | 'depends_on' | 'part_of';
    strength: number;
  }[];
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  lastSyncedAt?: Date;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentChunkSchema = new Schema<IDocumentChunk>(
  {
    content: { type: String, required: true },
    embedding: [{ type: Number }],
    metadata: {
      pageNumber: Number,
      section: String,
      startIndex: { type: Number, required: true },
      endIndex: { type: Number, required: true },
    },
  },
  { _id: false }
);

const documentSchema = new Schema<IDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
    summary: {
      type: String,
    },
    type: {
      type: String,
      enum: ['pdf', 'doc', 'docx', 'txt', 'sheet', 'slide', 'gdoc', 'gsheet', 'gslide'],
      required: true,
    },
    source: {
      type: String,
      enum: ['upload', 'google_drive'],
      required: true,
    },
    sourceId: String,
    sourceUrl: String,
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    chunks: [documentChunkSchema],
    tags: [{ type: String }],
    entities: [{
      name: { type: String, required: true },
      type: {
        type: String,
        enum: ['person', 'organization', 'project', 'technology', 'concept'],
        required: true,
      },
      mentions: { type: Number, default: 1 },
    }],
    relations: [{
      documentId: { type: Schema.Types.ObjectId, ref: 'Document' },
      relationType: {
        type: String,
        enum: ['references', 'related_to', 'depends_on', 'part_of'],
      },
      strength: { type: Number, default: 0.5 },
    }],
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
    lastSyncedAt: Date,
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    processingError: String,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
documentSchema.index({ workspaceId: 1, processingStatus: 1 });
documentSchema.index({ userId: 1 });
documentSchema.index({ 'entities.name': 1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ title: 'text', content: 'text' });

export const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);
