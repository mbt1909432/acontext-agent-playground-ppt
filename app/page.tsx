"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";

import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ParallaxCharacter } from "@/components/parallax-character";
import { InteractiveDemoGallery } from "@/components/interactive-demo-gallery";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { CharacterSwitcher } from "@/components/character-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { hasEnvVars } from "@/lib/utils";
import { useCharacter } from "@/contexts/character-context";

export default function Home() {
  const { character } = useCharacter();
  const [currentAvatarSrc, setCurrentAvatarSrc] = useState(character.avatarPath);
  const [prevAvatarSrc, setPrevAvatarSrc] = useState<string | null>(null);
  const [showNewAvatar, setShowNewAvatar] = useState(false);
  const [showMoreCharacterInfo, setShowMoreCharacterInfo] = useState(false);
  const [isCharacterCardHovered, setIsCharacterCardHovered] = useState(false);
  const [isSmScreen, setIsSmScreen] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [circleStart, setCircleStart] = useState({ x: 0, y: 0 });

  const bestForPreview = character.bestFor?.slice(0, 2) ?? [];
  const bestForRemaining = character.bestFor?.slice(2) ?? [];
  const hasMoreDetails =
    !!character.description || bestForRemaining.length > 0 || (character.prompts?.length ?? 0) > 0;

  // Handle character switching animation for nav avatar
  useEffect(() => {
    if (character.avatarPath !== currentAvatarSrc) {
      // Save old avatar
      setPrevAvatarSrc(currentAvatarSrc);
      // Update to new avatar, initially transparent
      setCurrentAvatarSrc(character.avatarPath);
      setShowNewAvatar(false);
      // Use double requestAnimationFrame to ensure DOM update before triggering animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShowNewAvatar(true);
        });
      });
      // Clean up after animation completes
      const timer = setTimeout(() => {
        setPrevAvatarSrc(null);
        setShowNewAvatar(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [character.avatarPath, currentAvatarSrc]);

  // Reset details toggle when switching character
  useEffect(() => {
    setShowMoreCharacterInfo(false);
  }, [character.id]);

  // Track sm breakpoint for base positioning of the draggable circle
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    setIsSmScreen(mq.matches);
    const handler = (event: MediaQueryListEvent) => setIsSmScreen(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const baseCircleTranslate = useMemo(
    () => ({
      x: 0,
      y: isSmScreen ? -40 : -16, // matches sm:-translate-y-10 and -translate-y-4
    }),
    [isSmScreen]
  );

  const circleTransform = `translate(${baseCircleTranslate.x + dragOffset.x}px, ${
    baseCircleTranslate.y + dragOffset.y
  }px)`;

  const startDragging = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
    setCircleStart(dragOffset);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      setDragOffset({ x: circleStart.x + deltaX, y: circleStart.y + deltaY });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [circleStart.x, circleStart.y, dragStart.x, dragStart.y, isDragging]);

  const hasPrevAvatar = prevAvatarSrc !== null;
  const avatarObjectClass = "object-cover object-[center_5%]";
  return (
    <main className="relative min-h-screen bg-background text-foreground dark:bg-[#0b0b0f] dark:text-neutral-50">
      {/* Background Character - Fixed Position with Parallax */}
      <ParallaxCharacter />

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Top navigation */}
        <nav className="relative border-b bg-card/50 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-12">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2"
              >
                <div className="relative h-10 w-10 rounded-full border-2 border-primary/50 shadow-md ring-1 ring-primary/20 overflow-hidden">
                  {/* Old avatar - fade out */}
                  {hasPrevAvatar && (
                  <Image
                    key={`prev-${prevAvatarSrc}`}
                    src={prevAvatarSrc!}
                    alt={character.name}
                    width={40}
                    height={40}
                    className={`absolute inset-0 h-10 w-10 ${avatarObjectClass} transition-all duration-[400ms] ease-in-out`}
                    style={{
                      opacity: 0,
                      transform: "scale(0.95)",
                    }}
                    priority
                  />
                  )}
                  {/* New avatar - fade in */}
                  <Image
                    key={currentAvatarSrc}
                    src={currentAvatarSrc}
                    alt={character.name}
                    width={40}
                    height={40}
                    className={`h-10 w-10 ${avatarObjectClass} transition-all duration-[400ms] ease-in-out`}
                    style={{
                      opacity: hasPrevAvatar ? (showNewAvatar ? 1 : 0) : 1,
                      transform: hasPrevAvatar ? (showNewAvatar ? "scale(1)" : "scale(0.95)") : "scale(1)",
                    }}
                    priority
                  />
                </div>
                <span className="text-lg font-semibold tracking-tight">
                  Acontext PPT Girl
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline-block">
                Acontext-based AI slide generator for beautiful PPT-style decks
              </span>
              <AuthButton />
              <CharacterSwitcher />
              <ThemeSwitcher />
            </div>
          </div>
        </nav>

        {/* Main Hero Section */}
        <div className="relative min-h-[calc(100vh-4rem)] flex items-center">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-12 sm:px-6 sm:py-16 lg:px-12 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] lg:items-center">
              {/* Left: main copy + CTA */}
              <div className="max-w-3xl space-y-8 sm:space-y-10 lg:space-y-12">
                {/* Tag */}
                <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
                  <Badge variant="secondary" className="text-sm sm:text-base">
                    Acontext PPT Girl · AI Slide Generator
                  </Badge>
                </div>

                {/* Main headline */}
                <div className="space-y-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
                  <h1 className="text-5xl font-bold leading-tight sm:text-6xl md:text-7xl lg:text-8xl">
                    <span className="block text-primary">Acontext</span>
                    <span className="block">PPT Girl</span>
                    <span className="block text-primary">Slide Generator</span>
                  </h1>

                  <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl lg:text-2xl">
                    Turn any long text into clean, professional PPT-style slides with the Acontext PPT Girl Slide Generator.
                    Built on Acontext, it helps you outline your deck, confirm the structure, and auto-generate slide-ready
                    images with 16:9 layouts and space for your content.
                  </p>
                </div>

                {/* Highlighted Description */}
                <div className="animate-slide-up" style={{ animationDelay: "0.35s" }}>
                  <Card className="bg-primary/10 border-primary/30 backdrop-blur-sm shadow-lg dark:bg-neutral-900/70 dark:border-neutral-800 dark:shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9)]">
                    <CardContent className="pt-6">
                      <p className="text-base sm:text-lg font-medium text-foreground leading-relaxed mb-4">
                        Paste your content, let Acontext PPT Girl propose a slide outline, then approve to auto-generate
                        consistent, on-brand slide visuals for each page of your deck.
                      </p>
                      <p className="text-sm sm:text-base text-muted-foreground">
                        Every image is optimized for 16:9 PPT slides, keeping PPT Girl in the background so your text stays readable.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* CTA section */}
                <div className="space-y-6 animate-slide-up" style={{ animationDelay: "0.4s" }}>
                  {hasEnvVars ? (
                    <Link href="/protected" className="inline-block group">
                      <Button
                        size="lg"
                        className="text-lg px-8 py-7 h-auto font-semibold transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg"
                      >
                        Start PPT Girl Session
                        <span className="ml-2 transition-transform duration-300 group-hover:translate-x-1">→</span>
                      </Button>
                    </Link>
                  ) : (
                    <div className="w-full max-w-md">
                      <EnvVarWarning />
                    </div>
                  )}

                  {/* Feature tags */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    {["Auto slide outline", "16:9 PPT visuals", "Anime assistant style"].map((tag, index) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-sm transition-all duration-300 hover:bg-primary/10 hover:border-primary/50 dark:bg-neutral-900/60 dark:border-neutral-800"
                        style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Character info card */}
              <div
                className="animate-slide-up lg:flex lg:justify-end"
                style={{ animationDelay: "0.45s" }}
              >
                <div
                  className="relative lg:mr-4 flex justify-end"
                  onMouseEnter={() => setIsCharacterCardHovered(true)}
                  onMouseLeave={() => setIsCharacterCardHovered(false)}
                  style={{ transform: circleTransform }}
                >
                  {/* Collapsed circle trigger */}
                  <div
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-primary/50 shadow-lg ring-1 ring-primary/20 overflow-hidden bg-card/70 backdrop-blur-md dark:bg-neutral-900/70 dark:border-neutral-800 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                    onMouseDown={startDragging}
                    aria-label="Drag character avatar"
                  >
                    <Image
                      src={currentAvatarSrc}
                      alt={character.name}
                      width={72}
                      height={72}
                      className={`h-full w-full ${avatarObjectClass}`}
                      priority
                    />
                  </div>

                  {/* Hover card */}
                  <div
                    className={`absolute right-6 top-8 sm:right-8 sm:top-10 z-20 transition-all duration-300 ease-out origin-top-right ${
                      isCharacterCardHovered
                        ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                        : "opacity-0 translate-y-2 scale-95 pointer-events-none"
                    }`}
                  >
                    <Card className="max-w-xl w-[360px] sm:w-[420px] bg-card/70 backdrop-blur-md border-border/60 shadow-2xl dark:bg-neutral-900/80 dark:border-neutral-800 max-h-[70vh] overflow-auto">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <CardTitle className="text-xl sm:text-2xl">
                              {character.name}
                            </CardTitle>
                            <p className="text-sm sm:text-base text-muted-foreground">
                              {character.title}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs sm:text-sm">
                            Current character
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm sm:text-base font-semibold text-foreground">
                          {character.tagline}
                        </p>

                        {bestForPreview.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Best for
                            </p>
                            <ul className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                              {bestForPreview.map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                  <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-primary/70" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {hasMoreDetails && (
                          <div className="space-y-3 border-t border-border/60 pt-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                More about {character.name}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 text-xs"
                                onClick={() => setShowMoreCharacterInfo((prev) => !prev)}
                              >
                                {showMoreCharacterInfo ? "Show less" : "Show more"}
                              </Button>
                            </div>

                            {showMoreCharacterInfo && (
                              <div className="space-y-4">
                                {character.description && (
                                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                    {character.description}
                                  </p>
                                )}

                                {bestForRemaining.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Also great for
                                    </p>
                                    <ul className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                                      {bestForRemaining.map((item) => (
                                        <li key={item} className="flex items-start gap-2">
                                          <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-primary/50" />
                                          <span>{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {character.prompts?.length > 0 && (
                                  <div className="space-y-2 pt-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Try asking
                                    </p>
                                    <ul className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                                      {character.prompts.map((prompt) => (
                                        <li key={prompt} className="rounded-md bg-muted/40 px-2.5 py-1.5">
                                          {prompt}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Demo Section */}
        <div className="relative py-12 sm:py-16 lg:py-20">
          <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-12">
            <div className="max-w-7xl">
              <InteractiveDemoGallery />
            </div>
          </div>
        </div>

        {/* Footer */}
                <footer className="relative border-t bg-card/50 backdrop-blur-sm py-6 sm:py-8">
          <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-12">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                © 2026 Acontext PPT Girl Slide Generator
              </p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
