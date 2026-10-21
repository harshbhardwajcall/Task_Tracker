import nodemailer from 'nodemailer';
import db from '../db/index.js';

let transporter = null;

// Initialize transporter (either configured SMTP or Ethereal/mock)
async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: isSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  } else {
    // Development fallback: use test account or console transport
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('📧 Ethereal test mail initialized for development:', testAccount.user);
    } catch (e) {
      // Fallback transport that logs to console
      transporter = {
        sendMail: async (mailOptions) => {
          console.log('📧 [DEV MAIL SIMULATOR] To:', mailOptions.to);
          console.log('📧 [DEV MAIL SIMULATOR] Subject:', mailOptions.subject);
          return { messageId: 'simulated-' + Date.now() };
        }
      };
    }
  }

  return transporter;
}

/**
 * Send email when a task is created or reassigned
 */
export async function sendTaskAssignedEmail({ toEmail, assigneeName, taskTitle, priority, dueDate, projectName, assignedByName, taskId }) {
  if (!toEmail) return;

  try {
    const mailClient = await getTransporter();
    const info = await mailClient.sendMail({
      from: process.env.MAIL_FROM || '"Task Tracker" <notifications@tasktracker.local>',
      to: toEmail,
      subject: `📌 New Task Assigned: ${taskTitle} [${priority}]`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
          <div style="padding: 24px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-bottom: 1px solid #334155;">
            <h2 style="margin: 0; color: #38bdf8; font-size: 20px;">Task Tracker Notification</h2>
            <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">You have been assigned a new task</p>
          </div>
          <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
            <p style="margin-top: 0;">Hello <strong>${assigneeName || 'Team Member'}</strong>,</p>
            <p><strong>${assignedByName || 'A Manager'}</strong> has assigned you the following task:</p>
            
            <div style="background: #1e293b; border-left: 4px solid #38bdf8; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h3 style="margin: 0 0 8px; color: #ffffff; font-size: 16px;">${taskTitle}</h3>
              <p style="margin: 4px 0; color: #cbd5e1;"><strong>Project:</strong> ${projectName || 'Global'}</p>
              <p style="margin: 4px 0; color: #cbd5e1;"><strong>Priority:</strong> <span style="color: ${priority === 'Critical' ? '#f43f5e' : priority === 'High' ? '#fb923c' : '#38bdf8'}; font-weight: bold;">${priority}</span></p>
              <p style="margin: 4px 0; color: #cbd5e1;"><strong>Due Date:</strong> ${dueDate || 'Not specified'}</p>
            </div>

            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Please log into your dashboard to review task specifications, attachments, and update your progress.</p>
          </div>
          <div style="padding: 16px 24px; background: #090d16; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b;">
            Task Tracker Enterprise • Automated System Notification
          </div>
        </div>
      `
    });

    if (nodemailer.getTestMessageUrl && info) {
      const url = nodemailer.getTestMessageUrl(info);
      if (url) console.log('📧 Task Assigned Preview URL:', url);
    }
  } catch (err) {
    console.error('Failed to send task assigned email:', err);
  }
}

/**
 * Send email when task specifications or fields are modified
 */
export async function sendTaskModifiedEmail({ toEmail, assigneeName, taskTitle, taskId, updatedByName, changes }) {
  if (!toEmail || !Array.isArray(changes) || changes.length === 0) return;

  try {
    const mailClient = await getTransporter();
    const rowsHtml = changes.map(c => `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 10px 14px; font-weight: bold; color: #cbd5e1; font-size: 13px;">${c.field}</td>
        <td style="padding: 10px 14px; color: #f87171; text-decoration: line-through; font-size: 13px;">${c.oldValue || 'None'}</td>
        <td style="padding: 10px 14px; color: #34d399; font-weight: bold; font-size: 13px;">${c.newValue || 'None'}</td>
      </tr>
    `).join('');

    const info = await mailClient.sendMail({
      from: process.env.MAIL_FROM || '"Call-Astro Task Tracker" <notifications@call-astro.in>',
      to: toEmail,
      subject: `✏️ Task Updated: "${taskTitle}" (${taskId})`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b1120; color: #f8fafc; border-radius: 14px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <div style="padding: 24px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff;">
            <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: rgba(0,0,0,0.25); padding: 3px 8px; border-radius: 4px;">Task Update</span>
            <h2 style="margin: 8px 0 0; font-size: 20px; font-weight: 700;">${taskTitle}</h2>
            <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Task ID: ${taskId} • Updated by ${updatedByName}</p>
          </div>
          <div style="padding: 24px;">
            <p style="margin-top: 0; font-size: 14px;">Hello <strong>${assigneeName || 'Team Member'}</strong>,</p>
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">The following details on your assigned task were recently updated:</p>
            
            <table style="width: 100%; border-collapse: collapse; background: #131d31; border-radius: 8px; overflow: hidden; margin: 18px 0; border: 1px solid #1e293b;">
              <thead>
                <tr style="background: #1e293b; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8;">
                  <th style="padding: 10px 14px;">Field</th>
                  <th style="padding: 10px 14px;">Previous</th>
                  <th style="padding: 10px 14px;">Updated Value</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">
              Please log in to your Call-Astro Task Tracker portal to view complete task specifications.
            </p>
          </div>
          <div style="padding: 14px 24px; background: #060a12; text-align: center; font-size: 11px; color: #475569; border-top: 1px solid #1e293b;">
            Call-Astro Task Tracker • Automated System Notification
          </div>
        </div>
      `
    });

    if (nodemailer.getTestMessageUrl && info) {
      const url = nodemailer.getTestMessageUrl(info);
      if (url) console.log('📧 Task Modified Preview URL:', url);
    }
  } catch (err) {
    console.error('Failed to send task modified email:', err);
  }
}

/**
 * Send urgent email when a task has crossed its deadline and is Overdue
 */
export async function sendTaskOverdueEmail({ toEmail, assigneeName, taskTitle, taskId, dueDate }) {
  if (!toEmail) return;

  try {
    const mailClient = await getTransporter();
    const info = await mailClient.sendMail({
      from: process.env.MAIL_FROM || '"Call-Astro Task Tracker" <notifications@call-astro.in>',
      to: toEmail,
      subject: `🚨 OVERDUE ALERT: "${taskTitle}" (${taskId}) has passed its deadline`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 14px; overflow: hidden; border: 1px solid #7f1d1d; box-shadow: 0 10px 25px rgba(239,68,68,0.2);">
          <div style="padding: 24px; background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); color: #ffffff;">
            <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 4px;">Overdue Action Required</span>
            <h2 style="margin: 8px 0 0; font-size: 20px; font-weight: 700;">🚨 ${taskTitle}</h2>
            <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Task ID: ${taskId}</p>
          </div>
          <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
            <p style="margin-top: 0;">Hello <strong>${assigneeName || 'Team Member'}</strong>,</p>
            <p>This is an automated notification that the deadline for your assigned task has passed and it is currently marked as <span style="color: #ef4444; font-weight: bold; background: rgba(239,68,68,0.15); padding: 2px 6px; border-radius: 4px;">OVERDUE</span>.</p>
            
            <div style="background: #1e1b2e; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h3 style="margin: 0 0 6px; color: #ffffff; font-size: 15px;">${taskTitle}</h3>
              <p style="margin: 4px 0; color: #fca5a5;"><strong>Scheduled Deadline:</strong> ${dueDate || 'N/A'}</p>
              <p style="margin: 4px 0; color: #cbd5e1;"><strong>Current Status:</strong> Overdue</p>
            </div>

            <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">
              Please prioritize completing this task, submit an update, or add comments explaining the delay on the Task Tracker portal.
            </p>
          </div>
          <div style="padding: 14px 24px; background: #060a12; text-align: center; font-size: 11px; color: #475569; border-top: 1px solid #1e293b;">
            Call-Astro Task Tracker • Automated System Notification
          </div>
        </div>
      `
    });

    if (nodemailer.getTestMessageUrl && info) {
      const url = nodemailer.getTestMessageUrl(info);
      if (url) console.log('📧 Task Overdue Preview URL:', url);
    }
  } catch (err) {
    console.error('Failed to send task overdue email:', err);
  }
}

/**
 * Send email when a task is approaching its deadline
 */
export async function sendDeadlineWarningEmail({ toEmail, assigneeName, taskTitle, dueDate, hoursLeft }) {
  if (!toEmail) return;

  try {
    const mailClient = await getTransporter();
    const info = await mailClient.sendMail({
      from: process.env.MAIL_FROM || '"Task Tracker" <notifications@tasktracker.local>',
      to: toEmail,
      subject: `⚠️ Deadline Approaching: "${taskTitle}" is due soon`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
          <div style="padding: 24px; background: #1e1b4b; border-bottom: 1px solid #3730a3;">
            <h2 style="margin: 0; color: #f59e0b; font-size: 20px;">⚠️ Deadline Alert</h2>
            <p style="margin: 4px 0 0; color: #cbd5e1; font-size: 13px;">Task due within ${hoursLeft || 24} hours</p>
          </div>
          <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
            <p>Hello <strong>${assigneeName}</strong>,</p>
            <p>This is a scheduled reminder that your task is approaching its completion deadline:</p>
            
            <div style="background: #1e293b; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h3 style="margin: 0 0 8px; color: #ffffff;">${taskTitle}</h3>
              <p style="margin: 4px 0; color: #fbbf24;"><strong>Due Date:</strong> ${dueDate}</p>
            </div>

            <p style="color: #94a3b8; font-size: 12px;">Please update the task status or add progress comments if more time is needed.</p>
          </div>
        </div>
      `
    });

    if (nodemailer.getTestMessageUrl && info) {
      const url = nodemailer.getTestMessageUrl(info);
      if (url) console.log('📧 Deadline Warning Preview URL:', url);
    }
  } catch (err) {
    console.error('Failed to send deadline warning email:', err);
  }
}

/**
 * Send email when a repeat task cycle is approaching its end / reset
 */
export async function sendTaskLoopWarningEmail({ toEmail, assigneeName, taskTitle, hoursLeft, intervalHours }) {
  if (!toEmail) return;

  try {
    const mailClient = await getTransporter();
    const info = await mailClient.sendMail({
      from: process.env.MAIL_FROM || '"Task Tracker" <notifications@tasktracker.local>',
      to: toEmail,
      subject: `⏳ Repeat Task Loop Ending Soon: "${taskTitle}"`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
          <div style="padding: 24px; background: #311042; border-bottom: 1px solid #581c87;">
            <h2 style="margin: 0; color: #c084fc; font-size: 20px;">🔁 Repeat Task Cycle Reminder</h2>
            <p style="margin: 4px 0 0; color: #e9d5ff; font-size: 13px;">Task repeat cycle ending in ${hoursLeft}</p>
          </div>
          <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
            <p>Hello <strong>${assigneeName || 'Team Member'}</strong>,</p>
            <p>This is a notification that the active cycle for repeat task <strong>"${taskTitle}"</strong> (Interval: ${intervalHours}h) will reset in approximately <strong>${hoursLeft}</strong>.</p>
            
            <div style="background: #1e1b4b; border-left: 4px solid #a855f7; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h3 style="margin: 0 0 8px; color: #ffffff;">${taskTitle}</h3>
              <p style="margin: 4px 0; color: #cbd5e1;"><strong>Loop Interval:</strong> Every ${intervalHours} hours</p>
              <p style="margin: 4px 0; color: #e9d5ff;"><strong>Reset Policy:</strong> Resets in-place to 'Not Started' for the next cycle.</p>
            </div>

            <p style="color: #94a3b8; font-size: 12px;">Please finalize any current deliverables or add remarks before the cycle resets.</p>
          </div>
          <div style="padding: 16px 24px; background: #090d16; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b;">
            Task Tracker Enterprise • Automated Loop Notification
          </div>
        </div>
      `
    });

    if (nodemailer.getTestMessageUrl && info) {
      const url = nodemailer.getTestMessageUrl(info);
      if (url) console.log('📧 Task Loop Warning Preview URL:', url);
    }
  } catch (err) {
    console.error('Failed to send task loop warning email:', err);
  }
}

/**
 * Send email when a repeat task has reset for a new cycle
 */
export async function sendTaskLoopResetEmail({ toEmail, assigneeName, taskTitle, cycleNumber, intervalHours }) {
  if (!toEmail) return;

  try {
    const mailClient = await getTransporter();
    const info = await mailClient.sendMail({
      from: process.env.MAIL_FROM || '"Task Tracker" <notifications@tasktracker.local>',
      to: toEmail,
      subject: `🔁 Task Repeat Reset: "${taskTitle}" (Cycle #${cycleNumber})`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
          <div style="padding: 24px; background: #1e1b4b; border-bottom: 1px solid #3b82f6;">
            <h2 style="margin: 0; color: #60a5fa; font-size: 20px;">🔁 Repeat Task Cycle Reset</h2>
            <p style="margin: 4px 0 0; color: #bfdbfe; font-size: 13px;">Cycle #${cycleNumber} has begun</p>
          </div>
          <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
            <p>Hello <strong>${assigneeName || 'Team Member'}</strong>,</p>
            <p>The repeat timer for your task has reached its duration and reset for <strong>Cycle #${cycleNumber}</strong>.</p>
            
            <div style="background: #0f172a; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h3 style="margin: 0 0 8px; color: #ffffff;">${taskTitle}</h3>
              <p style="margin: 4px 0; color: #cbd5e1;"><strong>Status:</strong> Reset to <span style="color: #60a5fa; font-weight: bold;">Not Started</span></p>
              <p style="margin: 4px 0; color: #cbd5e1;"><strong>Interval:</strong> Every ${intervalHours} hours</p>
              <p style="margin: 4px 0; color: #cbd5e1;"><strong>Cycle:</strong> #${cycleNumber}</p>
            </div>

            <p style="color: #94a3b8; font-size: 12px;">Log in to your dashboard to review task requirements and track progress for this cycle.</p>
          </div>
          <div style="padding: 16px 24px; background: #090d16; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b;">
            Task Tracker Enterprise • Automated Loop Notification
          </div>
        </div>
      `
    });

    if (nodemailer.getTestMessageUrl && info) {
      const url = nodemailer.getTestMessageUrl(info);
      if (url) console.log('📧 Task Loop Reset Preview URL:', url);
    }
  } catch (err) {
    console.error('Failed to send task loop reset email:', err);
  }
}

/**
 * Background watcher: Checks for approaching deadlines and overdue tasks
 */
export function checkDeadlinesAndNotify() {
  try {
    const now = new Date();

    // Check tasks approaching deadline (within 24 hours, not yet notified)
    const upcomingTasks = db.prepare(`
      SELECT t.id, t.title, t.due_date, t.deadline_warning_sent, u.name as assignee_name, u.email as assignee_email
      FROM tasks t
      JOIN users u ON t.assigned_to = u.id
      WHERE t.deleted_at IS NULL
        AND t.status != 'Completed'
        AND t.due_date IS NOT NULL
        AND (t.deadline_warning_sent IS NULL OR t.deadline_warning_sent = 0)
    `).all();

    for (const task of upcomingTasks) {
      if (!task.due_date) continue;
      const dueDate = new Date(task.due_date);
      const diffMs = dueDate - now;
      const diffHours = diffMs / (1000 * 60 * 60);

      // If due within 24 hours and not yet passed
      if (diffHours > 0 && diffHours <= 24) {
        sendDeadlineWarningEmail({
          toEmail: task.assignee_email,
          assigneeName: task.assignee_name,
          taskTitle: task.title,
          dueDate: task.due_date,
          hoursLeft: Math.round(diffHours)
        });

        db.prepare('UPDATE tasks SET deadline_warning_sent = 1 WHERE id = ?').run(task.id);
      }
    }
  } catch (err) {
    console.error('Error during deadline check:', err);
  }
}

/**
 * Starts periodic deadline checker (runs every 30 minutes)
 */
export function startDeadlineWatcher() {
  // Run once on startup after 5 seconds
  setTimeout(() => {
    checkDeadlinesAndNotify();
  }, 5000);

  // Repeat every 30 minutes
  setInterval(() => {
    checkDeadlinesAndNotify();
  }, 30 * 60 * 1000);
}

/**
 * Send welcome onboarding email when a new user is created (Admin, Manager, Employee, or Intern)
 */
export async function sendUserWelcomeEmail({ toEmail, name, role, title, temporaryPassword, createdByName }) {
  if (!toEmail) return;

  try {
    const mailClient = await getTransporter();
    const portalUrl = process.env.APP_URL || 'http://localhost:5173';
    const roleColors = {
      Admin: { bg: '#8b5cf6', badge: 'rgba(139, 92, 246, 0.2)', text: '#c4b5fd' },
      Manager: { bg: '#0284c7', badge: 'rgba(2, 132, 199, 0.2)', text: '#7dd3fc' },
      Employee: { bg: '#059669', badge: 'rgba(5, 150, 105, 0.2)', text: '#6ee7b7' },
      Intern: { bg: '#d97706', badge: 'rgba(217, 119, 6, 0.2)', text: '#fde68a' }
    };
    const color = roleColors[role] || roleColors.Employee;

    const info = await mailClient.sendMail({
      from: process.env.MAIL_FROM || '"Call-Astro Task Tracker" <notifications@call-astro.in>',
      to: toEmail,
      subject: `🎉 Welcome to Call-Astro Task Tracker! [${role}]`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b1120; color: #f8fafc; border-radius: 14px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="padding: 28px 24px; background: linear-gradient(135deg, ${color.bg} 0%, #0f172a 100%); border-bottom: 1px solid #334155;">
            <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: rgba(0,0,0,0.35); padding: 4px 10px; border-radius: 6px; color: ${color.text};">
              Welcome to the Team
            </span>
            <h1 style="margin: 12px 0 0; font-size: 22px; font-weight: 700; color: #ffffff;">Hello ${name || 'Team Member'}, Welcome to Call-Astro!</h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #e2e8f0; opacity: 0.9;">
              You have been registered as an official <strong>${role}</strong>
            </p>
          </div>

          <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
            <p style="margin-top: 0;">An account has been created for you on the <strong>Call-Astro Task Tracker</strong> platform${createdByName ? ` by <strong>${createdByName}</strong>` : ''}.</p>

            <div style="background: #131d31; border: 1px solid #1e293b; border-left: 4px solid ${color.bg}; padding: 18px; border-radius: 10px; margin: 20px 0;">
              <h3 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8;">Account Credentials & Access</h3>
              <p style="margin: 6px 0; color: #cbd5e1;"><strong>Assigned Role:</strong> <span style="background: ${color.badge}; color: ${color.text}; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${role}</span> (${title || role})</p>
              <p style="margin: 6px 0; color: #cbd5e1;"><strong>Login Email:</strong> <span style="color: #ffffff; font-family: monospace;">${toEmail}</span></p>
              ${temporaryPassword ? `<p style="margin: 6px 0; color: #cbd5e1;"><strong>Initial Password:</strong> <span style="color: #38bdf8; font-family: monospace; font-weight: bold; background: #0b1120; padding: 2px 8px; border-radius: 4px; border: 1px solid #1e293b;">${temporaryPassword}</span></p>` : ''}
            </div>

            <div style="text-align: center; margin: 26px 0;">
              <a href="${portalUrl}" target="_blank" style="display: inline-block; background: ${color.bg}; color: #ffffff; font-weight: bold; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                Sign In to Call-Astro Portal →
              </a>
            </div>

            <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">
              For security, please log in and change your password in your Profile Settings after signing in.
            </p>
          </div>

          <div style="padding: 14px 24px; background: #060a12; text-align: center; font-size: 11px; color: #475569; border-top: 1px solid #1e293b;">
            Call-Astro Task Tracker • Automated Team Notification
          </div>
        </div>
      `
    });

    if (nodemailer.getTestMessageUrl && info) {
      const url = nodemailer.getTestMessageUrl(info);
      if (url) console.log('📧 Welcome Email Preview URL:', url);
    }
  } catch (err) {
    console.error('Failed to send welcome email:', err);
  }
}

/**
 * Send email when user role permissions change
 */
export async function sendUserRoleChangedEmail({ toEmail, name, previousRole, newRole, title, updatedByName }) {
  if (!toEmail) return;

  try {
    const mailClient = await getTransporter();
    const portalUrl = process.env.APP_URL || 'http://localhost:5173';

    const info = await mailClient.sendMail({
      from: process.env.MAIL_FROM || '"Call-Astro Task Tracker" <notifications@call-astro.in>',
      to: toEmail,
      subject: `🔄 Role Update: Your Call-Astro role has changed to ${newRole}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b1120; color: #f8fafc; border-radius: 14px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="padding: 24px; background: linear-gradient(135deg, #0369a1 0%, #0f172a 100%); border-bottom: 1px solid #334155;">
            <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: rgba(0,0,0,0.35); padding: 4px 10px; border-radius: 6px; color: #7dd3fc;">
              Permissions Updated
            </span>
            <h2 style="margin: 10px 0 0; font-size: 20px; font-weight: 700; color: #ffffff;">Role Assignment Changed</h2>
            <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Updated by ${updatedByName || 'Administrator'}</p>
          </div>

          <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
            <p style="margin-top: 0;">Hello <strong>${name || 'Team Member'}</strong>,</p>
            <p>Your account access and permissions on the <strong>Call-Astro Task Tracker</strong> platform have been updated:</p>

            <div style="background: #131d31; border: 1px solid #1e293b; padding: 18px; border-radius: 10px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Previous Role:</td>
                  <td style="padding: 6px 0; color: #f87171; text-decoration: line-through; font-weight: bold; font-size: 13px;">${previousRole}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">New Role:</td>
                  <td style="padding: 6px 0; color: #34d399; font-weight: bold; font-size: 14px;">${newRole}</td>
                </tr>
                ${title ? `<tr>
                  <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Designation / Title:</td>
                  <td style="padding: 6px 0; color: #e2e8f0; font-size: 13px;">${title}</td>
                </tr>` : ''}
              </table>
            </div>

            <p style="font-size: 13px; color: #94a3b8;">
              Your portal dashboard, task permissions, and navigation tabs have been adjusted to reflect your new role (${newRole}).
            </p>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${portalUrl}" target="_blank" style="display: inline-block; background: #0284c7; color: #ffffff; font-weight: bold; font-size: 14px; padding: 10px 24px; border-radius: 8px; text-decoration: none;">
                Open Task Tracker Dashboard →
              </a>
            </div>
          </div>

          <div style="padding: 14px 24px; background: #060a12; text-align: center; font-size: 11px; color: #475569; border-top: 1px solid #1e293b;">
            Call-Astro Task Tracker • Automated Team Notification
          </div>
        </div>
      `
    });

    if (nodemailer.getTestMessageUrl && info) {
      const url = nodemailer.getTestMessageUrl(info);
      if (url) console.log('📧 Role Changed Preview URL:', url);
    }
  } catch (err) {
    console.error('Failed to send role changed email:', err);
  }
}

/**
 * Send deactivation / offboarding email when a user account is deleted/removed
 */
export async function sendUserDeactivatedEmail({ toEmail, name, role, title, removedByName }) {
  if (!toEmail) return;

  try {
    const mailClient = await getTransporter();

    const info = await mailClient.sendMail({
      from: process.env.MAIL_FROM || '"Call-Astro Task Tracker" <notifications@call-astro.in>',
      to: toEmail,
      subject: `📋 Notice: Call-Astro Task Tracker account deactivated`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b1120; color: #f8fafc; border-radius: 14px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="padding: 24px; background: linear-gradient(135deg, #475569 0%, #1e293b 100%); border-bottom: 1px solid #334155;">
            <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: rgba(0,0,0,0.35); padding: 4px 10px; border-radius: 6px; color: #94a3b8;">
              Account Notice
            </span>
            <h2 style="margin: 10px 0 0; font-size: 20px; font-weight: 700; color: #ffffff;">Account Access Deactivated</h2>
            <p style="margin: 4px 0 0; font-size: 12px; color: #cbd5e1;">Call-Astro Task Tracker System</p>
          </div>

          <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
            <p style="margin-top: 0;">Dear <strong>${name || 'Team Member'}</strong>,</p>
            <p>This is an automated notification to inform you that your account access as <strong>${role}</strong>${title ? ` (${title})` : ''} on the <strong>Call-Astro Task Tracker</strong> platform has been deactivated.</p>

            <div style="background: #131d31; border: 1px solid #1e293b; padding: 16px; border-radius: 10px; margin: 20px 0;">
              <p style="margin: 4px 0; color: #94a3b8; font-size: 13px;"><strong>Account:</strong> ${toEmail}</p>
              <p style="margin: 4px 0; color: #94a3b8; font-size: 13px;"><strong>Status:</strong> No longer active as ${role}</p>
              ${removedByName ? `<p style="margin: 4px 0; color: #94a3b8; font-size: 13px;"><strong>Processed by:</strong> ${removedByName}</p>` : ''}
            </div>

            <p style="font-size: 13px; color: #cbd5e1;">
              Thank you for your valuable contributions to the team and projects during your time at Call-Astro.
            </p>
            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
              If you believe this is an error, please reach out to your system administrator.
            </p>
          </div>

          <div style="padding: 14px 24px; background: #060a12; text-align: center; font-size: 11px; color: #475569; border-top: 1px solid #1e293b;">
            Call-Astro Task Tracker • Automated System Notification
          </div>
        </div>
      `
    });

    if (nodemailer.getTestMessageUrl && info) {
      const url = nodemailer.getTestMessageUrl(info);
      if (url) console.log('📧 Deactivated Email Preview URL:', url);
    }
  } catch (err) {
    console.error('Failed to send deactivated email:', err);
  }
}

/**
 * Send email when a project is allocated to a team, squad, or member
 */
export async function sendProjectAllocatedEmail({
  toEmail,
  recipientName,
  projectName,
  teamName,
  departmentName,
  description,
  allocatedByName,
  roleInTeam
}) {
  if (!toEmail) return;

  try {
    const mailClient = await getTransporter();
    const portalUrl = process.env.APP_URL || 'http://localhost:5173';

    const info = await mailClient.sendMail({
      from: process.env.MAIL_FROM || '"Call-Astro Task Tracker" <notifications@call-astro.in>',
      to: toEmail,
      subject: `🚀 Project Allocated: "${projectName}"${teamName ? ` [${teamName}]` : ''}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b1120; color: #f8fafc; border-radius: 14px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="padding: 26px 24px; background: linear-gradient(135deg, #4f46e5 0%, #0284c7 100%); border-bottom: 1px solid #334155;">
            <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 6px; color: #a5b4fc;">
              Project Allocation
            </span>
            <h1 style="margin: 10px 0 0; font-size: 21px; font-weight: 700; color: #ffffff;">New Project Allocated</h1>
            <p style="margin: 4px 0 0; font-size: 13px; color: #e0e7ff; opacity: 0.95;">
              ${projectName}
            </p>
          </div>

          <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
            <p style="margin-top: 0;">Hello <strong>${recipientName || 'Team Member'}</strong>,</p>
            <p>You have been allocated to the following project on the <strong>Call-Astro Task Tracker</strong> platform:</p>

            <div style="background: #131d31; border: 1px solid #1e293b; border-left: 4px solid #6366f1; padding: 18px; border-radius: 10px; margin: 20px 0;">
              <h3 style="margin: 0 0 12px; font-size: 16px; color: #ffffff;">${projectName}</h3>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                ${teamName ? `
                  <tr>
                    <td style="padding: 5px 0; color: #94a3b8; width: 140px;"><strong>Assigned Squad:</strong></td>
                    <td style="padding: 5px 0; color: #38bdf8; font-weight: 600;">${teamName}</td>
                  </tr>
                ` : ''}
                ${roleInTeam ? `
                  <tr>
                    <td style="padding: 5px 0; color: #94a3b8;"><strong>Role in Squad:</strong></td>
                    <td style="padding: 5px 0; color: #cbd5e1;">${roleInTeam}</td>
                  </tr>
                ` : ''}
                ${departmentName ? `
                  <tr>
                    <td style="padding: 5px 0; color: #94a3b8;"><strong>Department:</strong></td>
                    <td style="padding: 5px 0; color: #cbd5e1;">${departmentName}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td style="padding: 5px 0; color: #94a3b8;"><strong>Allocated By:</strong></td>
                  <td style="padding: 5px 0; color: #cbd5e1;">${allocatedByName || 'Project Administrator'}</td>
                </tr>
              </table>

              ${description ? `
                <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #1e293b; color: #94a3b8; font-size: 12px;">
                  <strong style="color: #cbd5e1;">Project Scope / Description:</strong>
                  <p style="margin: 4px 0 0; color: #94a3b8; line-height: 1.5;">${description}</p>
                </div>
              ` : ''}
            </div>

            <div style="text-align: center; margin: 26px 0;">
              <a href="${portalUrl}" target="_blank" style="display: inline-block; background: #4f46e5; color: #ffffff; font-weight: bold; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);">
                Open Project in Dashboard →
              </a>
            </div>

            <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">
              You can view all associated tasks, track milestones, and collaborate with your teammates directly in Call-Astro Task Tracker.
            </p>
          </div>

          <div style="padding: 14px 24px; background: #060a12; text-align: center; font-size: 11px; color: #475569; border-top: 1px solid #1e293b;">
            Call-Astro Task Tracker • Automated Team Notification
          </div>
        </div>
      `
    });

    if (nodemailer.getTestMessageUrl && info) {
      const url = nodemailer.getTestMessageUrl(info);
      if (url) console.log('📧 Project Allocated Preview URL:', url);
    }
  } catch (err) {
    console.error('Failed to send project allocated email:', err);
  }
}


