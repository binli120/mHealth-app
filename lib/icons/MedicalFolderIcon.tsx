/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import React from 'react';
import { IconBase, IconProps } from './IconBase';

export const MedicalFolderIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d='M6 20h20l4-6h28v34a4 4 0 01-4 4H10a4 4 0 01-4-4z' />
    <path d='M32 32v10M27 37h10' />
  </IconBase>
);
