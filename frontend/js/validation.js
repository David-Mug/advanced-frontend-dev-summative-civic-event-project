/**
 * Client-side validation rules. They mirror the backend so users get instant feedback,
 * but the backend re-validates every request.
 */
(function (CE) {
  'use strict';

  // Same rule as backend/src/controllers/auth.controller.js PASSWORD_REGEX
  const PASSWORD_RULES = [
    { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { id: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
    { id: 'number', label: 'One number', test: (p) => /\d/.test(p) },
    { id: 'special', label: 'One special character', test: (p) => /[\W_]/.test(p) },
  ];

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  CE.validate = {
    PASSWORD_RULES,

    email(value) {
      const v = String(value || '').trim();
      if (!v) return 'Email is required.';
      if (!EMAIL_RE.test(v)) return 'Enter a valid email address, like name@example.com.';
      return null;
    },

    fullName(value) {
      const v = String(value || '').trim();
      if (!v) return 'Full name is required.';
      if (v.length < 2) return 'Full name must be at least 2 characters.';
      if (v.length > 255) return 'Full name must be 255 characters or fewer.';
      return null;
    },

    password(value) {
      const failed = PASSWORD_RULES.filter((r) => !r.test(value || ''));
      if (!value) return 'Password is required.';
      if (failed.length) return 'Password needs: ' + failed.map((r) => r.label.toLowerCase()).join(', ') + '.';
      return null;
    },

    /** 0–4 strength score with label, used by the strength meter. */
    passwordStrength(value) {
      const p = value || '';
      const passed = PASSWORD_RULES.filter((r) => r.test(p)).length;
      let score = Math.max(0, passed - 1); // 0..4
      if (p.length >= 12 && passed === 5) score = 4;
      else if (passed === 5) score = 3;
      const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
      return { score, label: p ? labels[score] : '', passed };
    },

    required(value, label) {
      return String(value ?? '').trim() ? null : `${label} is required.`;
    },
  };
})(window.CE);
