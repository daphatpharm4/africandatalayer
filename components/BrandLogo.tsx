import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ size = 32, className }) => (
  <img
    src="/web-app-icon-192.png"
    srcSet="/apple-touch-icon.png 180w, /web-app-icon-192.png 192w"
    sizes={`${size}px`}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    decoding="async"
    draggable={false}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);

export default BrandLogo;
