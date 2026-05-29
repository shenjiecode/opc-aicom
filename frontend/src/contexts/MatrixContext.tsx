import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as matrixSdk from 'matrix-js-sdk';
import { Room, RoomEvent, MatrixEvent, ClientEvent } from 'matrix-js-sdk';

interface MatrixRoom {
  roomId: string;
  name: string;
  topic?: string;
  avatarUrl?: string;
  members: string[];
  unreadCount: number;
  messageCount?: number; // Total messages/posts in room
  joined?: boolean;
  isDirect?: boolean; // 是否是私聊房间
  directWith?: string; // 如果是私聊，对方的 userId
  isOfficial?: boolean; // 是否是官方房间
}

interface MatrixMessage {
  id: string;
  sender: string;
  senderName: string;
  content: string;
timestamp: number;
  isOwn: boolean;
  msgtype?: string;
}

export interface MatrixWorker {
  workerId: string;
  userId: string;
  name: string;
  isOnline: boolean;
  rooms: string[];
}

interface MatrixUser {
  userId: string;
  name: string;
  displayName?: string;
  lastActivity?: number; // Last activity timestamp
  isOnline?: boolean; // Online status based on activity
}

export interface MatrixInvitation {
  roomId: string;
  roomName: string;
  inviterId: string;
  inviterName?: string;
  timestamp: number;
}

export interface MatrixNotification {
  type: 'invitation' | 'message' | 'system';
  id: string;
  roomId?: string;
  roomName?: string;
  content?: string;
  senderId?: string;
  senderName?: string;
  timestamp: number;
  read: boolean;
}

interface MatrixContextType {
  // Client state
  client: matrixSdk.MatrixClient | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Auth state
  matrixUserId: string | null;
  accessToken: string | null;
  homeserverUrl: string | null;
  
  // Room state
  rooms: MatrixRoom[];
  allRooms: MatrixRoom[]; // All rooms including public ones
  currentRoom: MatrixRoom | null;
  messages: MatrixMessage[];
  
  // User online state
  userOnline: boolean;
  lastActivityTime: number | null;
  updateActivity: () => void;

  initialize: () => Promise<void>;
  disconnect: () => void;
  selectRoom: (roomId: string) => void;
  sendMessage: (text: string) => Promise<void>;
  createRoom: (name: string, topic?: string, isPublic?: boolean) => Promise<string>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  inviteUser: (roomId: string, userId: string) => Promise<void>;
  renameRoom: (roomId: string, newName: string) => Promise<void>;
  refreshRooms: () => Promise<void>;

  // Worker state
  workers: MatrixWorker[];
  refreshWorkers: () => Promise<void>;
  joinWorkerToRoom: (workerId: string, roomId: string) => Promise<void>;
  
  // Direct message to specific room
  sendMessageToRoom: (roomId: string, text: string) => Promise<void>;
  
  // User state
  users: MatrixUser[];
  refreshUsers: () => Promise<void>;
  
  // Notifications state
  invitations: MatrixInvitation[];
  notifications: MatrixNotification[];
  unreadNotificationCount: number;
  acceptInvitation: (roomId: string) => Promise<void>;
  rejectInvitation: (roomId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => void;
  clearAllNotifications: () => void;
}

const MatrixContext = createContext<MatrixContextType | undefined>(undefined);

const API_BASE = '/api';
const MATRIX_HOMESERVER = import.meta.env.VITE_MATRIX_HOMESERVER || 'http://localhost:8008';

// Fetch helper with credentials
async function fetchApi(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

interface MatrixProviderProps {
  children: React.ReactNode;
}

export function MatrixProvider({ children }: MatrixProviderProps) {
  const [client, setClient] = useState<matrixSdk.MatrixClient | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [matrixUserId, setMatrixUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [homeserverUrl, setHomeserverUrl] = useState<string | null>(null);
  
  const [rooms, setRooms] = useState<MatrixRoom[]>([]);
  const [allRooms, setAllRooms] = useState<MatrixRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<MatrixRoom | null>(null);
  const [messages, setMessages] = useState<MatrixMessage[]>([]);
  const [workers, setWorkers] = useState<MatrixWorker[]>([]);
  const [users, setUsers] = useState<MatrixUser[]>([]);
  const [invitations, setInvitations] = useState<MatrixInvitation[]>([]);
  const [notifications, setNotifications] = useState<MatrixNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const clientRef = useRef<matrixSdk.MatrixClient | null>(null);
  const workerStatusRef = useRef<Map<string, boolean>>(new Map());
  const currentRoomRef = useRef<MatrixRoom | null>(null);
  
  // User activity tracking for auto-logout
  const [userOnline, setUserOnline] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState<number | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
  // Keep currentRoomRef in sync with currentRoom state
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);
  
  // Update activity time and set user online
  const updateActivity = useCallback(() => {
    const now = Date.now();
    setLastActivityTime(now);
    setUserOnline(true);
    console.log('[Matrix] Activity updated:', new Date(now).toLocaleTimeString());
  }, []);
  
  // Set user online when initialized
  useEffect(() => {
    if (isInitialized) {
      updateActivity();
    }
  }, [isInitialized, updateActivity]);
  
  // Convert Matrix room to our format
  const convertRoom = useCallback((room: Room): MatrixRoom => {
    const members = room.getJoinedMembers().map(m => m.userId);
    const name = room.name || room.roomId;
    
    // Get topic and avatar from room state
    const topic = room.currentState.getStateEvents('m.room.topic')[0]?.getContent()?.topic;
    const avatarUrl = room.currentState.getStateEvents('m.room.avatar')[0]?.getContent()?.url;
    
    // 检测是否是私聊房间（只有2个成员）
    const currentUserId = clientRef.current?.getUserId();
    const isDirect = members.length === 2;
    const directWith = isDirect && currentUserId 
      ? members.find(m => m !== currentUserId) 
      : undefined;
    
    return {
      roomId: room.roomId,
      name,
      topic: topic || undefined,
      avatarUrl: avatarUrl || undefined,
      members,
      unreadCount: room.getUnreadNotificationCount(),
      isDirect,
      directWith,
    };
  }, []);

  // Load messages for a room
  const loadRoomMessages = useCallback((room: Room) => {
    const timeline = room.getLiveTimeline();
    const events = timeline.getEvents();
    
    // Use Map for deduplication by sender + content (not event ID)
    // This handles cases where the same message is sent with different event IDs
    // (e.g., m.text and m.emote versions of the same content from bite)
    // m.emote messages have "* " prefix in body which we strip for deduplication
    const messageMap = new Map<string, MatrixMessage>();
    
    events.forEach((event: MatrixEvent) => {
      if (event.getType() === 'm.room.message') {
        const content = event.getContent();
        const sender = event.getSender();
        const eventId = event.getId();
        const msgtype = content.msgtype || 'm.text';
        
        if (content.body && sender && eventId) {
          // Strip "* " prefix for messages that might be duplicates
          // bite agent sometimes sends duplicate messages with "* " prefix
          let normalizedBody = content.body;
          // Check if body starts with "* " and strip it
          if (normalizedBody.startsWith('* ')) {
            normalizedBody = normalizedBody.substring(2);
          }
          // Create dedupe key based on sender + normalized content
          const dedupeKey = `${sender}:${normalizedBody}`;
          
          // Check if we already have this message
          const existing = messageMap.get(dedupeKey);
          
          // Prefer m.text over m.emote (show normal message, not emote)
          if (existing && existing.msgtype === 'm.emote' && msgtype === 'm.text') {
            // Replace emote with text version
            const member = room.getMember(sender);
            messageMap.set(dedupeKey, {
              id: eventId,
              sender,
              senderName: member?.name || sender,
              content: content.body,
              timestamp: event.getTs(),
              isOwn: sender === clientRef.current?.getUserId(),
              msgtype,
            });
          } else if (!existing) {
            // New message, add it
            const member = room.getMember(sender);
            messageMap.set(dedupeKey, {
              id: eventId,
              sender,
              senderName: member?.name || sender,
              content: content.body,
              timestamp: event.getTs(),
              isOwn: sender === clientRef.current?.getUserId(),
              msgtype,
            });
          }
          // If existing is m.text and new is m.emote, skip (keep m.text version)
        }
      }
    });
    
    setMessages(Array.from(messageMap.values()));
  }, []);

  // Initialize Matrix client
  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Step 1: Get Matrix credentials from backend
      const loginResponse = await fetchApi(`${API_BASE}/matrix/login`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      const loginData = await loginResponse.json();
      
      if (loginData.code !== 0 || !loginData.data) {
        throw new Error(loginData.message || 'Failed to get Matrix credentials');
      }
      
      const { access_token, user_id, homeserver_url } = loginData.data;
      
      setAccessToken(access_token);
      setMatrixUserId(user_id);
      setHomeserverUrl(homeserver_url || MATRIX_HOMESERVER);
      
      // Step 2: Create Matrix client
      const matrixClient = matrixSdk.createClient({
        baseUrl: homeserver_url || MATRIX_HOMESERVER,
        accessToken: access_token,
        userId: user_id,
      });
      
      clientRef.current = matrixClient;
      
      // Step 3: Setup event listeners
      matrixClient.on(ClientEvent.Sync, (state) => {
        if (state === 'PREPARED') {
          console.log('[Matrix] Client synced and ready');
          
          // Get all rooms
          const matrixRooms = matrixClient.getRooms();
          const convertedRooms = matrixRooms.map(convertRoom);
          setRooms(convertedRooms);
          
          // Scan all rooms for worker status messages
          matrixRooms.forEach(room => {
            const timeline = room.getLiveTimeline();
            const events = timeline.getEvents();
            events.forEach((event: MatrixEvent) => {
              if (event.getType() === 'm.room.message') {
                const content = event.getContent();
                const body = content?.body || ''; 
                if (body.startsWith('STATUS:') && body.includes('|')) {
                  const parts = body.split('|');
                  const status = parts[0].replace('STATUS:', '');
                  const workerId = parts[1];
                  if (status === 'ONLINE' || status === 'OFFLINE') {
                    workerStatusRef.current.set(workerId, status === 'ONLINE');
                    console.log(`[Matrix] Initial scan: Worker ${workerId} is ${status}`);
                  }
                }
              }
            });
          });
          
          setIsInitialized(true);
          setIsLoading(false);
          refreshUsers();
          
          // Scan for invitations (rooms where membership is 'invite')
          scanInvitations(matrixClient);
        }
      });
      
      matrixClient.on(RoomEvent.Timeline, (event: MatrixEvent, room: Room | undefined) => {
        if (!room) return;
        
        // Check for worker status messages (m.notice with STATUS:)
        if (event.getType() === 'm.room.message') {
          const content = event.getContent();
          const sender = event.getSender();
          const body = content?.body || '';
          
          // Parse STATUS:ONLINE|worker-xxx or STATUS:OFFLINE|worker-xxx
          if (body.startsWith('STATUS:') && sender) {
            const parts = body.split('|');
            if (parts.length >= 2) {
              const status = parts[0].replace('STATUS:', '');
              const workerId = parts[1];
              const isOnline = status === 'ONLINE';
              
              console.log(`[Matrix] Worker ${workerId} status: ${status}`);
              
              // Update worker status ref
              workerStatusRef.current.set(workerId, isOnline);
              
              // Update workers state
              setWorkers(prev => {
                const index = prev.findIndex(w => w.workerId === workerId);
                if (index >= 0) {
                  const updated = [...prev];
                  updated[index] = { ...updated[index], isOnline };
                  return updated;
                }
                // Add new worker if not exists
                return [...prev, {
                  workerId,
                  userId: sender,
                  name: workerId,
                  isOnline,
                  rooms: [room.roomId],
                }];
              });
            }
          }
        }
        
        // Update rooms list
        const convertedRoom = convertRoom(room);
        setRooms(prev => {
          const index = prev.findIndex(r => r.roomId === room.roomId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = convertedRoom;
            return updated;
          }
          return [...prev, convertedRoom];
        });
        
        // Update messages if this is the current room
        if (currentRoomRef.current?.roomId === room.roomId) {
          loadRoomMessages(room);
        }
      });
      
      matrixClient.on(RoomEvent.Name, (room: Room) => {
        const convertedRoom = convertRoom(room);
        setRooms(prev => {
          const index = prev.findIndex(r => r.roomId === room.roomId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = convertedRoom;
            return updated;
          }
          return prev;
        });
      });
      
      // Step 4: Start client sync
      await matrixClient.startClient({ 
        initialSyncLimit: 50,
        lazyLoadMembers: true,
      });
      
      setClient(matrixClient);
      
    } catch (err) {
      console.error('[Matrix] Initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize Matrix');
      setIsLoading(false);
    }
  }, [convertRoom, loadRoomMessages]);

  // Disconnect Matrix client
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stopClient();
      clientRef.current = null;
    }
    setClient(null);
    setIsInitialized(false);
    setAccessToken(null);
    setMatrixUserId(null);
    setRooms([]);
    setCurrentRoom(null);
    setMessages([]);
  }, []);
  
  // Check inactivity timer every minute - must be after disconnect is defined
  useEffect(() => {
    const checkInactivity = () => {
      if (lastActivityTime && userOnline) {
        const elapsed = Date.now() - lastActivityTime;
        if (elapsed >= INACTIVITY_TIMEOUT) {
          console.log('[Matrix] User inactive for 10 minutes, logging out...');
          disconnect();
          setUserOnline(false);
        }
      }
    };
    
    // Check every minute
    activityTimerRef.current = setInterval(checkInactivity, 60 * 1000);
    
    return () => {
      if (activityTimerRef.current) {
        clearInterval(activityTimerRef.current);
      }
    };
  }, [lastActivityTime, userOnline, disconnect, INACTIVITY_TIMEOUT]);
  // Refresh rooms list (joined rooms only) - MUST be defined before other functions that use it
  const refreshRooms = useCallback(async () => {
    if (!clientRef.current) return;
    
    const matrixRooms = clientRef.current.getRooms();
    const convertedRooms = matrixRooms.map(convertRoom);
    setRooms(convertedRooms);
    
    // Also refresh all rooms from API
    await fetchAllRooms();
  }, [convertRoom]);

  // Select a room and load its messages
  const selectRoom = useCallback((roomId: string) => {
    if (!clientRef.current) return;
    
    const room = clientRef.current.getRoom(roomId);
    if (room) {
      const convertedRoom = convertRoom(room);
      setCurrentRoom(convertedRoom);
      loadRoomMessages(room);
      
      // Mark as read - use the room's timeline to get the last event
      const timeline = room.getLiveTimeline();
      const events = timeline.getEvents();
      if (events.length > 0) {
        clientRef.current.sendReadReceipt(events[events.length - 1]);
      }
    }
  }, [convertRoom, loadRoomMessages]);
  // Send a message to current room
  const sendMessage = useCallback(async (text: string) => {
    if (!clientRef.current || !currentRoom) {
      throw new Error('Not connected to Matrix or no room selected');
    }
    
    // Update activity time when user sends message
    updateActivity();
    
    // Optimistic update: add message to UI immediately
    const optimisticMsg: MatrixMessage = {
      id: `local-${Date.now()}`,
      sender: clientRef.current.getUserId() || '',
      senderName: '你',
      content: text,
      timestamp: Date.now(),
      isOwn: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    
    try {
      await clientRef.current.sendTextMessage(currentRoom.roomId, text);
    } finally {
      // Refresh messages from server (replaces optimistic message with real one)
      const room = clientRef.current?.getRoom(currentRoom.roomId);
      if (room) {
        loadRoomMessages(room);
      }
    }
  }, [currentRoom, loadRoomMessages, updateActivity]);

  // Send message to a specific room (without switching current room)
  const sendMessageToRoom = useCallback(async (roomId: string, text: string) => {
    if (!clientRef.current) {
      throw new Error('Not connected to Matrix');
    }
    
    await clientRef.current.sendTextMessage(roomId, text);
  }, []);

  // Create a new room
  const createRoom = useCallback(async (name: string, topic?: string, isPublic = false): Promise<string> => {
    const response = await fetchApi(`${API_BASE}/matrix/rooms`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        topic,
        visibility: isPublic ? 'public' : 'private',
      }),
    });
    
    const data = await response.json();
    
    if (data.code !== 0 || !data.data) {
      throw new Error(data.message || 'Failed to create room');
    }
    
    // Refresh rooms
    await refreshRooms();
    
    return data.data.room_id;
  }, [refreshRooms]);

  // Join a room
  const joinRoom = useCallback(async (roomId: string) => {
    const response = await fetchApi(`${API_BASE}/matrix/rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(data.message || 'Failed to join room');
    }
    
    await refreshRooms();
  }, [refreshRooms]);

  // Leave a room
  const leaveRoom = useCallback(async (roomId: string) => {
    const response = await fetchApi(`${API_BASE}/matrix/rooms/${encodeURIComponent(roomId)}/leave`, {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(data.message || 'Failed to leave room');
    }
    
    if (currentRoom?.roomId === roomId) {
      setCurrentRoom(null);
      setMessages([]);
    }
    
    await refreshRooms();
  }, [currentRoom, refreshRooms]);

  // Invite user to room
  const inviteUser = useCallback(async (roomId: string, userId: string) => {
    const response = await fetchApi(`${API_BASE}/matrix/rooms/${encodeURIComponent(roomId)}/invite`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
    
    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(data.message || 'Failed to invite user');
    }
  }, []);

  // Rename room using Matrix SDK directly
  const renameRoom = useCallback(async (roomId: string, newName: string) => {
    if (!clientRef.current) throw new Error('Matrix client not initialized');

    await clientRef.current.setRoomName(roomId, newName);

    // Update local state immediately
    setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, name: newName } : r));
    setAllRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, name: newName } : r));
    if (currentRoom?.roomId === roomId) {
      setCurrentRoom(prev => prev ? { ...prev, name: newName } : null);
    }
  }, [currentRoom]);
  // Fetch all rooms (public + joined)
  const fetchAllRooms = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      const response = await fetchApi(`${API_BASE}/matrix/rooms`);
      const data = await response.json();
      if (data.code === 0 && data.data?.rooms) {
        const apiRooms: MatrixRoom[] = data.data.rooms.map((r: any) => ({
          roomId: r.room_id,
          name: r.name || r.room_id,
          topic: r.topic || undefined,
          avatarUrl: r.avatar_url || undefined,
          members: [],
          unreadCount: 0,
          messageCount: r.message_count || 0,
          joined: r.joined || false,
          isOfficial: r.is_official || false,
        }));
        setAllRooms(apiRooms);
      }
    } catch (err) {
      console.error('[Matrix] Failed to fetch all rooms:', err);
    }
  }, [accessToken]);

  // Refresh workers list - combines API data with real-time status
  const refreshWorkers = useCallback(async () => {
    const response = await fetchApi(`${API_BASE}/matrix/workers`);
    const data = await response.json();
    if (data.code === 0 && data.data?.workers) {
      // Map API snake_case fields to frontend camelCase
      const apiWorkers: MatrixWorker[] = data.data.workers.map((w: any) => ({
        workerId: w.worker_id,
        userId: w.user_id,
        name: w.name,
        isOnline: workerStatusRef.current.get(w.worker_id) ?? w.is_online ?? false,
        rooms: w.rooms,
      }));
      setWorkers(apiWorkers);
    }
  }, []);

  // Refresh users list
  const refreshUsers = useCallback(async () => {
    try {
      const resp = await fetchApi(`${API_BASE}/matrix/users`);
      const data = await resp.json();
      if (data.code === 0 && data.data?.users) {
        // Map API snake_case to frontend camelCase
        setUsers(data.data.users.map((u: any) => ({
          userId: u.user_id,
          name: u.name,
          displayName: u.display_name,
          isOnline: u.is_online,
          lastActivity: u.last_activity,
        })));
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  }, []);

  // Join a worker to a room
  const joinWorkerToRoom = useCallback(async (workerId: string, roomId: string) => {
    const response = await fetchApi(`${API_BASE}/matrix/workers/${workerId}/join`, {
      method: 'POST',
      body: JSON.stringify({ room_id: roomId }),
    });
    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(data.message || 'Failed to join worker to room');
    }
    // Refresh workers after joining
    await refreshWorkers();
  }, [refreshWorkers]);

  // Scan for room invitations
  const scanInvitations = useCallback((client: matrixSdk.MatrixClient) => {
    const allRooms = client.getRooms();
    const invitationList: MatrixInvitation[] = [];
    
    allRooms.forEach(room => {
      const membership = room.getMyMembership();
      if (membership === 'invite') {
        const roomId = room.roomId;
        const roomName = room.name || room.roomId;
        const inviterEvent = room.currentState.getStateEvents('m.room.member', client.getUserId() || '');
        const inviterId = inviterEvent?.getSender() || '';
        const inviter = room.getMember(inviterId);
        
        invitationList.push({
          roomId,
          roomName,
          inviterId,
          inviterName: inviter?.name || inviterId,
          timestamp: Date.now(),
        });
      }
    });
    
    setInvitations(invitationList);
    setUnreadNotificationCount(prev => invitationList.length + prev);
  }, []);
  
  // Accept invitation to join a room
  const acceptInvitation = useCallback(async (roomId: string) => {
    if (!clientRef.current) throw new Error('Matrix client not initialized');
    await clientRef.current.joinRoom(roomId);
    setInvitations(prev => prev.filter(inv => inv.roomId !== roomId));
    setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    // Refresh rooms after accepting
    if (fetchAllRooms) await fetchAllRooms();
  }, [fetchAllRooms]);
  
  // Reject invitation (leave room)
  const rejectInvitation = useCallback(async (roomId: string) => {
    if (!clientRef.current) throw new Error('Matrix client not initialized');
    await clientRef.current.leave(roomId);
    setInvitations(prev => prev.filter(inv => inv.roomId !== roomId));
    setUnreadNotificationCount(prev => Math.max(0, prev - 1));
  }, []);
  
  // Mark notification as read
  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
  }, []);
  
  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setInvitations([]);
    setUnreadNotificationCount(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.stopClient();
      }
    };
  }, []);

  // Fetch all rooms when initialized
  useEffect(() => {
    if (accessToken && isInitialized) {
      fetchAllRooms();
    }
  }, [accessToken, isInitialized, fetchAllRooms]);


  const value: MatrixContextType = {
    client,
    isInitialized,
    isLoading,
    error,
    matrixUserId,
    accessToken,
    homeserverUrl,
    rooms,
    allRooms,
    currentRoom,
    messages,
    initialize,
    disconnect,
    selectRoom,
    sendMessage,
    createRoom,
    joinRoom,
    leaveRoom,
    inviteUser,
    renameRoom,
    refreshRooms,
    workers,
    refreshWorkers,
    users,
    refreshUsers,
    joinWorkerToRoom,
    sendMessageToRoom,
    // User online state
    userOnline,
    lastActivityTime,
    updateActivity,
    // Notifications state
    invitations,
    notifications,
    unreadNotificationCount,
    acceptInvitation,
    rejectInvitation,
    markNotificationRead,
    clearAllNotifications,
  };

  return <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>;
}

export function useMatrix(): MatrixContextType {
  const context = useContext(MatrixContext);
  if (context === undefined) {
    throw new Error('useMatrix must be used within a MatrixProvider');
  }
  return context;
}
