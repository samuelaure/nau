import { z } from 'zod';

// --- CAMPAIGN SCHEMAS ---
export const CampaignSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    isActive: z.boolean().default(true),
    tenantId: z.string().uuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const CreateCampaignSchema = CampaignSchema.pick({
    name: true,
    description: true,
    isActive: true,
});

export const UpdateCampaignSchema = CampaignSchema.partial();

// --- LEAD SCHEMAS ---
export const LeadSchema = z.object({
    id: z.string().uuid(),
    phoneNumber: z.string(),
    name: z.string().nullable().optional(),
    status: z.string(),
    aiEnabled: z.boolean(),
    state: z.string(),
    campaignId: z.string().uuid(),
    tenantId: z.string().uuid(),
    metadata: z.string().nullable().optional(),
    createdAt: z.date(),
    lastInteraction: z.date(),
});

export const UpdateLeadSchema = LeadSchema.partial();

// --- MESSAGE SCHEMAS ---
export const MessageSchema = z.object({
    id: z.string().uuid(),
    leadId: z.string().uuid(),
    direction: z.enum(['INBOUND', 'OUTBOUND']),
    content: z.string(),
    type: z.string().default('TEXT'),
    status: z.string(),
    timestamp: z.date(),
    whatsappId: z.string().nullable().optional(),
    aiGenerated: z.boolean().default(false),
});

// --- CONFIG SCHEMAS ---
export const GlobalConfigSchema = z.object({
    id: z.string(),
    availabilityStatus: z.string().nullable().optional(),
    ownerName: z.string().default('Samuel'),
});
