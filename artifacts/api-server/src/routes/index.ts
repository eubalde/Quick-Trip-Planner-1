import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import itineraryRouter from "./itinerary";
import authRouter from "./auth";
import { validateToken } from "./auth";

const router: IRouter = Router();

async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const userId = await validateToken(token);
      if (userId) {
        (req as Request & { userId?: string }).userId = userId;
      }
    }
  } catch {
    // Token validation failed — proceed unauthenticated; protected routes will 401
  }
  next();
}

router.use(authMiddleware);
router.use(healthRouter);
router.use(authRouter);
router.use(itineraryRouter);

export default router;
