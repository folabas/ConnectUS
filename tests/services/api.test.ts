import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authApi, movieApi, roomApi, friendApi, notificationApi, tokenStorage, userStorage } from '../../src/services/api';

global.fetch = vi.fn();

describe('Auth API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authApi.register', () => {
    it('should register a new user successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          userId: '123',
          email: 'test@example.com',
          token: 'mock-token',
          expiresAt: '2024-12-31',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await authApi.register({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/register'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'password123', fullName: 'Test User' }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle registration error', async () => {
      const mockResponse = { success: false, error: 'Email already exists' };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await authApi.register({
        email: 'existing@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already exists');
    });
  });

  describe('authApi.login', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          userId: '123',
          email: 'test@example.com',
          token: 'mock-token',
          expiresAt: '2024-12-31',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await authApi.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('should handle invalid credentials', async () => {
      const mockResponse = { success: false, error: 'Invalid credentials' };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await authApi.login({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('authApi.logout', () => {
    it('should logout successfully', async () => {
      const mockResponse = { success: true };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await authApi.logout('mock-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('authApi.getMe', () => {
    it('should get user profile', async () => {
      const mockResponse = {
        success: true,
        data: {
          userId: '123',
          email: 'test@example.com',
          fullName: 'Test User',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await authApi.getMe('mock-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/me'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
      expect(result.success).toBe(true);
    });
  });
});

describe('Movie API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('movieApi.getAll', () => {
    it('should get all movies', async () => {
      const mockResponse = {
        success: true,
        data: [{ id: '1', title: 'Movie 1' }, { id: '2', title: 'Movie 2' }],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await movieApi.getAll();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/movies'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should filter movies by genre', async () => {
      const mockResponse = { success: true, data: [{ id: '1', title: 'Movie 1', genre: 'Action' }] };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      await movieApi.getAll({ genre: 'Action' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('genre=Action'),
        expect.any(Object)
      );
    });

    it('should search movies', async () => {
      const mockResponse = { success: true, data: [{ id: '1', title: 'Test Movie' }] };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      await movieApi.getAll({ search: 'Test' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=Test'),
        expect.any(Object)
      );
    });
  });

  describe('movieApi.getById', () => {
    it('should get movie by id', async () => {
      const mockResponse = { success: true, data: { id: '1', title: 'Movie 1' } };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await movieApi.getById('1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/movies/1'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.success).toBe(true);
    });
  });
});

describe('Room API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('roomApi.create', () => {
    it('should create a room', async () => {
      const mockResponse = { success: true, data: { id: 'room-1', name: 'Test Room' } };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await roomApi.create('token', { name: 'Test Room' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/rooms'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('roomApi.getAll', () => {
    it('should get all rooms', async () => {
      const mockResponse = { success: true, data: [{ id: 'room-1' }] };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await roomApi.getAll('token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/rooms'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('roomApi.join', () => {
    it('should join a room by roomId', async () => {
      const mockResponse = { success: true, data: { roomId: 'room-1' } };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await roomApi.join('token', { roomId: 'room-1' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/rooms/join'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('should join a room by code', async () => {
      const mockResponse = { success: true, data: { roomId: 'room-1' } };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await roomApi.join('token', { code: 'ABC123' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/rooms/join'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });
  });
});

describe('Friend API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('friendApi.getAll', () => {
    it('should get all friends', async () => {
      const mockResponse = { success: true, data: [{ userId: '1', name: 'Friend 1' }] };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await friendApi.getAll('token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/friends'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('friendApi.search', () => {
    it('should search users', async () => {
      const mockResponse = { success: true, data: [{ userId: '1', name: 'John' }] };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await friendApi.search('token', 'John');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('query=John'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.success).toBe(true);
    });
  });
});

describe('Notification API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notificationApi.getAll', () => {
    it('should get all notifications', async () => {
      const mockResponse = { success: true, data: [{ id: '1', message: 'Test' }] };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await notificationApi.getAll('token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('notificationApi.markRead', () => {
    it('should mark notification as read', async () => {
      const mockResponse = { success: true };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await notificationApi.markRead('token', 'notif-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/notif-1/read'),
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(result.success).toBe(true);
    });
  });
});

describe('Token Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.getItem = vi.fn();
    localStorage.setItem = vi.fn();
    localStorage.removeItem = vi.fn();
  });

  it('should set token', () => {
    tokenStorage.set('test-token');
    expect(localStorage.setItem).toHaveBeenCalledWith('connectus_token', 'test-token');
  });

  it('should get token', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce('test-token');
    const token = tokenStorage.get();
    expect(token).toBe('test-token');
  });

  it('should remove token', () => {
    tokenStorage.remove();
    expect(localStorage.removeItem).toHaveBeenCalledWith('connectus_token');
  });
});

describe('User Storage', () => {
  const mockUser = { userId: '1', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.getItem = vi.fn();
    localStorage.setItem = vi.fn();
    localStorage.removeItem = vi.fn();
  });

  it('should set user', () => {
    userStorage.set(mockUser as any);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'connectus_user',
      JSON.stringify(mockUser)
    );
  });

  it('should get user', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(JSON.stringify(mockUser));
    const user = userStorage.get();
    expect(user).toEqual(mockUser);
  });

  it('should return null when no user', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const user = userStorage.get();
    expect(user).toBeNull();
  });

  it('should remove user', () => {
    userStorage.remove();
    expect(localStorage.removeItem).toHaveBeenCalledWith('connectus_user');
  });
});
