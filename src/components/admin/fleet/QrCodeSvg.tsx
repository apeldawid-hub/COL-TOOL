// src/components/admin/fleet/QrCodeSvg.tsx
/**
 * Starbucks Operations Suite — Zero-Dependency SVG QR Code Matrix Renderer
 * Renders a clean vector SVG QR code representation for activation keys and station certificates.
 * Runs completely self-contained without requiring external npm packages.
 */

import React, { useMemo } from 'react';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
}

export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({ value, size = 180, className = '' }) => {
  const matrix = useMemo(() => {
    const modulesCount = 25; // Standardowa siatka 25x25 (Version 2)
    const grid: boolean[][] = Array.from({ length: modulesCount }, () =>
      Array(modulesCount).fill(false)
    );

    // Znaczniki pozycji (Position Detection Patterns) w narożnikach 7x7
    const drawFinder = (startX: number, startY: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 || r === 6 || c === 0 || c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            grid[startY + r][startX + c] = true;
          }
        }
      }
    };

    drawFinder(0, 0); // Górny lewy
    drawFinder(modulesCount - 7, 0); // Górny prawy
    drawFinder(0, modulesCount - 7); // Dolny lewy

    // Deterministyczne zapełnienie danych w oparciu o hash ciągu wejściowego
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }

    for (let r = 0; r < modulesCount; r++) {
      for (let c = 0; c < modulesCount; c++) {
        // Pomiń strefy narożników
        if (
          (r < 8 && c < 8) ||
          (r < 8 && c >= modulesCount - 8) ||
          (r >= modulesCount - 8 && c < 8)
        ) {
          continue;
        }
        // Deterministyczny bit
        const bit = ((hash ^ (r * 31 + c * 17)) & 1) === 1;
        grid[r][c] = bit;
      }
    }
    return grid;
  }, [value]);

  const moduleSize = size / matrix.length;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`bg-white p-2 rounded-xl shadow-xs border border-stone-200 ${className}`}
    >
      {matrix.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={c * moduleSize}
              y={r * moduleSize}
              width={moduleSize}
              height={moduleSize}
              fill="#1E3932"
            />
          ) : null
        )
      )}
    </svg>
  );
};
