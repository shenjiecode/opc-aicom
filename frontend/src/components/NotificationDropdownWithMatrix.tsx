import { useMatrix } from "@/contexts/MatrixContext";
import { NotificationDropdown } from "./NotificationDropdown";

export function NotificationDropdownWithMatrix({ className }: { className?: string }) {
  try {
    const {
      invitations,
      notifications,
      unreadNotificationCount,
      acceptInvitation,
      rejectInvitation,
      clearAllNotifications,
      isInitialized,
    } = useMatrix();

    return (
      <NotificationDropdown
        className={className}
        invitations={invitations}
        notifications={notifications}
        unreadCount={unreadNotificationCount}
        isMatrixConnected={isInitialized}
        onAcceptInvite={acceptInvitation}
        onRejectInvite={rejectInvitation}
        onClearAll={clearAllNotifications}
      />
    );
  } catch {
    // MatrixProvider not available
    return (
      <NotificationDropdown
        className={className}
        isMatrixConnected={false}
      />
    );
  }
}

export default NotificationDropdownWithMatrix;