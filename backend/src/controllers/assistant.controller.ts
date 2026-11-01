import { Request, Response, NextFunction } from 'express';
import { ApiResponse, AskAssistantResponse } from '@lifesynch/shared';
import { assistantService } from '../services/ai/assistant.service';
import { AppError } from '../middlewares/error.middleware';

export const askAssistant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required to use conversational assistant.', 401);
    }

    const { question, history, timezone } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Question must be a non-empty string.',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const headerTimezone = typeof req.headers['x-user-timezone'] === 'string' ? req.headers['x-user-timezone'] : undefined;
    const effectiveTimezone = typeof timezone === 'string' && timezone.trim().length > 0 ? timezone.trim() : headerTimezone;

    const detailedResult = await assistantService.askDetailed(
      userId,
      question.trim(),
      Array.isArray(history) ? history : [],
      effectiveTimezone
    );

    const response: ApiResponse<AskAssistantResponse> = {
      success: true,
      data: {
        answer: detailedResult.answer,
        sources: detailedResult.sources,
        intent: detailedResult.intent,
        suggestedQuestions: detailedResult.suggestedQuestions,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
