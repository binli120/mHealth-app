/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import React from 'react';
import { IconBase, IconProps } from './IconBase';

export const GearSyncIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <circle cx='32' cy='32' r='8' />
    <path d='M32 18v-4M32 50v-4M18 32h-4M50 32h-4' />
    <path d='M14 20a22 22 0 0136-2' />
    <path d='M50 44a22 22 0 01-36 2' />
  </IconBase>
);
