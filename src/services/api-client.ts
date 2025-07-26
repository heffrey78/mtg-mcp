import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger.js';
import { FileCache, FileCacheConfig } from './file-cache.js';

export interface ApiConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelayMs: number;
  rateLimit: {
    requestsPerSecond: number;
    maxConcurrent: number;
  };
  cache: {
    ttl: number;
    maxKeys: number;
    persistentCache: {
      enabled: boolean;
      cacheDir: string;
      maxFileAge: number;
      compressionEnabled: boolean;
    };
  };
}

export interface ApiResponse<T> {
  data: T;
  cached: boolean;
  rateLimitRemaining?: number | undefined;
}

export interface RateLimiter {
  canMakeRequest(): boolean;
  recordRequest(): void;
  getDelay(): number;
}

export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private activeRequests = 0;

  constructor(requestsPerSecond: number, private maxConcurrent: number) {
    this.capacity = requestsPerSecond;
    this.refillRate = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.lastRefill = Date.now();
  }

  canMakeRequest(): boolean {
    this.refillTokens();
    return this.tokens >= 1 && this.activeRequests < this.maxConcurrent;
  }

  recordRequest(): void {
    if (!this.canMakeRequest()) {
      throw new Error('Rate limit exceeded');
    }
    this.tokens -= 1;
    this.activeRequests += 1;
    
    // Release the concurrent slot after a short delay
    setTimeout(() => {
      this.activeRequests -= 1;
    }, 100);
  }

  getDelay(): number {
    this.refillTokens();
    if (this.tokens >= 1) return 0;
    
    const timeUntilNextToken = 1000 / this.refillRate;
    return timeUntilNextToken;
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = (timePassed / 1000) * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

export class CircuitBreaker {
  private failureCount = 0;
  private nextAttempt = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'half-open';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
    }
  }

  getState(): string {
    return this.state;
  }
}

export class ApiClient {
  private client: AxiosInstance;
  private cache: NodeCache;
  private fileCache?: FileCache;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'User-Agent': 'MTG-MCP-Server/1.0.0',
        'Accept': 'application/json',
      },
    });

    this.cache = new NodeCache({
      stdTTL: config.cache.ttl,
      maxKeys: config.cache.maxKeys,
      checkperiod: 600, // Check for expired keys every 10 minutes
    });

    // Initialize file cache if enabled
    if (config.cache.persistentCache.enabled) {
      const fileCacheConfig: FileCacheConfig = {
        cacheDir: config.cache.persistentCache.cacheDir,
        defaultTtl: config.cache.ttl * 1000, // Convert to milliseconds
        maxFileAge: config.cache.persistentCache.maxFileAge,
        compressionEnabled: config.cache.persistentCache.compressionEnabled,
      };
      this.fileCache = new FileCache(fileCacheConfig);
      
      // Start periodic cleanup
      this.cleanupTimer = this.fileCache.startPeriodicCleanup();
    }

    this.rateLimiter = new TokenBucketRateLimiter(
      config.rateLimit.requestsPerSecond,
      config.rateLimit.maxConcurrent
    );

    this.circuitBreaker = new CircuitBreaker();

    // Add response interceptor for rate limit headers
    this.client.interceptors.response.use(
      (response) => {
        const remaining = response.headers['x-ratelimit-remaining'];
        if (remaining) {
          logger.debug(`API rate limit remaining: ${remaining}`);
        }
        return response;
      },
      (error) => {
        if (error.response?.status === 429) {
          logger.warn('Rate limit exceeded by API');
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const cacheKey = this.getCacheKey('GET', url, config);
    
    // Check memory cache first
    const memoryCached = this.cache.get<T>(cacheKey);
    if (memoryCached) {
      logger.debug(`Memory cache hit for ${url}`);
      return { data: memoryCached, cached: true };
    }

    // Check file cache if enabled
    if (this.fileCache) {
      const fileCached = await this.fileCache.get<T>(cacheKey);
      if (fileCached) {
        logger.debug(`File cache hit for ${url}`);
        // Populate memory cache for faster subsequent access
        this.cache.set(cacheKey, fileCached);
        return { data: fileCached, cached: true };
      }
    }

    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      const delay = this.rateLimiter.getDelay();
      if (delay > 0) {
        logger.debug(`Rate limited, waiting ${delay}ms`);
        await this.sleep(delay);
      }
    }

    this.rateLimiter.recordRequest();

    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.retryRequest(() => this.client.get<T>(url, config));
      });

      // Cache successful responses in both layers
      this.cache.set(cacheKey, response.data);
      if (this.fileCache) {
        await this.fileCache.set(cacheKey, response.data);
      }
      
      return {
        data: response.data,
        cached: false,
        rateLimitRemaining: response.headers['x-ratelimit-remaining'] 
          ? parseInt(response.headers['x-ratelimit-remaining']) 
          : undefined,
      };
    } catch (error) {
      logger.error(`API request failed for ${url}:`, error as Record<string, unknown>);
      throw this.handleApiError(error);
    }
  }

  async post<T>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    // POST requests are not cached and require rate limiting
    if (!this.rateLimiter.canMakeRequest()) {
      const delay = this.rateLimiter.getDelay();
      if (delay > 0) {
        await this.sleep(delay);
      }
    }

    this.rateLimiter.recordRequest();

    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.retryRequest(() => this.client.post<T>(url, data as Record<string, unknown>, config));
      });

      return {
        data: response.data,
        cached: false,
        rateLimitRemaining: response.headers['x-ratelimit-remaining'] 
          ? parseInt(response.headers['x-ratelimit-remaining']) 
          : undefined,
      };
    } catch (error) {
      logger.error(`API POST request failed for ${url}:`, error as Record<string, unknown>);
      throw this.handleApiError(error);
    }
  }

  private async retryRequest<T>(
    operation: () => Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx) except rate limiting
        if ((axios.isAxiosError(error) || (error && typeof error === 'object' && 'isAxiosError' in error)) && (error as any).response) {
          const status = (error as any).response.status;
          if (status >= 400 && status < 500 && status !== 429) {
            throw error;
          }
        }

        if (attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          logger.debug(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1})`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  private getCacheKey(method: string, url: string, config?: AxiosRequestConfig): string {
    const params = config?.params ? JSON.stringify(config.params) : '';
    return `${method}:${url}:${params}`;
  }

  private handleApiError(error: unknown): Error {
    if (axios.isAxiosError(error) || (error && typeof error === 'object' && 'isAxiosError' in error)) {
      const axiosError = error as any;
      if (axiosError.response) {
        const status = axiosError.response.status;
        const message = axiosError.response.data?.message || axiosError.message;
        return new Error(`API Error ${status}: ${message}`);
      } else if (axiosError.request) {
        return new Error('API request failed: No response received');
      }
    }
    
    return error instanceof Error ? error : new Error('Unknown API error');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility methods for monitoring
  async getCacheStats() {
    const memoryStats = {
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
    };

    let fileStats = null;
    if (this.fileCache) {
      fileStats = await this.fileCache.getStats();
    }

    return {
      memory: memoryStats,
      file: fileStats,
    };
  }

  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  async clearCache(): Promise<void> {
    this.cache.flushAll();
    if (this.fileCache) {
      await this.fileCache.clear();
    }
  }

  async cleanup(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.fileCache) {
      await this.fileCache.cleanup();
    }
  }
}