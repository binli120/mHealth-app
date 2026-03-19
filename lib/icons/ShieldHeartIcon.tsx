/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import React from 'react';
import { IconBase, IconProps } from './IconBase';

export const ShieldHeartIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d='M32 6l20 8v16c0 14-10 22-20 28C22 52 12 44 12 30V14z' />
    <path
      d='M32 40s-8-5-8-10a5 5 0 018-3 5 5 0 018 3c0 5-8 10-8 10z'
      fill='#e96f5b'
      stroke='none'
    />
  </IconBase>
);
