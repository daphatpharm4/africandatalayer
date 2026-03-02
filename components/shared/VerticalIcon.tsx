import React from 'react';
import {
  Pill,
  Landmark,
  Fuel,
  Wine,
  Store,
  RectangleHorizontal,
  ShoppingCart,
  Bus,
  Satellite,
  Truck,
  HeartHandshake,
  Building2,
  Eye,
  Droplets,
  type LucideProps,
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  pill: Pill,
  landmark: Landmark,
  fuel: Fuel,
  wine: Wine,
  store: Store,
  'rectangle-horizontal': RectangleHorizontal,
  'shopping-cart': ShoppingCart,
  bus: Bus,
  satellite: Satellite,
  truck: Truck,
  'heart-handshake': HeartHandshake,
  'building-2': Building2,
  eye: Eye,
  droplets: Droplets,
};

interface VerticalIconProps extends LucideProps {
  name: string;
}

const VerticalIcon: React.FC<VerticalIconProps> = ({ name, ...props }) => {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon {...props} />;
};

export default VerticalIcon;
