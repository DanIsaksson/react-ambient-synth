import { useEffect, useCallback, useRef } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { useNodeGraphStore } from '../store/nodeGraphStore';
import { useRecordingStore } from '../store/useRecordingStore';

// ============================================================================
// KEYBOARD SHORTCUTS HOOK
// Global keyboard shortcuts for the application
// ============================================================================

export interface KeyboardShortcutConfig {
    /** Current view mode - shortcuts behave differently in graph vs classic */
    viewMode: 'classic' | 'graph';
    /** Callback when user presses save shortcut */
    onSave?: () => void;
    /** Callback when user presses open/load shortcut */
    onOpen?: () => void;
    /** Callback when user wants to toggle visualizer */
    onToggleVisualizer?: () => void;
    /** Callback when user wants to show help/shortcuts modal */
    onShowHelp?: () => void;
}

// Keyboard shortcut definitions
export const KEYBOARD_SHORTCUTS = {
    // Playback
    'Space': { action: 'toggle-playback', description: 'Play / Pause audio' },
    
    // Recording
    'KeyR': { action: 'toggle-recording', description: 'Start / Stop recording', requiresCtrl: false },
    
    // Graph editing
    'Delete': { action: 'delete-selected', description: 'Delete selected nodes' },
    'Backspace': { action: 'delete-selected', description: 'Delete selected nodes' },
    'Escape': { action: 'deselect-all', description: 'Deselect all nodes' },
    
    // Undo/Redo (placeholder - needs history implementation)
    'KeyZ': { action: 'undo', description: 'Undo', requiresCtrl: true },
    'KeyZ+Shift': { action: 'redo', description: 'Redo', requiresCtrl: true, requiresShift: true },
    'KeyY': { action: 'redo', description: 'Redo', requiresCtrl: true },
    
    // File operations
    'KeyS': { action: 'save', description: 'Save preset', requiresCtrl: true },
    'KeyO': { action: 'open', description: 'Open preset', requiresCtrl: true },
    
    // Navigation
    'Tab': { action: 'focus-next', description: 'Focus next node' },
    'Tab+Shift': { action: 'focus-prev', description: 'Focus previous node', requiresShift: true },
    
    // Visualization
    'KeyV': { action: 'toggle-visualizer', description: 'Toggle visualizer' },
    
    // Help
    'Slash': { action: 'show-help', description: 'Show keyboard shortcuts', requiresShift: true },
} as const;

export const useKeyboardShortcuts = (config: KeyboardShortcutConfig) => {
    const { viewMode, onSave, onOpen, onToggleVisualizer, onShowHelp } = config;
    
    // Store hooks
    const toggleGraph = useAudioStore(s => s.toggleGraph);
    const toggleClassic = useAudioStore(s => s.toggleClassic);
    const isGraphPlaying = useAudioStore(s => s.isGraphPlaying);
    const isClassicPlaying = useAudioStore(s => s.isClassicPlaying);
    
    const nodes = useNodeGraphStore(s => s.nodes);
    const deleteNode = useNodeGraphStore(s => s.deleteNode);
    const onNodesChange = useNodeGraphStore(s => s.onNodesChange);
    
    const isRecording = useRecordingStore(s => s.isRecording);
    const startRecording = useRecordingStore(s => s.startRecording);
    const stopRecording = useRecordingStore(s => s.stopRecording);
    
    // Track focused node index for Tab navigation
    const focusedNodeIndex = useRef(0);
    
    // Get selected nodes
    const getSelectedNodes = useCallback(() => {
        return nodes.filter(n => n.selected);
    }, [nodes]);
    
    // Delete selected nodes
    const deleteSelectedNodes = useCallback(() => {
        const selected = getSelectedNodes();
        if (selected.length === 0) return;
        
        // Don't delete the output node
        const toDelete = selected.filter(n => n.type !== 'output');
        toDelete.forEach(n => deleteNode(n.id));
        
        console.log(`[Shortcuts] Deleted ${toDelete.length} node(s)`);
    }, [getSelectedNodes, deleteNode]);
    
    // Deselect all nodes
    const deselectAll = useCallback(() => {
        const changes = nodes
            .filter(n => n.selected)
            .map(n => ({ type: 'select' as const, id: n.id, selected: false }));
        
        if (changes.length > 0) {
            onNodesChange(changes);
            console.log('[Shortcuts] Deselected all nodes');
        }
    }, [nodes, onNodesChange]);
    
    // Focus next/previous node
    const focusNode = useCallback((direction: 'next' | 'prev') => {
        if (nodes.length === 0) return;
        
        if (direction === 'next') {
            focusedNodeIndex.current = (focusedNodeIndex.current + 1) % nodes.length;
        } else {
            focusedNodeIndex.current = (focusedNodeIndex.current - 1 + nodes.length) % nodes.length;
        }
        
        const targetNode = nodes[focusedNodeIndex.current];
        
        // Deselect all, then select the focused node
        const changes = [
            ...nodes.filter(n => n.selected).map(n => ({ 
                type: 'select' as const, 
                id: n.id, 
                selected: false 
            })),
            { type: 'select' as const, id: targetNode.id, selected: true },
        ];
        
        onNodesChange(changes);
        console.log(`[Shortcuts] Focused node: ${targetNode.data.label || targetNode.id}`);
    }, [nodes, onNodesChange]);
    
    // Toggle playback based on current mode
    const togglePlayback = useCallback(() => {
        if (viewMode === 'graph') {
            toggleGraph();
            console.log(`[Shortcuts] Graph playback: ${!isGraphPlaying ? 'started' : 'stopped'}`);
        } else {
            toggleClassic();
            console.log(`[Shortcuts] Classic playback: ${!isClassicPlaying ? 'started' : 'stopped'}`);
        }
    }, [viewMode, toggleGraph, toggleClassic, isGraphPlaying, isClassicPlaying]);
    
    // Toggle recording
    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
            console.log('[Shortcuts] Recording stopped');
        } else {
            startRecording();
            console.log('[Shortcuts] Recording started');
        }
    }, [isRecording, startRecording, stopRecording]);
    
    // Main keyboard event handler
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Don't trigger shortcuts when typing in inputs
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }
        
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const ctrlKey = isMac ? event.metaKey : event.ctrlKey;
        const shiftKey = event.shiftKey;
        
        // Handle specific shortcuts
        switch (event.code) {
            case 'Space':
                event.preventDefault();
                togglePlayback();
                break;
                
            case 'KeyR':
                if (!ctrlKey) {
                    event.preventDefault();
                    toggleRecording();
                }
                break;
                
            case 'Delete':
            case 'Backspace':
                if (viewMode === 'graph') {
                    event.preventDefault();
                    deleteSelectedNodes();
                }
                break;
                
            case 'Escape':
                if (viewMode === 'graph') {
                    deselectAll();
                }
                break;
                
            case 'KeyZ':
                if (ctrlKey) {
                    event.preventDefault();
                    if (shiftKey) {
                        console.log('[Shortcuts] Redo (not yet implemented)');
                    } else {
                        console.log('[Shortcuts] Undo (not yet implemented)');
                    }
                }
                break;
                
            case 'KeyY':
                if (ctrlKey) {
                    event.preventDefault();
                    console.log('[Shortcuts] Redo (not yet implemented)');
                }
                break;
                
            case 'KeyS':
                if (ctrlKey) {
                    event.preventDefault();
                    if (onSave) {
                        onSave();
                        console.log('[Shortcuts] Save triggered');
                    }
                }
                break;
                
            case 'KeyO':
                if (ctrlKey) {
                    event.preventDefault();
                    if (onOpen) {
                        onOpen();
                        console.log('[Shortcuts] Open triggered');
                    }
                }
                break;
                
            case 'Tab':
                if (viewMode === 'graph') {
                    event.preventDefault();
                    focusNode(shiftKey ? 'prev' : 'next');
                }
                break;
                
            case 'KeyV':
                if (!ctrlKey) {
                    event.preventDefault();
                    if (onToggleVisualizer) {
                        onToggleVisualizer();
                    }
                }
                break;
                
            case 'Slash':
                if (shiftKey) { // ? key
                    event.preventDefault();
                    if (onShowHelp) {
                        onShowHelp();
                    }
                }
                break;
        }
    }, [
        viewMode,
        togglePlayback,
        toggleRecording,
        deleteSelectedNodes,
        deselectAll,
        focusNode,
        onSave,
        onOpen,
        onToggleVisualizer,
        onShowHelp,
    ]);
    
    // Register global keyboard listener
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
    
    return {
        shortcuts: KEYBOARD_SHORTCUTS,
    };
};

export default useKeyboardShortcuts;
