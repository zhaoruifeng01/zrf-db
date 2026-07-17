/**
 * next/image compatibility shim for the shell.
 *
 * Legacy modules import `<Image />` from `next/image` for static-asset
 * optimization. The shell does not run the Next.js image optimizer, so we
 * forward to a plain `<img>` element that preserves the same props used by
 * chat modules: `src`, `alt`, `width`, `height`, `className`, plus arbitrary
 * pass-through HTML attributes.
 *
 * `next/image`'s `fill`, `loader`, `priority`, `placeholder`, `quality`,
 * `sizes`, and `style` props are accepted but ignored or mapped as best
 * effort. Add fields here if a chat caller needs more fidelity.
 */

import type { CSSProperties, ImgHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  /** Accepted for API parity; treated as inline style when provided. */
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  placeholder?: 'empty' | 'blur' | 'data:image';
  loader?: (props: { src: string; width: number; quality?: number }) => string;
  style?: CSSProperties;
}

/**
 * Plain `<img>` stand-in for next/image. Width/height become inline styles
 * when numeric (matches Next.js default behavior of constraining layout).
 */
const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  { src, alt, width, height, fill, style, ...rest },
  ref,
) {
  const resolvedStyle: CSSProperties = {
    ...(width !== undefined ? { width } : null),
    ...(height !== undefined ? { height } : null),
    ...(fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } : null),
    ...style,
  };
  return <img ref={ref} src={src} alt={alt} style={resolvedStyle} {...rest} />;
});

export default Image;
