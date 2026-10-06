import express from 'express';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import platformAdminRoutes from './routes/platformAdminRoutes';
import branchRoutes from './routes/branchRoutes';
import customerRoutes from './routes/customerRoutes';
import staffRoutes from './routes/staffRoutes';
import serviceRoutes from './routes/serviceRoutes';
import reservationRoutes from './routes/reservationRoutes';
import publicRoutes from './routes/publicRoutes';
import saleRoutes from './routes/saleRoutes';
import reportRoutes from './routes/reportRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import domainRoutes from './routes/domainRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import billingRoutes from './routes/billingRoutes';
import userRoutes from './routes/userRoutes';
import websiteRoutes from './routes/websiteRoutes';
import mediaRoutes from './routes/mediaRoutes';
import { openApiSpec } from './docs/openapi';
import { swaggerUiHtml } from './docs/swagger';
import { validateEnvironment } from './config/env';

dotenv.config();
validateEnvironment();

const app = express();
app.use('/api/billing/xendit/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api-docs/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

app.get('/api-docs', (_req, res) => {
  res.type('html').send(swaggerUiHtml());
});

app.get('/api-docs/', (_req, res) => {
  res.type('html').send(swaggerUiHtml());
});

app.use('/api/auth', authRoutes);
app.use('/api/platform', platformAdminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/website', websiteRoutes);
app.use('/uploads/media', express.static(path.resolve(process.env.MEDIA_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'media'))));
app.use('/api/media', mediaRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI!;

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Database connection error:', err);
  });
