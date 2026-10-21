import express from 'express';
import taskRecycleBinRoutes from './tasks/taskRecycleBinRoutes.js';
import taskAttachmentRoutes from './tasks/taskAttachmentRoutes.js';
import taskCommentsRoutes from './tasks/taskCommentsRoutes.js';
import taskCrudRoutes from './tasks/taskCrudRoutes.js';
import taskQueryRoutes from './tasks/taskQueryRoutes.js';

const router = express.Router();

/**
 * Modular Task Routes Orchestrator
 *
 * Sub-routers are mounted in specific order so static endpoints
 * (/recycle-bin/list, /recycle-bin/empty) and sub-resource routes
 * (/:id/attachments, /:id/comments, /:id/restore, /:id/history)
 * are prioritized before parameterized root endpoints (/:id).
 */
router.use('/', taskRecycleBinRoutes);
router.use('/', taskAttachmentRoutes);
router.use('/', taskCommentsRoutes);
router.use('/', taskCrudRoutes);
router.use('/', taskQueryRoutes);

export default router;
