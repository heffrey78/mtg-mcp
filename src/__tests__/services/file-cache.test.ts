import { FileCache } from '../../services/file-cache.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

describe('FileCache', () => {
  let fileCache: FileCache;
  let testCacheDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testCacheDir = path.join(tmpdir(), `file-cache-test-${Date.now()}`);
    
    fileCache = new FileCache({
      cacheDir: testCacheDir,
      defaultTtl: 1000, // 1 second for testing
      maxFileAge: 5000, // 5 seconds for testing
      compressionEnabled: false,
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rmdir(testCacheDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should set and get cache entries', async () => {
    const testData = { test: 'data', number: 42 };
    
    await fileCache.set('test-key', testData);
    const result = await fileCache.get('test-key');
    
    expect(result).toEqual(testData);
  });

  it('should return null for non-existent keys', async () => {
    const result = await fileCache.get('non-existent');
    expect(result).toBeNull();
  });

  it('should respect TTL and expire entries', async () => {
    const testData = { test: 'data' };
    
    // Set with short TTL
    await fileCache.set('test-key', testData, 100); // 100ms
    
    // Should exist immediately
    let result = await fileCache.get('test-key');
    expect(result).toEqual(testData);
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should be expired
    result = await fileCache.get('test-key');
    expect(result).toBeNull();
  });

  it('should delete entries', async () => {
    const testData = { test: 'data' };
    
    await fileCache.set('test-key', testData);
    let result = await fileCache.get('test-key');
    expect(result).toEqual(testData);
    
    await fileCache.delete('test-key');
    result = await fileCache.get('test-key');
    expect(result).toBeNull();
  });

  it('should clear all entries', async () => {
    await fileCache.set('key1', { data: 1 });
    await fileCache.set('key2', { data: 2 });
    
    // Verify entries exist
    expect(await fileCache.get('key1')).toEqual({ data: 1 });
    expect(await fileCache.get('key2')).toEqual({ data: 2 });
    
    await fileCache.clear();
    
    // Verify entries are gone
    expect(await fileCache.get('key1')).toBeNull();
    expect(await fileCache.get('key2')).toBeNull();
  });

  it('should provide cache statistics', async () => {
    await fileCache.set('key1', { data: 1 });
    await fileCache.set('key2', { data: 2 });
    
    const stats = await fileCache.getStats();
    
    expect(stats.totalFiles).toBe(2);
    expect(stats.totalSize).toBeGreaterThan(0);
    expect(stats.oldestEntry).toBeGreaterThan(0);
    expect(stats.newestEntry).toBeGreaterThan(0);
  });

  it('should cleanup expired entries', async () => {
    // Set entries with different TTLs
    await fileCache.set('short', { data: 'short' }, 50); // 50ms
    await fileCache.set('long', { data: 'long' }, 5000); // 5 seconds
    
    // Wait for short entry to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await fileCache.cleanup();
    
    // Short entry should be gone, long entry should remain
    expect(await fileCache.get('short')).toBeNull();
    expect(await fileCache.get('long')).toEqual({ data: 'long' });
  });

  it('should handle compression setting', async () => {
    const compressedCacheDir = path.join(testCacheDir, 'compressed');
    const compressedCache = new FileCache({
      cacheDir: compressedCacheDir,
      defaultTtl: 1000,
      maxFileAge: 5000,
      compressionEnabled: true,
    });

    const testData = { test: 'data', array: [1, 2, 3, 4, 5] };
    
    await compressedCache.set('test-key', testData);
    const result = await compressedCache.get('test-key');
    
    expect(result).toEqual(testData);
  });

  it('should handle file system errors gracefully', async () => {
    // Try to get from non-existent key (should not throw)
    const result = await fileCache.get('non-existent');
    expect(result).toBeNull();
    
    // Try to delete non-existent key (should not throw)
    await expect(fileCache.delete('non-existent')).resolves.not.toThrow();
    
    // Stats on empty cache
    const stats = await fileCache.getStats();
    expect(stats.totalFiles).toBe(0);
  });
});