import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTextColorForBackground(backgroundColor: string): string {
  if (!backgroundColor) return 'text-black';
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '');
  // Handle shorthand hex like #ccc
  if (hex.length === 3) {
      const split = hex.split('');
      return getTextColorForBackground(`#${split[0]}${split[0]}${split[1]}${split[1]}${split[2]}${split[2]}`);
  }
  
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate brightness (YIQ formula)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

  // Return black for light backgrounds, white for dark backgrounds
  return yiq >= 128 ? 'text-black' : 'text-white';
}
