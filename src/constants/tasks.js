// Shared task constants and enums
export const TASK_STATUSES = [
  'Not Started',
  'In Progress',
  'On Hold',
  'Completed',
  'Overdue'
];

export const TASK_PRIORITIES = [
  'Low',
  'Medium',
  'High',
  'Critical'
];

export const USER_ROLES = {
  ADMIN: 'Admin',
  EMPLOYEE: 'Employee',
  INTERN: 'Intern'
};

export const ADMIN_ROLE_OPTIONS = [
  { value: 'CEO', label: 'CEO (Chief Executive Officer)' },
  { value: 'CTO', label: 'CTO (Chief Technology Officer)' },
  { value: 'COO', label: 'COO (Chief Operating Officer)' },
  { value: 'SDE', label: 'SDE (Software Development Engineer)' },
  { value: 'Lead SDE', label: 'Lead SDE / Architect' },
  { value: 'VP Engineering', label: 'VP of Engineering' },
  { value: 'Head of Product', label: 'Head of Product' },
  { value: 'Operations Lead', label: 'Operations Lead' },
  { value: 'Administrator', label: 'System Administrator' },
  { value: 'Other', label: 'Custom Title...' }
];

export const DATE_FILTERS = [
  'All Time',
  'Today',
  'Yesterday',
  'Tomorrow',
  'This Week',
  'Last Week',
  'This Month',
  'Last Month'
];
