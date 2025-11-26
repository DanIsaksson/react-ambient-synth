import React from 'react';
import { X, Keyboard } from 'lucide-react';

// ============================================================================
// KEYBOARD SHORTCUTS MODAL
// Displays all available keyboard shortcuts in a help modal
// ============================================================================

interface ShortcutCategory {
    title: string;
    shortcuts: {
        keys: string[];
        description: string;
    }[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
    {
        title: 'Playback',
        shortcuts: [
            { keys: ['Space'], description: 'Play / Pause' },
            { keys: ['R'], description: 'Toggle Recording' },
        ],
    },
    {
        title: 'Graph Editing',
        shortcuts: [
            { keys: ['Delete', 'Backspace'], description: 'Delete selected nodes' },
            { keys: ['Escape'], description: 'Deselect all' },
            { keys: ['Tab'], description: 'Focus next node' },
            { keys: ['Shift', 'Tab'], description: 'Focus previous node' },
        ],
    },
    {
        title: 'File Operations',
        shortcuts: [
            { keys: ['Ctrl/⌘', 'S'], description: 'Save preset' },
            { keys: ['Ctrl/⌘', 'O'], description: 'Open preset' },
        ],
    },
    {
        title: 'View',
        shortcuts: [
            { keys: ['V'], description: 'Toggle visualizer' },
            { keys: ['?'], description: 'Show this help' },
        ],
    },
];

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const KeyBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5
                    bg-gray-800 border border-gray-700 rounded text-xs font-mono
                    text-gray-300 shadow-sm">
        {children}
    </kbd>
);

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
    isOpen,
    onClose,
}) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            {/* Modal */}
            <div 
                className="relative w-full max-w-lg bg-gray-900/95 border border-gray-800 
                          rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <Keyboard className="w-5 h-5 text-green-400" />
                        <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 
                                 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-6">
                        {SHORTCUT_CATEGORIES.map((category) => (
                            <div key={category.title}>
                                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                    {category.title}
                                </h3>
                                <div className="space-y-2">
                                    {category.shortcuts.map((shortcut, index) => (
                                        <div 
                                            key={index}
                                            className="flex items-center justify-between py-1.5"
                                        >
                                            <span className="text-sm text-gray-300">
                                                {shortcut.description}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                {shortcut.keys.map((key, keyIndex) => (
                                                    <React.Fragment key={keyIndex}>
                                                        {keyIndex > 0 && (
                                                            <span className="text-gray-600 text-xs">+</span>
                                                        )}
                                                        <KeyBadge>{key}</KeyBadge>
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-900/50">
                    <p className="text-xs text-gray-500 text-center">
                        Press <KeyBadge>Esc</KeyBadge> or click outside to close
                    </p>
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcutsModal;
