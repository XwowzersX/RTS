import { z } from 'zod';

export const api = {
  game: {
    create: {
      method: 'POST' as const,
      path: '/api/game/create',
      input: z.object({}),
      responses: {
        200: z.object({ gameId: z.string() }),
      },
    },
    join: {
      method: 'POST' as const,
      path: '/api/game/join',
      input: z.object({ gameId: z.string() }),
      responses: {
        200: z.object({ playerId: z.string(), color: z.string() }),
        404: z.object({ message: z.string() }),
        400: z.object({ message: z.string() }),
      },
    },
  },
};

export const ws = {
  send: {
    join: z.object({ type: z.literal('join_game'), gameId: z.string() }),
    action: z.any(), // Strictly typed in schema.ts as WsMessage
  },
  receive: {
    update: z.any(), // Full GameState
  }
};
