import { Request, Response, NextFunction } from 'express';
import { ClassroomService } from '../services/ClassroomService';
import { verifyAccessToken } from '../lib/serverAuth';

export class ClassroomController {
  private static extractCaller(req: Request) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }

  public static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = ClassroomController.extractCaller(req);
      const items = await ClassroomService.getAllClassrooms(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = ClassroomController.extractCaller(req);
      const classroom = await ClassroomService.getClassroomById(id, caller);
      return res.status(200).json({ success: true, classroom });
    } catch (error) {
      next(error);
    }
  }

  public static async save(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = ClassroomController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) {
        payload.id = req.params.id;
      }
      const classroom = await ClassroomService.saveClassroom(payload, caller);
      return res.status(200).json({ success: true, message: 'اطلاعات کلاس با موفقیت ذخیره شد.', classroom });
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = ClassroomController.extractCaller(req);
      await ClassroomService.deleteClassroom(id, caller);
      return res.status(200).json({ success: true, message: 'کلاس با موفقیت حذف گردید.' });
    } catch (error) {
      next(error);
    }
  }

  public static async getCapacity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = ClassroomController.extractCaller(req);
      const capacityInfo = await ClassroomService.getClassroomCapacity(id, caller);
      return res.status(200).json({ success: true, ...capacityInfo });
    } catch (error) {
      next(error);
    }
  }
}
