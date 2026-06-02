// Aibit Component Types

export interface AibitMessage {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: number;
  isOwn: boolean;
  msgtype?: string;
}

export interface AibitRoom {
  roomId: string;
  name: string;
  topic?: string;
  avatarUrl?: string;
  members: string[];
  memberCount: number;
  unreadCount: number;
  messageCount?: number;
  joined?: boolean;
  isDirect?: boolean;
  directWith?: string;
  isOfficial?: boolean;
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  width?: string | number;
  placement?: 'left' | 'right' | 'top' | 'bottom';
}

export interface DrawerState {
  isOpen: boolean;
  selectedRoom: AibitRoom | null;
  selectedMessage: AibitMessage | null;
}
