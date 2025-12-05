package com.example.booking.util;

import com.example.booking.entity.User;

/**
 * Utility class for security and role-based access control
 */
public class SecurityUtils {

    /**
     * Checks if a user has ADMIN role
     */
    public static boolean isAdmin(User user) {
        return user != null && user.getRole() == User.Role.ADMIN;
    }

    /**
     * Checks if a user has HOST role
     */
    public static boolean isHost(User user) {
        return user != null && user.getRole() == User.Role.HOST;
    }

    /**
     * Checks if a user has ADMIN or HOST role
     */
    public static boolean isAdminOrHost(User user) {
        return isAdmin(user) || isHost(user);
    }

    /**
     * Checks if a user can bypass ownership checks (ADMIN can bypass)
     */
    public static boolean canBypassOwnership(User user) {
        return isAdmin(user);
    }
}
