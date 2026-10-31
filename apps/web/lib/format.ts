const LAGOS = 'Africa/Lagos';

export function timeOfDay(iso: string | null, withSeconds = false): string {
  if (!iso) return 'Not recorded';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LAGOS,
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).format(date);
}

export function dayStamp(iso: string | null): string {
  if (!iso) return 'Not recorded';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LAGOS,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function utcStamp(iso: string | null): string {
  if (!iso) return 'Not recorded';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)} · ${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)} UTC`;
}

export function shortHash(hash: string | null, lead = 10, tail = 6): string {
  if (!hash) return 'Not recorded';
  if (hash.length <= lead + tail + 1) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}

export function directionLabel(direction: string | null): string {
  if (direction === 'long') return 'Long';
  if (direction === 'short') return 'Short';
  if (direction === 'spot_buy') return 'Spot buy';
  return direction || 'Not recorded';
}

export function roleLabel(role: string): string {
  if (role === 'core_signal') return 'Core signal';
  if (role === 'meme_radar') return 'Meme radar';
  if (role === 'noisy_source') return 'Noisy source';
  if (role === 'red_flag_specimen') return 'Red flag specimen';
  return role;
}

export function formatOffset(seconds: number): string {
  const sign = seconds < 0 ? '-' : '+';
  const total = Math.abs(Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (hours > 0) return `${sign}${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  return `${sign}${pad(minutes)}:${pad(secs)}`;
}

export function offsetBetween(later: string, earlier: string): number {
  return (new Date(later).getTime() - new Date(earlier).getTime()) / 1000;
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function price(value: string | number | null): string {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function score(scoreValue: number): string {
  return scoreValue.toFixed(1);
}

export function txUrl(hash: string | null): string | null {
  if (!hash) return null;
  return `https://eth-sepolia.blockscout.com/tx/${hash}`;
}

export function addressUrl(address: string | null): string | null {
  if (!address) return null;
  return `https://eth-sepolia.blockscout.com/address/${address}`;
}

export function excerptWithMention(text: string, ticker: string | null): Array<{ text: string; mention: boolean }> {
  if (!text) return [];
  if (!ticker) return [{ text, mention: false }];
  const index = text.toUpperCase().indexOf(ticker.toUpperCase());
  if (index < 0) return [{ text, mention: false }];
  return [
    { text: text.slice(0, index), mention: false },
    { text: text.slice(index, index + ticker.length), mention: true },
    { text: text.slice(index + ticker.length), mention: false },
  ].filter((part) => part.text.length > 0);
}
