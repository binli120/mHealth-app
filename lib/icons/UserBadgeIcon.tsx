import React from 'react';
import { IconBase, IconProps } from './IconBase';

export const UserBadgeIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <circle cx='32' cy='22' r='10' />
    <path d='M14 54c2-10 12-14 18-14s16 4 18 14' />
    <circle cx='48' cy='30' r='6' />
  </IconBase>
);
