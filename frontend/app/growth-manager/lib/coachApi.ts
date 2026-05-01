import { api } from '@/lib/api';
import type {
  AssistantTurnResponse,
  CoachModule,
  ConversationListResponse,
  ConversationOut,
  ConversationSummary,
} from './coachTypes';

export const coachApi = {
  list: () => api.get<ConversationListResponse>('/growth/conversations'),

  create: (startingModule: CoachModule = 'foundation') =>
    api.post<ConversationOut>('/growth/conversations', {
      starting_module: startingModule,
    }),

  get: (id: string) => api.get<ConversationOut>(`/growth/conversations/${id}`),

  rename: (id: string, title: string) =>
    api.patch<ConversationSummary>(`/growth/conversations/${id}`, { title }),

  remove: (id: string) => api.delete<void>(`/growth/conversations/${id}`),

  send: (id: string, message: string, module: CoachModule) =>
    api.post<AssistantTurnResponse>(
      `/growth/conversations/${id}/messages`,
      { message, module },
      { timeoutMs: 60_000 },
    ),
};
