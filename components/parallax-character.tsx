"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useCharacter } from "@/contexts/character-context";

export function ParallaxCharacter() {
  const { character } = useCharacter();
  const [scrollY, setScrollY] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(character.avatarPath);
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Handle character switching animation
  useEffect(() => {
    if (character.avatarPath !== currentSrc) {
      // Save old avatar
      setPrevSrc(currentSrc);
      // Update to new avatar, initially transparent
      setCurrentSrc(character.avatarPath);
      setShowNew(false);
      // Use double requestAnimationFrame to ensure DOM update before triggering animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShowNew(true);
        });
      });
      // Clean up after animation completes
      const timer = setTimeout(() => {
        setPrevSrc(null);
        setShowNew(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [character.avatarPath, currentSrc]);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY || window.pageYOffset || document.documentElement.scrollTop);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Calculate parallax offset (character moves opposite to scroll direction)
  // Negative value: character moves up when scrolling down, moves down when scrolling up
  const parallaxOffsetY = scrollY * -0.05; // Adjust this value to control movement speed (-0.02 = 2% of scroll speed, opposite direction)
  // Calculate horizontal offset: character moves right when scrolling down to avoid being blocked by PPT Gallery
  const parallaxOffsetX = scrollY * 0.3; // Positive value: moves right when scrolling down (15% of scroll speed)

  const hasPrev = prevSrc !== null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Adjust vertical position: modify the following parameters to control vertical positioning
          Vertical alignment: items-end (bottom) | items-center (center) | items-start (top)
          Bottom spacing: lg:pb-0 (bottom aligned) | lg:pb-10 (move up) | lg:pb-20 (more down)
          Top spacing: lg:pt-20 (position from top)
          Horizontal position: lg:pl-[800px] (adjust left margin to place character on the right side of text) */}
      <div className="absolute inset-0 flex items-end justify-center lg:justify-start lg:items-start lg:pl-[800px] lg:pt-[00px]">
        <div 
          className="relative w-full max-w-[420px] lg:max-w-[360px] xl:max-w-[580px] opacity-100 dark:opacity-80"
          style={{
            transform: `translate(${parallaxOffsetX}px, ${parallaxOffsetY}px)`,
            willChange: 'transform',
          }}
        >
          {/* Old avatar - fade out */}
          {hasPrev && (
            <div className="absolute inset-0">
              <Image
                key={`prev-${prevSrc}`}
                src={prevSrc!}
                alt={character.name}
                width={800}
                height={800}
                className="w-full h-auto object-contain rounded-3xl shadow-[0_40px_120px_rgba(0,0,0,0.0)] transition-all duration-[400ms] ease-in-out"
                style={{
                  opacity: 0,
                  transform: "scale(0.95)",
                }}
                priority
              />
            </div>
          )}
          {/* New avatar - fade in */}
          <Image
            key={currentSrc}
            src={currentSrc}
            alt={character.name}
            width={800}
            height={800}
            className="w-full h-auto object-contain rounded-3xl shadow-[0_40px_120px_rgba(0,0,0,0.0)] transition-all duration-[400ms] ease-in-out"
            style={{
              opacity: hasPrev ? (showNew ? 1 : 0) : 1,
              transform: hasPrev ? (showNew ? "scale(1)" : "scale(0.95)") : "scale(1)",
            }}
            priority
          />
        </div>
      </div>
      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent lg:bg-gradient-to-l lg:from-transparent lg:via-background/60 lg:to-background dark:from-[#0b0b0f] dark:via-[#0b0b0f]/80 dark:to-transparent" />
    </div>
  );
}

