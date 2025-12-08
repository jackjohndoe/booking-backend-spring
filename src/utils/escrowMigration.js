// Escrow Migration Utility
// Helps migrate existing AsyncStorage escrow transactions to Escrow.com
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserStorageKey } from './userStorage';
import * as escrowService from '../services/escrowService';

/**
 * Feature flag to control escrow system
 * Set to true to use Escrow.com, false to use AsyncStorage
 */
export const USE_ESCROW_COM = true;

/**
 * Migrate a single escrow payment from AsyncStorage to Escrow.com
 * @param {object} escrowPayment - Escrow payment from AsyncStorage
 * @returns {Promise<object|null>} Migrated escrow transaction or null if migration fails
 */
export const migrateEscrowPayment = async (escrowPayment) => {
  try {
    if (!escrowPayment || !escrowPayment.bookingId) {
      console.warn('Invalid escrow payment for migration:', escrowPayment);
      return null;
    }

    // Skip if already migrated (has escrowId)
    if (escrowPayment.escrowId) {
      console.log(`Escrow payment ${escrowPayment.id} already migrated`);
      return escrowPayment;
    }

    // Skip if no Paystack reference (required for Escrow.com)
    if (!escrowPayment.paymentReference) {
      console.warn(`Escrow payment ${escrowPayment.id} has no Paystack reference, cannot migrate`);
      return null;
    }

    // Create Escrow.com transaction
    const escrowTransaction = await escrowService.createEscrowTransaction(
      escrowPayment.bookingId,
      escrowPayment.amount,
      escrowPayment.userEmail,
      escrowPayment.hostEmail,
      escrowPayment.paymentReference,
      {
        checkInDate: escrowPayment.checkInDate,
        description: `Migrated escrow for booking ${escrowPayment.bookingId}`,
      }
    );

    // Update local escrow payment with Escrow.com ID
    escrowPayment.escrowId = escrowTransaction.escrowId;
    escrowPayment.migratedAt = new Date().toISOString();
    escrowPayment.migrationStatus = 'completed';

    console.log(`✅ Migrated escrow payment ${escrowPayment.id} to Escrow.com: ${escrowTransaction.escrowId}`);
    return escrowPayment;
  } catch (error) {
    console.error(`Error migrating escrow payment ${escrowPayment?.id}:`, error);
    if (escrowPayment) {
      escrowPayment.migrationStatus = 'failed';
      escrowPayment.migrationError = error.message;
    }
    return null;
  }
};

/**
 * Migrate all escrow payments for a user from AsyncStorage to Escrow.com
 * @param {string} userEmail - User email
 * @returns {Promise<object>} Migration result with counts
 */
export const migrateUserEscrowPayments = async (userEmail) => {
  try {
    if (!userEmail) {
      throw new Error('User email is required');
    }

    const escrowKey = getUserStorageKey('escrowPayments', userEmail);
    const escrowJson = await AsyncStorage.getItem(escrowKey);
    const escrowPayments = escrowJson ? JSON.parse(escrowJson) : [];

    if (escrowPayments.length === 0) {
      return {
        total: 0,
        migrated: 0,
        failed: 0,
        skipped: 0,
      };
    }

    let migrated = 0;
    let failed = 0;
    let skipped = 0;

    for (const escrowPayment of escrowPayments) {
      const result = await migrateEscrowPayment(escrowPayment);
      if (result && result.escrowId) {
        migrated++;
      } else if (result && result.migrationStatus === 'failed') {
        failed++;
      } else {
        skipped++;
      }
    }

    // Save updated escrow payments with migration status
    await AsyncStorage.setItem(escrowKey, JSON.stringify(escrowPayments));

    return {
      total: escrowPayments.length,
      migrated,
      failed,
      skipped,
    };
  } catch (error) {
    console.error('Error migrating user escrow payments:', error);
    throw error;
  }
};

/**
 * Migrate all escrow payments across all users
 * @returns {Promise<object>} Migration result with counts
 */
export const migrateAllEscrowPayments = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const escrowKeys = allKeys.filter(key => key.includes('escrowPayments'));

    let totalMigrated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalUsers = 0;

    for (const key of escrowKeys) {
      try {
        // Extract user email from key
        const userEmailMatch = key.match(/escrowPayments_(.+)/);
        if (!userEmailMatch || !userEmailMatch[1]) {
          continue;
        }

        const userEmail = userEmailMatch[1];
        const result = await migrateUserEscrowPayments(userEmail);
        
        totalMigrated += result.migrated;
        totalFailed += result.failed;
        totalSkipped += result.skipped;
        totalUsers++;
      } catch (error) {
        console.error(`Error migrating escrow for key ${key}:`, error);
        totalFailed++;
      }
    }

    return {
      totalUsers,
      totalMigrated,
      totalFailed,
      totalSkipped,
    };
  } catch (error) {
    console.error('Error migrating all escrow payments:', error);
    throw error;
  }
};

/**
 * Check if escrow migration is needed
 * @param {string} userEmail - User email (optional, checks all users if not provided)
 * @returns {Promise<boolean>} True if migration is needed
 */
export const isMigrationNeeded = async (userEmail = null) => {
  try {
    if (userEmail) {
      const escrowKey = getUserStorageKey('escrowPayments', userEmail);
      const escrowJson = await AsyncStorage.getItem(escrowKey);
      const escrowPayments = escrowJson ? JSON.parse(escrowJson) : [];
      
      // Check if any escrow payment lacks escrowId
      return escrowPayments.some(ep => !ep.escrowId && ep.paymentReference);
    }

    // Check all users
    const allKeys = await AsyncStorage.getAllKeys();
    const escrowKeys = allKeys.filter(key => key.includes('escrowPayments'));

    for (const key of escrowKeys) {
      const escrowJson = await AsyncStorage.getItem(key);
      const escrowPayments = escrowJson ? JSON.parse(escrowJson) : [];
      
      if (escrowPayments.some(ep => !ep.escrowId && ep.paymentReference)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
};


















