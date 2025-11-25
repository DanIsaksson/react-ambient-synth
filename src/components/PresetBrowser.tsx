/**
 * PresetBrowser - UI for browsing and loading presets.
 * 
 * Features:
 * - Factory preset grid
 * - User preset list
 * - Category filtering
 * - Save/Load/Share actions
 * 
 * @module components/PresetBrowser
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FACTORY_PRESETS, presetManager, type PatchData, type PatchCategory } from '../presets';
import { useNodeGraphStore } from '../store/nodeGraphStore';

// ===========================================
// TYPES
// ===========================================

interface PresetBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPreset: (patch: PatchData) => void;
}

// ===========================================
// CATEGORY CONFIG
// ===========================================

const CATEGORIES: { id: PatchCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🎵' },
  { id: 'sleep', label: 'Sleep', icon: '🌙' },
  { id: 'focus', label: 'Focus', icon: '🎯' },
  { id: 'ambient', label: 'Ambient', icon: '🌊' },
  { id: 'scifi', label: 'Sci-Fi', icon: '🚀' },
  { id: 'nature', label: 'Nature', icon: '🌲' },
  { id: 'experimental', label: 'Experimental', icon: '🔬' },
  { id: 'user', label: 'My Presets', icon: '💾' },
];

// ===========================================
// PRESET CARD
// ===========================================

const PresetCard: React.FC<{
  preset: PatchData;
  onLoad: () => void;
  onShare?: () => void;
  isUser?: boolean;
  onDelete?: () => void;
}> = ({ preset, onLoad, onShare, isUser, onDelete }) => {
  const [hover, setHover] = useState(false);

  const categoryColors: Record<string, string> = {
    sleep: '139, 92, 246',    // Purple
    focus: '249, 115, 22',    // Orange
    ambient: '6, 182, 212',   // Cyan
    scifi: '236, 72, 153',    // Pink
    nature: '16, 185, 129',   // Green
    experimental: '245, 158, 11', // Amber
    user: '99, 102, 241',     // Indigo
  };

  const color = categoryColors[preset.meta.category || 'user'] || '156, 163, 175';

  return (
    <motion.div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative rounded-xl overflow-hidden cursor-pointer"
      style={{
        background: `linear-gradient(135deg, rgba(${color}, 0.1) 0%, rgba(${color}, 0.05) 100%)`,
        border: `1px solid rgba(${color}, ${hover ? 0.5 : 0.2})`,
        boxShadow: hover ? `0 0 20px rgba(${color}, 0.2)` : 'none',
      }}
      onClick={onLoad}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-white font-medium text-sm">{preset.meta.name}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
            {preset.meta.category}
          </span>
        </div>

        {/* Description */}
        {preset.meta.description && (
          <p className="text-gray-500 text-xs mb-3 line-clamp-2">
            {preset.meta.description}
          </p>
        )}

        {/* Tags */}
        {preset.meta.tags && preset.meta.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {preset.meta.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-[10px] text-gray-600">
          <span>{preset.graph.nodes.length} nodes</span>
          <span>by {preset.meta.author}</span>
        </div>

        {/* Actions (on hover) */}
        <AnimatePresence>
          {hover && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex gap-2"
            >
              <button
                onClick={(e) => { e.stopPropagation(); onLoad(); }}
                className="flex-1 py-1.5 rounded bg-white/10 text-white text-xs hover:bg-white/20 transition"
              >
                Load
              </button>
              {onShare && (
                <button
                  onClick={(e) => { e.stopPropagation(); onShare(); }}
                  className="px-3 py-1.5 rounded bg-white/10 text-white text-xs hover:bg-white/20 transition"
                >
                  Share
                </button>
              )}
              {isUser && onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="px-3 py-1.5 rounded bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition"
                >
                  Delete
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ===========================================
// MAIN COMPONENT
// ===========================================

export const PresetBrowser: React.FC<PresetBrowserProps> = ({
  isOpen,
  onClose,
  onLoadPreset,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<PatchCategory | 'all'>('all');
  const [userPresets, setUserPresets] = useState<PatchData[]>(() => presetManager.getUserPresets());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const { nodes, edges } = useNodeGraphStore();

  // Filter presets by category
  const filteredPresets = selectedCategory === 'all'
    ? FACTORY_PRESETS
    : selectedCategory === 'user'
      ? userPresets
      : FACTORY_PRESETS.filter(p => p.meta.category === selectedCategory);

  // Handle load
  const handleLoad = useCallback((preset: PatchData) => {
    onLoadPreset(preset);
    onClose();
  }, [onLoadPreset, onClose]);

  // Handle share
  const handleShare = useCallback((preset: PatchData) => {
    const url = presetManager.generateShareURL(preset);
    navigator.clipboard.writeText(url);
    // TODO: Toast notification
    console.log('[PresetBrowser] URL copied to clipboard');
  }, []);

  // Handle save current
  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;

    const patch = presetManager.createPatch(
      nodes,
      edges,
      {}, // Audio params would come from audio store
      {},
      undefined,
      { name: saveName.trim(), category: 'user' }
    );

    presetManager.saveUserPreset(patch);
    setUserPresets(presetManager.getUserPresets());
    setShowSaveDialog(false);
    setSaveName('');
  }, [saveName, nodes, edges]);

  // Handle delete user preset
  const handleDelete = useCallback((name: string) => {
    presetManager.deleteUserPreset(name);
    setUserPresets(presetManager.getUserPresets());
  }, []);

  // Handle import
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const patch = await presetManager.importFromFile(file);
    if (patch) {
      presetManager.saveUserPreset(patch);
      setUserPresets(presetManager.getUserPresets());
    }
  }, []);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-[800px] max-h-[80vh] bg-gray-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white text-lg font-medium">Preset Library</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSaveDialog(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm hover:bg-emerald-500/30 transition"
            >
              Save Current
            </button>
            <label className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 text-sm hover:bg-white/20 transition cursor-pointer">
              Import
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="px-6 py-3 border-b border-white/5 flex gap-2 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <span className="mr-1.5">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Preset Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {filteredPresets.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-4xl mb-3">📂</p>
              <p>No presets in this category</p>
              {selectedCategory === 'user' && (
                <p className="text-sm mt-2">Save your current patch to get started!</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filteredPresets.map((preset, i) => (
                <PresetCard
                  key={preset.meta.name + i}
                  preset={preset}
                  onLoad={() => handleLoad(preset)}
                  onShare={() => handleShare(preset)}
                  isUser={selectedCategory === 'user'}
                  onDelete={selectedCategory === 'user' ? () => handleDelete(preset.meta.name) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Save Dialog */}
        <AnimatePresence>
          {showSaveDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex items-center justify-center"
              onClick={() => setShowSaveDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-gray-800 rounded-xl p-6 w-80"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-white font-medium mb-4">Save Preset</h3>
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="Preset name..."
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none mb-4"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="flex-1 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim()}
                    className="flex-1 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default PresetBrowser;
