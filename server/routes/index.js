/**
 * Server API Routes Index
 * Grouped by Domain & Access Level: Admin, Manager, Employee, Task & General
 */

// 1. Authentication & User Access
export { default as authRoutes } from './auth.js';

// 2. Admin & System Management
export { default as metadataRoutes } from './metadata.js';
export { default as auditLogRoutes } from './auditLogs.js';

// 3. Manager & Squad Control
export { default as teamRoutes } from './teams.js';
export { default as managerControlRoutes } from './managerControl.js';

// 4. Employee Self-Logging & Work Session Tracking
export { default as selfLogRoutes } from './selfLogs.js';

// 5. Tasks & Comments
export { default as taskRoutes } from './tasks.js';

// 6. User Notifications
export { default as notificationRoutes } from './notifications.js';
