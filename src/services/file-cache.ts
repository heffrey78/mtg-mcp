import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface FileCacheConfig {
  cacheDir: string;
  defaultTtl: number;
  maxFileAge: number; // Maximum age before file cleanup
  compressionEnabled: boolean;
}

export class FileCache {
  private cacheDir: string;
  private defaultTtl: number;
  private maxFileAge: number;
  private compressionEnabled: boolean;

  constructor(config: FileCacheConfig) {
    this.cacheDir = config.cacheDir;
    this.defaultTtl = config.defaultTtl;
    this.maxFileAge = config.maxFileAge;
    this.compressionEnabled = config.compressionEnabled;
    
    this.ensureCacheDir();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const filePath = this.getFilePath(key);
      const data = await fs.readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(data);
      
      // Check if entry is expired
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        // Entry expired, clean it up
        await this.delete(key);
        return null;
      }
      
      logger.debug(`File cache hit for key: ${key}`);
      return entry.data;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist, cache miss
        return null;
      }
      logger.error(`Error reading from file cache for key ${key}:`, error as Record<string, unknown>);
      return null;
    }
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      // Ensure directory exists before writing
      await this.ensureCacheDir();
      
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTtl,
      };
      
      const filePath = this.getFilePath(key);
      const serializedData = JSON.stringify(entry, null, this.compressionEnabled ? 0 : 2);
      
      await fs.writeFile(filePath, serializedData, 'utf-8');
      logger.debug(`File cache set for key: ${key}`);
    } catch (error) {
      logger.error(`Error writing to file cache for key ${key}:`, error as Record<string, unknown>);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
      logger.debug(`File cache deleted for key: ${key}`);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error(`Error deleting from file cache for key ${key}:`, error as Record<string, unknown>);
      }
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
      logger.info('File cache cleared');
    } catch (error) {
      logger.error('Error clearing file cache:', error as Record<string, unknown>);
    }
  }

  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const stats = await fs.stat(filePath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > this.maxFileAge) {
            await fs.unlink(filePath);
            deletedCount++;
          } else {
            // Also check if the cached entry itself is expired
            const data = await fs.readFile(filePath, 'utf-8');
            const entry: CacheEntry<any> = JSON.parse(data);
            
            if (now - entry.timestamp > entry.ttl) {
              await fs.unlink(filePath);
              deletedCount++;
            }
          }
        } catch (error) {
          // If we can't read or parse the file, delete it
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info(`File cache cleanup: removed ${deletedCount} expired entries`);
      }
    } catch (error) {
      logger.error('Error during file cache cleanup:', error as Record<string, unknown>);
    }
  }

  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      let oldestEntry: number | null = null;
      let newestEntry: number | null = null;

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          
          const mtime = stats.mtime.getTime();
          if (oldestEntry === null || mtime < oldestEntry) {
            oldestEntry = mtime;
          }
          if (newestEntry === null || mtime > newestEntry) {
            newestEntry = mtime;
          }
        } catch (error) {
          // Skip files we can't read
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        oldestEntry,
        newestEntry,
      };
    } catch (error) {
      logger.error('Error getting file cache stats:', error as Record<string, unknown>);
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  private getFilePath(key: string): string {
    // Create a safe filename from the cache key
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      logger.error(`Error creating cache directory ${this.cacheDir}:`, error as Record<string, unknown>);
    }
  }

  // Start periodic cleanup
  startPeriodicCleanup(intervalMs: number = 3600000): NodeJS.Timeout { // Default 1 hour
    return setInterval(() => {
      this.cleanup().catch(error => {
        logger.error('Error during periodic cache cleanup:', error as Record<string, unknown>);
      });
    }, intervalMs);
  }
}