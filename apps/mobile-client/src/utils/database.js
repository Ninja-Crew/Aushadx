import * as SQLite from 'expo-sqlite';

const DB_NAME = 'aushadx.db';

export const getDatabase = async () => {
  return await SQLite.openDatabaseAsync(DB_NAME);
};

export const initDatabase = async () => {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS notifications (
      reminderId TEXT PRIMARY KEY,
      title TEXT,
      body TEXT,
      data TEXT,
      timestamp INTEGER
    );
  `);
};

export const runQuery = async (query, params = []) => {
  const db = await getDatabase();
  return await db.runAsync(query, params);
};

export const fetchQuery = async (query, params = []) => {
  const db = await getDatabase();
  return await db.getAllAsync(query, params);
};

export const fetchOneQuery = async (query, params = []) => {
  const db = await getDatabase();
  return await db.getFirstAsync(query, params);
};
