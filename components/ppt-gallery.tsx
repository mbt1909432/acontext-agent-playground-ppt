"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Bump this value to bust browser/CDN/Next Image caches when slide binaries change.
const SLIDES_VERSION = "2026-01-20";

const SLIDES = [
  { id: 1, src: `/fonts/slides/slide1.jpg?v=${SLIDES_VERSION}`, alt: "Slide 1" },
  { id: 2, src: `/fonts/slides/slide2.jpg?v=${SLIDES_VERSION}`, alt: "Slide 2" },
  { id: 3, src: `/fonts/slides/slide3.jpg?v=${SLIDES_VERSION}`, alt: "Slide 3" },
  { id: 4, src: `/fonts/slides/slide4.jpg?v=${SLIDES_VERSION}`, alt: "Slide 4" },
  { id: 5, src: `/fonts/slides/slide5.jpg?v=${SLIDES_VERSION}`, alt: "Slide 5" },
  { id: 6, src: `/fonts/slides/slide6.jpg?v=${SLIDES_VERSION}`, alt: "Slide 6" },
];

export function PPTGallery() {
  const [selectedSlide, setSelectedSlide] = useState<number | null>(null);

  // Handle keyboard navigation
  useEffect(() => {
    if (selectedSlide === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedSlide(null);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedSlide((prev) => {
          if (prev === null) return null;
          return prev === 1 ? SLIDES.length : prev - 1;
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedSlide((prev) => {
          if (prev === null) return null;
          return prev === SLIDES.length ? 1 : prev + 1;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSlide]);

  const currentSlide = selectedSlide ? SLIDES.find((s) => s.id === selectedSlide) : null;

  return (
    <>
      <Card className="backdrop-blur-sm bg-card/80 border-primary/20 shadow-xl animate-slide-up dark:bg-neutral-900/80 dark:border-neutral-800 dark:shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl sm:text-2xl">PPT Gallery</CardTitle>
            <Badge variant="secondary">{SLIDES.length} Slides</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Horizontal scrollable gallery */}
          <div className="relative">
            <div className="overflow-x-auto pb-4 scrollbar-hide">
              <div className="flex gap-4 min-w-max">
                {SLIDES.map((slide) => (
                  <div
                    key={slide.id}
                    className="relative flex-shrink-0 w-[280px] sm:w-[320px] lg:w-[400px] group cursor-pointer"
                    onClick={() => setSelectedSlide(slide.id)}
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary/20 bg-muted/30 transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-lg group-hover:scale-[1.02]">
                      <Image
                        src={slide.src}
                        alt={slide.alt}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 280px, (max-width: 1024px) 320px, 400px"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
                          Click to view full size
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <span className="text-sm text-muted-foreground font-medium">
                        {slide.alt}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full-screen modal */}
      {selectedSlide !== null && currentSlide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
          onClick={() => setSelectedSlide(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={() => setSelectedSlide(null)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Previous button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 z-10 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSlide((prev) => {
                  if (prev === null) return null;
                  return prev === 1 ? SLIDES.length : prev - 1;
                });
              }}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>

            {/* Next button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 z-10 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSlide((prev) => {
                  if (prev === null) return null;
                  return prev === SLIDES.length ? 1 : prev + 1;
                });
              }}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>

            {/* Image */}
            <div
              className="relative max-w-[95%] max-h-[95%] w-full h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={currentSlide.src}
                alt={currentSlide.alt}
                fill
                className="object-contain"
                sizes="95vw"
                priority
              />
            </div>

            {/* Slide counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
              {selectedSlide} / {SLIDES.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

