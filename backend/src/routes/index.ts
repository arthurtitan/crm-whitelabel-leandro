import { Router } from 'express';
import authRoutes from './auth.routes';
import accountRoutes from './account.routes';
import userRoutes from './user.routes';
import contactRoutes from './contact.routes';
import productRoutes from './product.routes';
import tagRoutes, { funnelRouter } from './tag.routes';
import saleRoutes from './sale.routes';
import dashboardRoutes, { adminRouter } from './dashboard.routes';
import financeRoutes from './finance.routes';
import insightsRoutes from './insights.routes';
import calendarRoutes from './calendar.routes';
import eventRoutes from './event.routes';
import chatwootRoutes from './chatwoot.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/accounts', accountRoutes);
router.use('/users', userRoutes);
router.use('/contacts', contactRoutes);
router.use('/products', productRoutes);
router.use('/tags', tagRoutes);
router.use('/funnels', funnelRouter);
router.use('/sales', saleRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin', adminRouter);
router.use('/finance', financeRoutes);
router.use('/insights', insightsRoutes);
router.use('/calendar', calendarRoutes);
router.use('/events', eventRoutes);
router.use('/chatwoot', chatwootRoutes);

export default router;
