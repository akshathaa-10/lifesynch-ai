import { Request, Response, NextFunction } from 'express';
import { 
  ApiResponse, 
  GmailSyncSummary, 
  EmailRecord, 
  CalendarSyncSummary, 
  CalendarEventRecord,
  ResponsibilitySyncSummary,
  Responsibility
} from '@lifesynch/shared';
import { gmailService } from '../services/google/gmail.service';
import { calendarService } from '../services/google/calendar.service';
import { responsibilityGenerationService } from '../services/ai/responsibility-generation.service';
import { reminderService } from '../services/reminder.service';
import { taskService } from '../services/task.service';
import { AppError } from '../middlewares/error.middleware';
import { logger } from '../utils/logger';

export const syncGmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required to synchronize Gmail.', 401);
    }

    const result = await gmailService.syncUserEmails(userId);

    const response: ApiResponse<GmailSyncSummary> = {
      success: true,
      message: `Gmail synchronized successfully. Fetched ${result.fetched} messages (${result.inserted} new, ${result.updated} updated).`,
      data: result,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const getUserEmails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required to view emails.', 401);
    }

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
    const emails = await gmailService.getUserEmails(userId, limit);

    const response: ApiResponse<EmailRecord[]> = {
      success: true,
      data: emails,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const syncCalendar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required to synchronize calendar.', 401);
    }

    const result = await calendarService.syncUserCalendar(userId);

    // If new or updated calendar events were found, trigger responsibility generation & reminders
    if (result.inserted > 0 || result.updated > 0 || result.cancelled > 0) {
      responsibilityGenerationService.generateResponsibilities(userId).catch(err => {
        logger.warn(`AI generation error after calendar sync for user ${userId}:`, err);
      });
      reminderService.generateRemindersForUser(userId).catch(err => {
        logger.warn(`Reminder generation error after calendar sync for user ${userId}:`, err);
      });
    }

    const response: ApiResponse<CalendarSyncSummary> = {
      success: true,
      message: `Calendar synchronized successfully. Fetched ${result.fetched} events (${result.inserted} new, ${result.updated} updated, ${result.cancelled} cancelled).`,
      data: result,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const getUserCalendarEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required to view calendar events.', 401);
    }

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
    const events = await calendarService.getUserCalendarEvents(userId, limit);

    const response: ApiResponse<CalendarEventRecord[]> = {
      success: true,
      data: events,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const getSyncStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required to check sync status.', 401);
    }

    const gmailStatus = await gmailService.getSyncStatus(userId);
    const calendarStatus = await calendarService.getSyncStatus(userId);

    const response: ApiResponse = {
      success: true,
      data: {
        gmail: gmailStatus,
        calendar: calendarStatus
      },
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const syncResponsibilities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required to generate responsibilities.', 401);
    }

    const result = await responsibilityGenerationService.generateResponsibilities(userId);

    const response: ApiResponse<ResponsibilitySyncSummary> = {
      success: true,
      message: `AI Responsibility analysis completed: ${result.generated} generated, ${result.updated} updated, ${result.skipped} skipped.`,
      data: result,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const getUserResponsibilities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required to view responsibilities.', 401);
    }

    const tasks = await taskService.getTasks(userId);

    const response: ApiResponse<Responsibility[]> = {
      success: true,
      data: tasks,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
