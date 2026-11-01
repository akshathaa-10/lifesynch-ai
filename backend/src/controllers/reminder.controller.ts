import { Request, Response, NextFunction } from 'express';
import { reminderService } from '../services/reminder.service';
import { ApiResponse } from '@lifesynch/shared';

export const listReminders = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const reminders = await reminderService.getRemindersForUser(userId);
    res.status(200).json({
      success: true,
      data: reminders,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const generateReminders = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const summary = await reminderService.generateRemindersForUser(userId);
    res.status(200).json({
      success: true,
      message: 'Reminders processed successfully',
      data: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const markReminderAsRead = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    await reminderService.markAsRead(id, userId);
    res.status(200).json({
      success: true,
      message: 'Reminder marked as read',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};
