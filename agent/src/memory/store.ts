import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import fs from 'node:fs';

export interface Message {
  id: number;
  session_id: number;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  created_at: number;
}

export class MemoryStore {
  private db: Database.Database;
  private vecDim: number;
  constructor(dbPath: string, vecDim = 1536) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    sqliteVec.load(this.db);
    this.vecDim = vecDim;
    this.migrate();
  }
  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        topic TEXT DEFAULT '',
        created_at INTEGER NOT NULL,
        UNIQUE(channel, chat_id, topic)
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS vectors USING vec0(
        embedding float[${this.vecDim}]
      );
      CREATE TABLE IF NOT EXISTS vector_meta (
        rowid INTEGER PRIMARY KEY,
        session_id INTEGER NOT NULL,
        ref TEXT NOT NULL,
        snippet TEXT NOT NULL
      );
    `);
  }
  getOrCreateSession(channel: string, chatId: string, topic = ''): number {
    const row = this.db.prepare(`SELECT id FROM sessions WHERE channel=? AND chat_id=? AND topic=?`).get(channel, chatId, topic) as any;
    if (row) return row.id;
    const r = this.db.prepare(`INSERT INTO sessions(channel,chat_id,topic,created_at) VALUES(?,?,?,?)`).run(channel, chatId, topic, Date.now());
    return Number(r.lastInsertRowid);
  }
  appendMessage(sessionId: number, role: Message['role'], content: string): number {
    const r = this.db.prepare(`INSERT INTO messages(session_id,role,content,created_at) VALUES(?,?,?,?)`).run(sessionId, role, content, Date.now());
    return Number(r.lastInsertRowid);
  }
  recentMessages(sessionId: number, limit = 50): Message[] {
    return this.db.prepare(`SELECT * FROM messages WHERE session_id=? ORDER BY id ASC LIMIT ?`).all(sessionId, limit) as Message[];
  }
  indexVector(sessionId: number, ref: string, snippet: string, vec: Float32Array) {
    const r = this.db.prepare(`INSERT INTO vectors(embedding) VALUES(?)`).run(Buffer.from(vec.buffer));
    this.db.prepare(`INSERT INTO vector_meta(rowid,session_id,ref,snippet) VALUES(?,?,?,?)`).run(Number(r.lastInsertRowid), sessionId, ref, snippet);
  }
  searchVectors(vec: Float32Array, k = 5): { snippet: string; ref: string; distance: number }[] {
    return this.db.prepare(`
      SELECT m.snippet, m.ref, v.distance
      FROM vectors v
      JOIN vector_meta m ON m.rowid = v.rowid
      WHERE v.embedding MATCH ? AND k = ?
      ORDER BY v.distance ASC
    `).all(Buffer.from(vec.buffer), k) as any;
  }
  countMessages(sessionId: number): number {
    return (this.db.prepare(`SELECT COUNT(*) as c FROM messages WHERE session_id=?`).get(sessionId) as any).c;
  }
  deleteOldMessages(sessionId: number, keepLast: number) {
    this.db.prepare(`DELETE FROM messages WHERE session_id=? AND id NOT IN (SELECT id FROM messages WHERE session_id=? ORDER BY id DESC LIMIT ?)`).run(sessionId, sessionId, keepLast);
  }
  close() { this.db.close(); }
}
