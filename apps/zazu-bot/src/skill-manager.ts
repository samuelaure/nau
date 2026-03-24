import { ZazuContext, ZazuSkill } from '@zazu/skills-core';

/**
 * The SkillManager is the heart of the Zazŭ Nucleus. 
 * It manages the lifecycle and execution of modular plugins.
 */
export class SkillManager {
  private skills: ZazuSkill[] = [];

  /**
   * Registers a new skill in the system.
   * @param skill The skill to add.
   */
  register(skill: ZazuSkill): void {
    this.skills.push(skill);
    // Sort by priority (ascending: lower number = higher priority)
    this.skills.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Dispatches an incoming context to the appropriate skills.
   * @param ctx Current Zazŭ Context
   */
  async dispatch(ctx: ZazuContext): Promise<boolean> {
    const user = ctx.dbUser;
    if (!user) return false;

    // Filter skills based on user's active features in DB
    // A skill's ID must be present in user.features to be considered
    const activeFeatureIds = user.features?.map((f: any) => f.featureId) || [];

    for (const skill of this.skills) {
      // NOTE: Some skills like 'conversational-fallback' might be "core" and always active.
      // We check if the user has the feature enabled OR if the skill is a core skill (priority >= 1000).
      const isCoreSkill = skill.priority >= 1000;
      const isUserFeatureEnabled = activeFeatureIds.includes(skill.id);

      if (isCoreSkill || isUserFeatureEnabled) {
        try {
          const handled = await skill.canHandle(ctx);
          if (handled) {
            await skill.handle(ctx);
            return true; // Successfully handled by this skill
          }
        } catch (error) {
          console.error(`Error in skill [${skill.id} / ${skill.name}]:`, error);
          // If a skill fails, we let the loop continue to the next one (potentially the fallback)
        }
      }
    }

    return false;
  }
}

// Global instance of the SkillManager
export const skillManager = new SkillManager();
