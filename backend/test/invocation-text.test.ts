import { describe, it, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import { prepareInvocationText, channelContextLine } from '../src/agents/invoker.js';
import type { ChannelDoc, MessageDoc, AgentDoc } from '../src/db/types.js';

const userMsg: MessageDoc = {
  _id: new ObjectId(),
  channelId: new ObjectId(),
  serverId: new ObjectId(),
  authorType: 'user',
  authorId: new ObjectId(),
  content: 'find me AI papers',
  mentions: [],
  replyToId: null,
  createdAt: new Date(),
  editedAt: null,
};

const agentMsg: MessageDoc = { ...userMsg, _id: new ObjectId(), authorType: 'agent', content: '@critic please look' };

const targetAgent: AgentDoc = {
  _id: new ObjectId(),
  name: 'Critic', slug: 'critic', avatarUrl: null, description: 'critiques', bio: null, tags: [],
  baseUrl: 'http://x', visibility: 'public', createdBy: new ObjectId(),
  createdAt: new Date(), updatedAt: new Date(),
};

const channel: ChannelDoc = {
  _id: new ObjectId(),
  serverId: new ObjectId(),
  name: 'research',
  topic: null,
  type: 'text',
  defaultAgentId: null,
  position: 0,
  createdAt: new Date(),
};

const peerSlugs = ['researcher', 'critic', 'summarizer'];

describe('prepareInvocationText', () => {
  it('prepends a context line that contains channel name and peer slugs', () => {
    const out = prepareInvocationText({ parent: userMsg, target: targetAgent, channel, peerSlugs, speakerLabel: '@alice' });
    expect(out).toContain('#research');
    expect(out).toContain('@researcher');
    expect(out).toContain('@critic');
    expect(out).toContain('find me AI papers');
    expect(out.startsWith('[')).toBe(true);
  });

  it('annotates agent-authored messages with the speaker label', () => {
    const out = prepareInvocationText({ parent: agentMsg, target: targetAgent, channel, peerSlugs, speakerLabel: '@researcher' });
    expect(out).toContain('@researcher');
    expect(out).toContain('@critic please look');
  });

  it('excludes the target agent from the peer list it sees', () => {
    const out = prepareInvocationText({ parent: agentMsg, target: targetAgent, channel, peerSlugs, speakerLabel: '@researcher' });
    // The context line should list peers OTHER than the target — but the body still contains "@critic please look".
    // We assert by parsing just the first line.
    const firstLine = out.split('\n')[0];
    expect(firstLine).not.toMatch(/peers:.*@critic/);
  });
});

describe('channelContextLine', () => {
  it('formats as [@speaker -> @target in #channel | peers: ...]', () => {
    const line = channelContextLine({ channel, target: targetAgent, peerSlugs, speakerLabel: '@alice' });
    expect(line).toMatch(/^\[@alice (→|->) @critic in #research/);
    expect(line).toContain('peers:');
  });

  it('omits the peers segment when no other peers exist', () => {
    const line = channelContextLine({ channel, target: targetAgent, peerSlugs: ['critic'], speakerLabel: '@alice' });
    expect(line).not.toContain('peers:');
  });
});
