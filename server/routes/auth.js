import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';

const router = express.Router();

// Get list of all available user profiles for switching
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    ORDER BY u.role DESC, u.id ASC
  `).all();
  res.json({ users });
});

// Set active user by ID (login-free profile switch)
router.get('/user/:id', (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `).get(req.params.id);

  if (!user) {
    return res.status(404).json({ message: 'User profile not found.' });
  }

  res.json({ user });
});

// Create new Manager profile
router.post('/managers', (req, res) => {
  const { name, email, department_id } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Manager name is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Manager email is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(400).json({ message: 'A user with this email address already exists.' });
  }

  const hashedPassword = bcrypt.hashSync('password123', 10);
  const info = db.prepare(`
    INSERT INTO users (name, email, password, role, department_id)
    VALUES (?, ?, ?, 'Manager', ?)
  `).run(name.trim(), cleanEmail, hashedPassword, department_id || 1);

  const newManager = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department_id, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json({
    message: 'Manager profile created successfully',
    manager: newManager
  });
});

export default router;
