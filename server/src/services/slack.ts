import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';
import { DocumentModel, IDocumentChunk } from '../models/Document.js';

dotenv.config();

let slack: WebClient | null = null;

const getSlackClient = (): WebClient => {
  if (!slack) {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      throw new Error('SLACK_BOT_TOKEN not configured');
    }
    slack = new WebClient(token);
  }
  return slack;
};

export const isSlackConfigured = (): boolean => {
  return !!process.env.SLACK_BOT_TOKEN;
};

interface SlackMessage {
  text: string;
  user: string;
  userName?: string;
  timestamp: string;
  date: Date;
}

interface SlackChannel {
  id: string;
  name: string;
  memberCount?: number;
  topic?: string;
  purpose?: string;
}

// Fetch list of public channels
export const listChannels = async (): Promise<SlackChannel[]> => {
  const client = getSlackClient();

  const result = await client.conversations.list({
    types: 'public_channel',
    exclude_archived: true,
    limit: 100,
  });

  if (!result.channels) {
    return [];
  }

  return result.channels.map((ch) => ({
    id: ch.id || '',
    name: ch.name || '',
    memberCount: ch.num_members,
    topic: ch.topic?.value,
    purpose: ch.purpose?.value,
  }));
};

// Fetch user info to get display names
const userCache: Map<string, string> = new Map();

const getUserName = async (userId: string): Promise<string> => {
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  try {
    const client = getSlackClient();
    const result = await client.users.info({ user: userId });
    const name = result.user?.real_name || result.user?.name || userId;
    userCache.set(userId, name);
    return name;
  } catch {
    return userId;
  }
};

// Parse Slack message text to replace user mentions with names
const parseSlackText = async (text: string): Promise<string> => {
  // Replace user mentions <@U123ABC> with actual names
  const userMentionRegex = /<@([A-Z0-9]+)>/g;
  const matches = text.match(userMentionRegex);

  if (!matches) return text;

  let parsed = text;
  for (const match of matches) {
    const userId = match.slice(2, -1); // Remove <@ and >
    const userName = await getUserName(userId);
    parsed = parsed.replace(match, `@${userName}`);
  }

  // Replace channel mentions <#C123ABC|channel-name> with #channel-name
  parsed = parsed.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1');

  // Replace URLs <http://example.com|example.com> with just the URL
  parsed = parsed.replace(/<(https?:\/\/[^|>]+)\|[^>]+>/g, '$1');
  parsed = parsed.replace(/<(https?:\/\/[^>]+)>/g, '$1');

  // Replace special characters
  parsed = parsed.replace(/&amp;/g, '&');
  parsed = parsed.replace(/&lt;/g, '<');
  parsed = parsed.replace(/&gt;/g, '>');

  return parsed;
};

// Fetch messages from a channel
export const getChannelMessages = async (
  channelId: string,
  limit = 200
): Promise<SlackMessage[]> => {
  const client = getSlackClient();

  // Join the channel first (bot needs to be a member)
  try {
    await client.conversations.join({ channel: channelId });
  } catch {
    // May already be a member, continue
  }

  const result = await client.conversations.history({
    channel: channelId,
    limit,
  });

  if (!result.messages) {
    return [];
  }

  // Get user names for all messages
  const messages: SlackMessage[] = [];

  for (const msg of result.messages) {
    if (!msg.text || msg.subtype === 'channel_join' || msg.subtype === 'channel_leave') {
      continue; // Skip system messages
    }

    const userName = msg.user ? await getUserName(msg.user) : 'Unknown';
    const timestamp = msg.ts || '0';

    // Parse the message text to replace mentions with names
    const parsedText = await parseSlackText(msg.text);

    messages.push({
      text: parsedText,
      user: msg.user || 'unknown',
      userName,
      timestamp,
      date: new Date(parseFloat(timestamp) * 1000),
    });
  }

  // Return in chronological order (oldest first)
  return messages.reverse();
};

// Chunk text for RAG
const chunkText = (text: string, chunkSize = 1000): IDocumentChunk[] => {
  const chunks: IDocumentChunk[] = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push({
      content: text.substring(i, Math.min(i + chunkSize, text.length)).trim(),
      metadata: { startIndex: i, endIndex: Math.min(i + chunkSize, text.length) },
    });
  }

  return chunks;
};

// Import a Slack channel as a document
export const importChannelAsDocument = async (
  channelId: string,
  channelName: string,
  workspaceId: string,
  userId: string
): Promise<typeof DocumentModel.prototype> => {
  console.log(`📥 Importing Slack channel #${channelName}...`);

  // Fetch messages
  const messages = await getChannelMessages(channelId, 500);
  console.log(`📨 Fetched ${messages.length} messages from #${channelName}`);

  if (messages.length === 0) {
    throw new Error(`No messages found in #${channelName}`);
  }

  // Convert messages to readable text content
  const content = messages
    .map((m) => {
      const dateStr = m.date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `[${dateStr}] ${m.userName}: ${m.text}`;
    })
    .join('\n\n');

  // Create chunks for RAG
  const chunks = chunkText(content);
  console.log(`📦 Created ${chunks.length} chunks`);

  // Create summary from first few messages
  const summaryMessages = messages.slice(0, 5).map(m => m.text).join(' ');
  const summary = `Slack channel #${channelName} with ${messages.length} messages. Recent topics: ${summaryMessages.substring(0, 200)}...`;

  // Check if document already exists for this channel
  const existingDoc = await DocumentModel.findOne({
    workspaceId,
    source: 'slack',
    sourceId: channelId,
  });

  if (existingDoc) {
    // Update existing document
    existingDoc.content = content;
    existingDoc.chunks = chunks;
    existingDoc.summary = summary;
    existingDoc.processingStatus = 'completed';
    existingDoc.updatedAt = new Date();
    await existingDoc.save();
    console.log(`✅ Updated existing Slack document for #${channelName}`);
    return existingDoc;
  }

  // Create new document
  const document = new DocumentModel({
    title: `Slack: #${channelName}`,
    type: 'slack',
    source: 'slack',
    sourceId: channelId,
    mimeType: 'text/plain',
    content,
    chunks,
    summary,
    size: Buffer.byteLength(content, 'utf8'),
    workspaceId,
    userId,
    processingStatus: 'completed',
    entities: [],
    tags: ['slack', channelName],
  });

  await document.save();
  console.log(`✅ Imported Slack channel #${channelName} as document`);

  return document;
};

// Sync multiple channels
export const syncChannels = async (
  channelIds: string[],
  workspaceId: string,
  userId: string
): Promise<{ success: string[]; failed: string[] }> => {
  const channels = await listChannels();
  const channelMap = new Map(channels.map((c) => [c.id, c.name]));

  const success: string[] = [];
  const failed: string[] = [];

  for (const channelId of channelIds) {
    const channelName = channelMap.get(channelId);
    if (!channelName) {
      failed.push(channelId);
      continue;
    }

    try {
      await importChannelAsDocument(channelId, channelName, workspaceId, userId);
      success.push(channelName);
    } catch (error) {
      console.error(`Failed to import #${channelName}:`, error);
      failed.push(channelName);
    }
  }

  return { success, failed };
};
