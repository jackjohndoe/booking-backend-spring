import { useState, useCallback } from 'react';

/**
 * Custom hook to manage button loading state
 * Prevents double-clicks and provides loading state
 * 
 * @returns {Object} { loading, handleAsyncPress }
 * 
 * @example
 * const { loading, handleAsyncPress } = useButtonLoading();
 * 
 * <TouchableOpacity 
 *   onPress={handleAsyncPress(async () => {
 *     await someAsyncOperation();
 *   })}
 *   disabled={loading}
 * >
 *   {loading ? 'Processing...' : 'Submit'}
 * </TouchableOpacity>
 */
export const useButtonLoading = () => {
  const [loading, setLoading] = useState(false);

  const handleAsyncPress = useCallback((asyncFn) => {
    return async (...args) => {
      if (loading) return; // Prevent double-click
      
      setLoading(true);
      try {
        await asyncFn(...args);
      } catch (error) {
        console.error('Button action error:', error);
        throw error; // Re-throw so caller can handle
      } finally {
        setLoading(false);
      }
    };
  }, [loading]);

  return { loading, setLoading, handleAsyncPress };
};


















