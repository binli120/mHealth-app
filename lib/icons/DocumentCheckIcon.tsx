/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import React from 'react';
import { IconBase, IconProps } from './IconBase';

export const DocumentCheckIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d='M12 6h28l12 12v40H12z' />
    <path d='M40 6v12h12' />
    <path d='M20 28h24M20 36h18' />
    <circle cx='42' cy='48' r='6' />
    <path d='M39 48l2 2 4-4' />
  </IconBase>
);
