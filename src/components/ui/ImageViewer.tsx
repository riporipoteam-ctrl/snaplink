import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Download, Share, RotateCw, Repeat2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageViewerProps {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
  onRepost?: () => void;
}

export function ImageViewer({ src, alt = 'Image', isOpen, onClose, onRepost }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastTouchDistance = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, src]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 5));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.25));
      if (e.key === '0') { setZoom(1); setPosition({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Non-passive wheel handler for zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isOpen) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.min(Math.max(z + (e.deltaY > 0 ? -0.1 : 0.1), 0.25), 5));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    }
  };

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y };
    }
  }, [zoom, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const scale = distance / lastTouchDistance.current;
      setZoom(z => Math.min(Math.max(z * scale, 0.25), 5));
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && isDragging) {
      setPosition({ x: e.touches[0].clientX - dragStart.current.x, y: e.touches[0].clientY - dragStart.current.y });
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastTouchDistance.current = null;
  }, []);

  const handleMouseUp = () => setIsDragging(false);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = alt || 'image';
    a.target = '_blank';
    a.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: alt, url: src });
      } catch {} 
    } else {
      navigator.clipboard.writeText(src);
      alert('Image link copied!');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 text-white">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
          <div className="flex items-center space-x-2">
            <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Zoom Out">
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="text-sm font-mono bg-white/10 px-3 py-1 rounded-full min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(z + 0.25, 5))} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Zoom In">
              <ZoomIn className="h-5 w-5" />
            </button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button onClick={() => setRotation(r => r + 90)} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Rotate">
              <RotateCw className="h-5 w-5" />
            </button>
            <button onClick={handleDownload} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Download">
              <Download className="h-5 w-5" />
            </button>
            <button onClick={handleShare} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Share">
              <Share className="h-5 w-5" />
            </button>
            {onRepost && (
              <button onClick={onRepost} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Repost">
                <Repeat2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Image */}
        <div 
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={() => {
            if (zoom === 1) setZoom(2);
            else { setZoom(1); setPosition({ x: 0, y: 0 }); }
          }}
        >
          <motion.img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain pointer-events-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            draggable="false"
          />
        </div>

        <div className="text-center pb-4 text-gray-400 text-xs">
          Scroll to zoom · Double-click to fit · Drag to pan · Pinch to zoom on mobile
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
