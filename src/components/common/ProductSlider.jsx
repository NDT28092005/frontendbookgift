import React, { useRef, useEffect, useState } from 'react';

const ProductSlider = ({ items = [], renderItem, title, viewAllLink, autoPlayInterval = 3000 }) => {
    const trackRef = useRef(null);
    const intervalRef = useRef(null);
    const [isPaused, setIsPaused] = useState(false);
    
    const scrollBy = (dir) => {
        const el = trackRef.current;
        if (!el) return;
        const cardWidth = el.querySelector('.product-slider__item')?.offsetWidth || 300;
        const gap = 20;
        const scrollAmount = (cardWidth + gap) * 2; // Scroll 2 cards at a time
        el.scrollBy({ left: dir * scrollAmount, behavior: 'smooth' });
    };

    // Auto-play functionality
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        if (items.length > 4 && !isPaused) {
            intervalRef.current = setInterval(() => {
                const el = trackRef.current;
                if (!el) return;
                
                const cardWidth = el.querySelector('.product-slider__item')?.offsetWidth || 300;
                const gap = 20;
                const scrollAmount = (cardWidth + gap) * 2;
                const maxScroll = el.scrollWidth - el.clientWidth;
                
                if (el.scrollLeft >= maxScroll - 10) {
                    // Reset to start
                    el.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                }
            }, autoPlayInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [items.length, autoPlayInterval, isPaused]);

    const handleMouseEnter = () => setIsPaused(true);
    const handleMouseLeave = () => setIsPaused(false);

    if (!items || items.length === 0) {
        return null;
    }

    return (
        <div className="product-slider">
            {title && (
                <div className="product-slider__header">
                    <h2 className="product-slider__title">{title}</h2>
                    {viewAllLink && (
                        <button 
                            className="product-slider__view-all" 
                            onClick={viewAllLink}
                        >
                            View All
                        </button>
                    )}
                </div>
            )}
            <div 
                className="product-slider__container"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <button 
                    className="product-slider__nav product-slider__nav--prev" 
                    onClick={() => scrollBy(-1)} 
                    aria-label="Previous"
                >
                    ‹
                </button>
                <div className="product-slider__track" ref={trackRef}>
                    {items.map((item, index) => (
                        <div key={item.id || index} className="product-slider__item">
                            {renderItem ? renderItem(item) : null}
                        </div>
                    ))}
                </div>
                <button 
                    className="product-slider__nav product-slider__nav--next" 
                    onClick={() => scrollBy(1)} 
                    aria-label="Next"
                >
                    ›
                </button>
            </div>
        </div>
    );
};

export default ProductSlider;

