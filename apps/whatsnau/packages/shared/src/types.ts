import { z } from 'zod';
import {
    CampaignSchema,
    CreateCampaignSchema,
    UpdateCampaignSchema,
    LeadSchema,
    UpdateLeadSchema,
    MessageSchema,
    GlobalConfigSchema
} from './schemas.js';

export type Campaign = z.infer<typeof CampaignSchema>;
export type CreateCampaignDTO = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignDTO = z.infer<typeof UpdateCampaignSchema>;

export type Lead = z.infer<typeof LeadSchema>;
export type UpdateLeadDTO = z.infer<typeof UpdateLeadSchema>;

export type Message = z.infer<typeof MessageSchema>;

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
