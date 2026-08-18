import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  authApi,
  errorMessage,
  movieApi,
  roomApi,
  session,
  setUnauthorizedHandler,
} from '@/lib/api';

const API_URL = 'http://localhost:5000';

/** Build a Response the client will parse the way a real server's would be. */
function respond(body: unknown, init: { status?: number; text?: string } = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: async () => init.text ?? JSON.stringify(body),
  } as Response;
}

describe('api client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps the success envelope and returns data', async () => {
    fetchMock.mockResolvedValue(respond({ success: true, data: { userId: 'u1' } }));

    await expect(authApi.me()).resolves.toEqual({ userId: 'u1' });
  });

  it('attaches the bearer token when one is stored', async () => {
    session.set('token-123', { userId: 'u1', email: 'a@b.c' });
    fetchMock.mockResolvedValue(respond({ success: true, data: [] }));

    await roomApi.listPublic();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer token-123');
  });

  it('omits the token on public endpoints even when signed in', async () => {
    session.set('token-123', { userId: 'u1', email: 'a@b.c' });
    fetchMock.mockResolvedValue(respond({ success: true, data: [] }));

    await movieApi.list();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('raises ApiError with the server message on a failure status', async () => {
    fetchMock.mockResolvedValue(
      respond({ success: false, message: 'Room is full' }, { status: 400 }),
    );

    await expect(roomApi.get('r1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Room is full',
    });
  });

  it('raises ApiError rather than SyntaxError when the body is not JSON', async () => {
    // A crashed proxy or a misrouted request returns an HTML error page. The
    // previous client called response.json() unguarded and threw SyntaxError,
    // which surfaced to users as "Unexpected token <".
    fetchMock.mockResolvedValue(
      respond(null, { status: 502, text: '<html><body>Bad Gateway</body></html>' }),
    );

    const error = await roomApi.get('r1').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).toContain('502');
  });

  it('treats success:false with a 200 status as a failure', async () => {
    fetchMock.mockResolvedValue(respond({ success: false, message: 'Nope' }));

    await expect(roomApi.get('r1')).rejects.toThrow('Nope');
  });

  it('clears the session and notifies once on 401', async () => {
    session.set('stale-token', { userId: 'u1', email: 'a@b.c' });
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    fetchMock.mockResolvedValue(
      respond({ success: false, message: 'Expired' }, { status: 401 }),
    );

    await expect(authApi.me()).rejects.toThrow('Expired');

    expect(session.getToken()).toBeNull();
    expect(session.getUser()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('reports a reachable error when the network call itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await authApi.me().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/cannot reach the server/i);
  });

  it('builds a query string and drops empty values', async () => {
    fetchMock.mockResolvedValue(respond({ success: true, data: [] }));

    await movieApi.list({ genre: 'Sci-Fi', search: '' });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/movies?genre=Sci-Fi`);
  });

  describe('join', () => {
    it('surfaces requiresApproval alongside the room', async () => {
      // The flag lives beside `data` in the envelope, so it would be lost by the
      // ordinary unwrap. This is what tells the lobby to show the waiting state.
      fetchMock.mockResolvedValue(
        respond({ success: true, requiresApproval: true, data: { _id: 'r1' } }),
      );

      await expect(roomApi.join({ roomId: 'r1' })).resolves.toEqual({
        room: { _id: 'r1' },
        requiresApproval: true,
      });
    });

    it('defaults requiresApproval to false when absent', async () => {
      fetchMock.mockResolvedValue(respond({ success: true, data: { _id: 'r1' } }));

      const result = await roomApi.join({ roomId: 'r1' });
      expect(result.requiresApproval).toBe(false);
    });
  });
});

describe('session storage', () => {
  it('round-trips the user', () => {
    session.set('t', { userId: 'u1', email: 'a@b.c', fullName: 'Ada' });
    expect(session.getUser()).toEqual({ userId: 'u1', email: 'a@b.c', fullName: 'Ada' });
  });

  it('discards a corrupted user blob instead of throwing on boot', () => {
    localStorage.setItem('connectus_user', '{not json');
    expect(session.getUser()).toBeNull();
    expect(localStorage.getItem('connectus_user')).toBeNull();
  });
});

describe('errorMessage', () => {
  it('prefers the ApiError message', () => {
    expect(errorMessage(new ApiError('Room is full', 400))).toBe('Room is full');
  });

  it('falls back for non-Error values', () => {
    expect(errorMessage('something odd')).toMatch(/something went wrong/i);
  });
});
