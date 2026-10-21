import React, { useState, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  User,
  ShieldCheck,
  Mail,
  Building,
  Briefcase,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';

export default function UserProfileView() {
  const { user, updateCurrentUser } = useAuth();
  const fileInputRef = useRef(null);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState({ type: '', text: '' });

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });

  // Handle avatar upload
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarMsg({ type: 'error', text: 'Please select a valid image file (JPEG, PNG, WEBP, GIF).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg({ type: 'error', text: 'Image file size must be less than 5MB.' });
      return;
    }

    setAvatarMsg({ type: '', text: '' });
    setUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await api.uploadAvatar(formData);
      setAvatarMsg({ type: 'success', text: res.message || 'Profile picture updated successfully!' });

      if (res.user && updateCurrentUser) {
        updateCurrentUser({ avatar: res.user.avatar });
      } else if (res.avatar && updateCurrentUser) {
        updateCurrentUser({ avatar: res.avatar });
      }
    } catch (err) {
      console.error('Failed uploading avatar:', err);
      setAvatarMsg({ type: 'error', text: err.message || 'Failed to upload profile picture.' });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle avatar removal
  const handleRemoveAvatar = async () => {
    if (!user?.avatar) return;
    setAvatarMsg({ type: '', text: '' });
    setUploadingAvatar(true);

    try {
      const res = await api.removeAvatar();
      setAvatarMsg({ type: 'success', text: res.message || 'Profile picture removed.' });
      if (updateCurrentUser) {
        updateCurrentUser({ avatar: null });
      }
    } catch (err) {
      console.error('Failed removing avatar:', err);
      setAvatarMsg({ type: 'error', text: err.message || 'Failed to remove profile picture.' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle password change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassMsg({ type: '', text: '' });

    if (!currentPassword) {
      setPassMsg({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (!newPassword || newPassword.trim().length < 4) {
      setPassMsg({ type: 'error', text: 'New password must be at least 4 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    try {
      setChangingPass(true);
      const res = await api.changePassword({
        currentPassword,
        newPassword
      });
      setPassMsg({ type: 'success', text: res.message || 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Failed to change password:', err);
      setPassMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setChangingPass(false);
    }
  };

  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'Manager';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Profile Header Hero Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/10 via-sky-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10 text-center sm:text-left">
          {/* Avatar Hero Container with Quick Change Button */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-gradient-to-tr from-amber-500 via-purple-600 to-sky-500 flex items-center justify-center text-white text-3xl font-black shadow-2xl border-2 border-white/20 dark:border-zinc-700">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user?.name || 'User Profile'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
              )}
            </div>

            {/* Quick Upload Hover Overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
              title="Change Profile Picture"
            >
              <Camera className="w-5 h-5" />
              <span>Change</span>
            </button>
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {user?.name || 'User Profile'}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  isAdmin
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40'
                    : isManager
                    ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/40'
                    : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                }`}
              >
                {user?.role || 'Employee'}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
              {user?.email} • {user?.title || user?.role}
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px] text-slate-600 dark:text-neutral-400">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 font-mono">
                User ID: #{user?.id}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700">
                🏢 {user?.department_name || 'General Management'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700">
                💼 {user?.title || 'Employee'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Profile Picture & Details + Password Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Profile Picture & Read-Only Identity */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-md space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Profile Photo
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
              Max 5MB (JPG, PNG)
            </span>
          </div>

          {avatarMsg.text && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                avatarMsg.type === 'success'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                  : 'bg-rose-950/60 text-rose-300 border-rose-800/80'
              }`}
            >
              {avatarMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{avatarMsg.text}</span>
            </div>
          )}

          {/* Photo Upload Section */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-md shrink-0 border border-slate-200 dark:border-zinc-700">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user?.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="btn-primary text-xs py-1.5 px-3 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
                </button>

                {user?.avatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="text-xs py-1.5 px-3 rounded-xl font-bold bg-slate-200 dark:bg-zinc-800 hover:bg-rose-500/20 text-slate-700 dark:text-neutral-300 hover:text-rose-400 border border-slate-300 dark:border-zinc-700 hover:border-rose-500/40 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                Click upload to choose a photo from your computer.
              </p>
            </div>
          </div>

          {/* Locked Identity Details (Read-Only) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-neutral-300 pb-1">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Identity Details (Managed by Administrator)</span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 block mb-1">
                Full Name
              </label>
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-800 dark:text-neutral-200">
                <span>{user?.name}</span>
                <Lock className="w-3.5 h-3.5 text-slate-400 opacity-60" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 block mb-1">
                Job Title / Designation
              </label>
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-800 dark:text-neutral-200">
                <span>{user?.title || user?.role || 'Employee'}</span>
                <Lock className="w-3.5 h-3.5 text-slate-400 opacity-60" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 block mb-1">
                Email Address (Login ID)
              </label>
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-800 dark:text-neutral-200">
                <span>{user?.email}</span>
                <Lock className="w-3.5 h-3.5 text-slate-400 opacity-60" />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-[10px] text-amber-600 dark:text-amber-300">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                To change your registered Name, Job Title, or Department, please contact your Organization Administrator.
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Change Password */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-md space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-zinc-800">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Change Account Password
            </h2>
          </div>

          {passMsg.text && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                passMsg.type === 'success'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                  : 'bg-rose-950/60 text-rose-300 border-rose-800/80'
              }`}
            >
              {passMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{passMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
            {/* Current Password */}
            <div>
              <label className="font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                Current Password *
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input-field py-2 text-xs w-full pr-9"
                  placeholder="Enter current password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field py-2 text-xs w-full pr-9"
                  placeholder="At least 4 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="font-bold text-slate-700 dark:text-neutral-300 block mb-1">
                Confirm New Password *
              </label>
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field py-2 text-xs w-full"
                placeholder="Re-type new password"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={changingPass}
                className="w-full py-2.5 rounded-xl font-extrabold text-xs bg-amber-500 hover:bg-amber-400 text-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{changingPass ? 'Updating Password...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
