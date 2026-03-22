'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function GalleryLightbox({ images, initialIndex, isOpen, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
    const touchStartX = useRef(null);
    const touchEndX = useRef(null);
    const MIN_SWIPE_DISTANCE = 50;

    // Reset index when opened with a new image
    useEffect(() => {
        if (isOpen) setCurrentIndex(initialIndex || 0);
    }, [isOpen, initialIndex]);

    const handlePrev = useCallback((e) => {
        if (e) e.stopPropagation();
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    }, [images?.length]);

    const handleNext = useCallback((e) => {
        if (e) e.stopPropagation();
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    }, [images?.length]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handlePrev, handleNext, onClose]);

    // Prevent scrolling on body when lightbox is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isOpen]);

    if (!isOpen || !images || images.length === 0) return null;

    // ── Touch/Swipe handlers for mobile ──────────────────
    const onTouchStart = (e) => {
        touchEndX.current = null;
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        const distance = touchStartX.current - touchEndX.current;
        if (Math.abs(distance) >= MIN_SWIPE_DISTANCE) {
            if (distance > 0) {
                handleNext(); // Swipe left → next
            } else {
                handlePrev(); // Swipe right → prev
            }
        }
        touchStartX.current = null;
        touchEndX.current = null;
    };

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <button 
                className="absolute top-4 right-4 md:top-6 md:right-6 text-white/70 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
            >
                <X className="w-6 h-6" />
            </button>

            {images.length > 1 && (
                <>
                    <button 
                        className="absolute left-4 md:left-8 text-white/70 hover:text-white p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                        onClick={handlePrev}
                    >
                        <ChevronLeft className="w-8 h-8" />
                    </button>
                    
                    <button 
                        className="absolute right-4 md:right-8 text-white/70 hover:text-white p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                        onClick={handleNext}
                    >
                        <ChevronRight className="w-8 h-8" />
                    </button>
                    
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white/80 font-medium tracking-widest text-sm bg-black/50 px-4 py-1.5 rounded-full z-10">
                        {currentIndex + 1} / {images.length}
                    </div>
                </>
            )}

            <div 
                className="relative w-full h-full md:w-3/4 md:h-3/4 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                    src={images[currentIndex]} 
                    alt={`Gallery preview ${currentIndex + 1}`}
                    className="max-w-full max-h-full object-contain select-none animate-in zoom-in-95 duration-200"
                    draggable={false}
                />
            </div>
        </div>
    );
}
