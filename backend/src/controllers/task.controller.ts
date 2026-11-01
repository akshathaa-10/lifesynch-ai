import { Request, Response, NextFunction } from 'express';
import { ApiResponse, Responsibility } from '@lifesynch/shared';
import { taskService } from '../services/task.service';

export const listTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
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

export const getTaskById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const task = await taskService.getTaskById(id);

    if (!task || task.userId !== req.user!.id) {
      res.status(404).json({
        success: false,
        message: `Responsibility with id ${id} not found`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const response: ApiResponse<Responsibility> = {
      success: true,
      data: task,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const createTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const newTask = await taskService.createTask(userId, req.body);

    const response: ApiResponse<Responsibility> = {
      success: true,
      message: 'Responsibility created successfully',
      data: newTask,
      timestamp: new Date().toISOString()
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await taskService.getTaskById(id);

    if (!existing || existing.userId !== req.user!.id) {
      res.status(404).json({
        success: false,
        message: `Responsibility with id ${id} not found`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const updated = await taskService.updateTask(id, req.body);

    const response: ApiResponse<Responsibility> = {
      success: true,
      message: 'Responsibility updated successfully',
      data: updated,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await taskService.getTaskById(id);

    if (!existing || existing.userId !== req.user!.id) {
      res.status(404).json({
        success: false,
        message: `Responsibility with id ${id} not found`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    await taskService.deleteTask(id);

    const response: ApiResponse = {
      success: true,
      message: `Responsibility ${id} deleted successfully`,
      timestamp: new Date().toISOString()
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
