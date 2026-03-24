import { Context } from 'telegraf';

/**
 * Shared context interface for the Zazŭ ecosystem.
 * Includes database user information and other core services.
 */
export interface ZazuContext extends Context {
  dbUser: any; // Ideally this matches Prisma User, but we'll refined it in next phases
  /** 
   * Unified text content of the message. 
   * If a voice note, this will contain the transcription.
   * If text, this will match ctx.message.text.
   */
  textContent?: string;
}

/**
 * Interface representing a Zazŭ Skill/Plugin.
 */
export interface ZazuSkill {
  /** Uniquely identifies the skill. Should match the ID in the database Feature table. */
  id: string;
  
  /** Human-readable name of the skill. */
  name: string;
  
  /** 
   * Determines execution order. 
   * Multiples skills can handle the same context if designed so, 
   * but usually the first to return true in canHandle will take over.
   */
  priority: number;

  /**
   * Logic to determine if this skill should handle the current message.
   * @param ctx Current Zazŭ Context
   * @returns Boolean indicating if it can handle the message.
   */
  canHandle(ctx: ZazuContext): Promise<boolean>;

  /**
   * Performs the primary business logic of the skill.
   * @param ctx Current Zazŭ Context
   */
  handle(ctx: ZazuContext): Promise<void>;
}
