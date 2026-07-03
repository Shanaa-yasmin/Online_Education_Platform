import { useNotificationContext } from '../context/NotificationContext.jsx';

/**
 * useNotifications — custom hook to access global notification state.
 * Refactored to use global NotificationContext under the hood.
 */
export default function useNotifications() {
  return useNotificationContext();
}
