import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type {
  IcpInput,
  LeadCampaignDetail,
  LeadCampaignStartResponse,
  LeadCampaignsListResponse,
} from './leadTypes';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const leadApi = {
  list: (limit = 50) =>
    api.get<LeadCampaignsListResponse>(`/leads/campaigns?limit=${limit}`),

  get: (id: string) =>
    api.get<LeadCampaignDetail>(`/leads/campaigns/${id}`),

  create: (icp: IcpInput) =>
    api.post<LeadCampaignStartResponse>('/leads/campaigns', { icp }),

  topup: (id: string) =>
    api.post<LeadCampaignStartResponse>(`/leads/campaigns/${id}/topup`, {}),

  remove: (id: string) =>
    api.delete<void>(`/leads/campaigns/${id}`),

  /**
   * Download a campaign's leads as CSV. The browser saves the file using the
   * filename hint from Content-Disposition.
   */
  exportCsv: async (id: string): Promise<Blob> => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/leads/campaigns/${id}/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`Failed to export CSV (${res.status})`);
    }
    return res.blob();
  },
};
