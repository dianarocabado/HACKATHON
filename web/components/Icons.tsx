// One icon language for the whole app: Lucide line icons (MIT), 1.75 stroke, round caps. No emoji in the UI.
// Categories always use the same icon and colour, so a heat report looks the same on the map, in lists and cards.
import {
  AudioLines, Bike, Droplets, Flower2, ListChecks, LoaderCircle, LocateFixed, Map as MapIcon, MapPin, Mic,
  Square, Sun, Trash2, Wind, type LucideIcon, type LucideProps,
} from 'lucide-react';
import type { Category } from '@contracts/types';
import { CATEGORY } from '@/lib/client/missions';

const STROKE = 1.75;

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  heat: Sun,
  air: Wind,
  noise: AudioLines,
  water: Droplets,
  biodiversity: Flower2,
  waste: Trash2,
  mobility: Bike,
  other: MapPin,
};

export const AppIcon = {
  map: MapIcon,
  report: Mic,
  missions: ListChecks,
  stop: Square,
  busy: LoaderCircle,
  locate: LocateFixed,
  place: MapPin,
} satisfies Record<string, LucideIcon>;

type IconProps = Omit<LucideProps, 'ref'>;

/** A Lucide icon with the app's stroke; decorative by default (the label next to it carries the meaning). */
export function Icon({ icon: I, size = 20, ...rest }: IconProps & { icon: LucideIcon }) {
  return <I size={size} strokeWidth={STROKE} aria-hidden {...rest} />;
}

/** Category icon in the current text colour, for chips that already have a coloured background. */
export function CategoryIcon({ category, size = 16, ...rest }: IconProps & { category: Category }) {
  return <Icon icon={CATEGORY_ICON[category]} size={size} {...rest} />;
}

/** Category icon on a soft tile in its own colour (lists, cards, live feed). */
export function CategoryTile({ category, size = 36 }: { category: Category; size?: number }) {
  const { colour } = CATEGORY[category];
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-xl"
      // 8-digit hex: the category colour at ~14 % opacity behind the full-colour icon
      style={{ width: size, height: size, background: `${colour}24`, color: colour }}
    >
      <CategoryIcon category={category} size={Math.round(size * 0.55)} />
    </span>
  );
}

/** Generic step/feature tile in the brand colour (welcome card). */
export function BrandTile({ icon, size = 40 }: { icon: LucideIcon; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}
    >
      <Icon icon={icon} size={Math.round(size * 0.55)} />
    </span>
  );
}

/** Same teardrop as the mission pins drawn in HexMap, as an SVG string for DOM map markers. */
export function pinSvg(fill: string, width = 24): string {
  const h = Math.round((width * 64) / 48);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 48 64" aria-hidden="true">`
    + `<path d="M24 62C14 46 4 36 4 22A20 20 0 0 1 44 22C44 36 34 46 24 62Z" fill="${fill}" stroke="#FFF" stroke-width="3"/>`
    + '<circle cx="24" cy="22" r="7" fill="#FFF"/></svg>';
}
