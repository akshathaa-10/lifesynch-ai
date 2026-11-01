import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { ExtractedTasksList, ExtractedTasksListSchema } from '@lifesynch/shared';

export interface ExtractionInput {
  text: string;
  sourceType: 'gmail' | 'calendar' | 'extension';
  metadata?: {
    sender?: string;
    subject?: string;
    date?: string;
  };
}

export class TaskExtractionService {
  public async extractActionableTasks(input: ExtractionInput): Promise<ExtractedTasksList> {
    logger.info(`Extracting actionable tasks from ${input.sourceType} source...`);

    if (!env.LLM_API_KEY) {
      logger.warn('LLM_API_KEY is not set. Returning empty extraction result.');
      return {
        tasks: [],
        hasActionableContent: false,
        summary: 'AI extraction disabled: LLM API key not configured'
      };
    }

    // In Phase 2, this calls the LLM (Gemini 1.5 Flash structured output / responseSchema)
    // and strictly parses the response through ExtractedTasksListSchema.safeParse().
    
    // Scaffolding check that schema validates:
    const validated = ExtractedTasksListSchema.parse({
      tasks: [],
      hasActionableContent: false,
      summary: 'Pipeline initialized'
    });

    return validated;
  }
}

export const taskExtractionService = new TaskExtractionService();
