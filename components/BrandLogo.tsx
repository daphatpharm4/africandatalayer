import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ size = 32, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 128 128"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
  >
    <path
      d="M64 14L112 40L64 66L16 40L64 14Z"
      fill="#0f2b46"
      stroke="#ffffff"
      strokeWidth="6"
      strokeLinejoin="round"
    />
    <path
      d="M64 44L112 70L64 96L16 70L64 44Z"
      fill="#f4c317"
      stroke="#ffffff"
      strokeWidth="6"
      strokeLinejoin="round"
    />
    <path
      d="M16 76L64 102L112 76L76 114C73 117 68.9 118.5 64.8 118.5C60.7 118.5 56.6 117 53.6 114L16 76Z"
      fill="#0f2b46"
      stroke="#ffffff"
      strokeWidth="6"
      strokeLinejoin="round"
    />
  </svg>
);

export default BrandLogo;
