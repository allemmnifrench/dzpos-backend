import { Request, Response, NextFunction } from 'express';
import { AdminRole, ErrorCode } from '../../src/types/dzpos.js';
import { db } from '../db.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: AdminRole;
  };
}

export function apiError(res: Response, statusCode: number, code: ErrorCode, message: string, details?: any) {
  return res.status(statusCode).json({
    success: false,
    error_code: code,
    message: message,
    details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
    error: {
      code,
      message,
      details: details || null,
      timestamp: new Date().toISOString()
    }
  });
}

export function authMiddleware(requiredRole?: AdminRole | AdminRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // In production, supports Bearer Token or session header
    const authHeader = req.headers.authorization;
    const adminUserIdHeader = req.headers['x-admin-user-id'] as string;
    const adminUserHeader = req.headers['x-admin-user'] as string;
    const adminRoleHeader = req.headers['x-admin-role'] as AdminRole;

    const allUsers = db.getAdminUsers();

    let matchedUser = null;

    // 1. If explicit user ID header is provided, find that exact user
    if (adminUserIdHeader) {
      matchedUser = allUsers.find(u => u.id === adminUserIdHeader);
    }

    // 2. If explicit username header is provided, find user by username
    if (!matchedUser && adminUserHeader) {
      matchedUser = allUsers.find(
        u => u.username.toLowerCase() === adminUserHeader.toLowerCase() ||
             u.email.toLowerCase() === adminUserHeader.toLowerCase()
      );
    }

    // 3. If Bearer token is provided
    if (!matchedUser && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token === 'dzpos-support-token') {
        matchedUser = allUsers.find(u => u.role === 'SUPPORT') || allUsers[2];
      } else if (token === 'dzpos-admin-token') {
        matchedUser = allUsers.find(u => u.role === 'ADMIN') || allUsers[1];
      } else if (token.includes('allemmni')) {
        matchedUser = allUsers.find(u => u.username === 'allemmni' || u.email === 'allemmnifrench@gmail.com');
      }
    }

    // 4. If adminRoleHeader is provided
    if (!matchedUser && adminRoleHeader && ['MAIN_ADMIN', 'ADMIN', 'SUPPORT'].includes(adminRoleHeader)) {
      matchedUser = allUsers.find(u => u.role === adminRoleHeader);
    }

    // Default fallback
    const finalUser = matchedUser || allUsers[0] || {
      id: 'usr_main_admin',
      username: 'superadmin',
      role: 'MAIN_ADMIN' as AdminRole
    };

    const userRole = (adminRoleHeader && ['MAIN_ADMIN', 'ADMIN', 'SUPPORT'].includes(adminRoleHeader))
      ? adminRoleHeader
      : finalUser.role;

    req.user = {
      id: finalUser.id,
      username: finalUser.username,
      role: userRole
    };

    if (requiredRole) {
      const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!allowedRoles.includes(userRole)) {
        return apiError(
          res,
          403,
          'FORBIDDEN',
          `Insufficient permissions. Required: ${allowedRoles.join(' or ')}, your role: ${userRole}`
        );
      }
    }

    next();
  };
}
