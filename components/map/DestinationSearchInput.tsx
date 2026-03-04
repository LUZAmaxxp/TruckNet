"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { GeocodeResult } from "@/schemas/route.schema";

interface DestinationSearchInputProps {
  onSelect: (result: GeocodeResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Render the dropdown above the input instead of below (use when near bottom of viewport) */
  dropUp?: boolean;
}

/**
 * Debounced destination search input.
 * Queries /api/geocode with 500 ms debounce and renders a dropdown of results.
 */
export function DestinationSearchInput({
  onSelect,
  placeholder = "Search for a destination…",
  autoFocus,
  dropUp = false,
}: DestinationSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = (await res.json()) as { results: GeocodeResult[] };
        setResults(data.results ?? []);
        setOpen(true);
        setActiveIndex(-1);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(query), 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      // Select highlighted item, or auto-select the first result if none highlighted
      const idx = activeIndex >= 0 ? activeIndex : 0;
      const selected = results[idx];
      if (selected && open) {
        handleSelect(selected);
        return;
      }
      // No results yet — trigger immediate search (bypass debounce)
      if (query.trim().length >= 2) void search(query);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleSelect(result: GeocodeResult) {
    setQuery(result.displayName);
    setOpen(false);
    onSelect(result);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="pl-9 pr-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          role="listbox"
          className={`absolute z-50 w-full rounded-md border bg-popover shadow-lg max-h-56 overflow-y-auto py-1 ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {results.map((r, idx) => (
            <li
              key={r.place_id}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={() => handleSelect(r)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`flex items-start gap-2 cursor-pointer px-3 py-2 text-sm transition-colors ${
                idx === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              }`}
            >
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--terra)]" />
              <span className="line-clamp-2 leading-snug">{r.displayName}</span>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className={`absolute z-50 w-full rounded-md border bg-popover shadow-lg px-3 py-3 text-sm text-muted-foreground ${
          dropUp ? "bottom-full mb-1" : "top-full mt-1"
        }`}>
          No results found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
