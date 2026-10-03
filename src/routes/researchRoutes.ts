import { Router } from 'express';
import { ResearchController } from '../controllers/ResearchController';

const router = Router();

// Sub-routes before parameterized routes
router.get('/articles/student/:studentId', ResearchController.getArticlesByStudent);
router.get('/articles', ResearchController.getAllArticles);
router.post('/articles', ResearchController.saveArticle);
router.delete('/articles/:id', ResearchController.deleteArticle);

router.get('/sessions', ResearchController.getAllSessions);
router.post('/sessions', ResearchController.saveSession);
router.post('/sessions/:id/register-role', ResearchController.registerRole);

export default router;
