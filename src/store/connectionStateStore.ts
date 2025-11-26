/**
 * Connection State Store - Tracks active connection drag state for visual feedback.
 * 
 * When a user drags from a handle, this store tracks:
 * - The source node type and handle ID
 * - Whether a connection drag is in progress
 * 
 * Other components can subscribe to this to show compatibility indicators.
 * 
 * @module store/connectionStateStore
 */

import { create } from 'zustand';

interface ConnectionState {
    /** Whether a connection drag is currently in progress */
    isConnecting: boolean;
    
    /** Source node information (when dragging) */
    sourceNodeId: string | null;
    sourceNodeType: string | null;
    sourceHandleId: string | null;
    sourceHandleType: 'source' | 'target' | null;
    
    /** Actions */
    startConnection: (
        nodeId: string,
        nodeType: string,
        handleId: string,
        handleType: 'source' | 'target'
    ) => void;
    endConnection: () => void;
}

export const useConnectionStateStore = create<ConnectionState>((set) => ({
    isConnecting: false,
    sourceNodeId: null,
    sourceNodeType: null,
    sourceHandleId: null,
    sourceHandleType: null,
    
    startConnection: (nodeId, nodeType, handleId, handleType) => set({
        isConnecting: true,
        sourceNodeId: nodeId,
        sourceNodeType: nodeType,
        sourceHandleId: handleId,
        sourceHandleType: handleType,
    }),
    
    endConnection: () => set({
        isConnecting: false,
        sourceNodeId: null,
        sourceNodeType: null,
        sourceHandleId: null,
        sourceHandleType: null,
    }),
}));
