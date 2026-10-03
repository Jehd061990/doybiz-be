import { Router } from 'express';
import multer from 'multer';
import * as mediaController from '../controllers/mediaController';
import { authenticateUser, authorizeModule } from '../middlewares/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

router.use(authenticateUser, authorizeModule('WEBSITE'));
router.get('/', mediaController.list);
router.post('/', upload.single('file'), mediaController.upload);
router.delete('/:id', mediaController.remove);

export default router;
